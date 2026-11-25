import { computeStatus } from '@/lib/medicine-status';
import { getDb } from '@/lib/mongo';
import { summarizeLeaflet } from '@/lib/ai';
import { v4 as uuidv4 } from 'uuid';
import { hit } from '@/lib/rate-limit';
import { isValidTime } from '@/lib/doses';
import { buildMedicineFields, pickMedicineUpdates } from '@/lib/medicine-input';
import { HOUR, json } from '@/lib/api/common';
import {
  deleteMedicine, doseLogsForDay, findDoseTaken, findMedicine, findMedicineByBarcode, historyOf,
  insertMedicine, listMedicineIds, listMedicines, logHistory, updateMedicine,
} from '@/lib/data/medicines';

// Medicamentos, estatísticas, doses e bula.
export async function handleMedicines(request, { path, segs, method, user, userEmail }) {
  // Dashboard stats
  if (path === '/stats' && method === 'GET') {
    const db = await getDb();
    const meds = await listMedicines(db, user);
    const enriched = meds.map(m => ({ ...m, ...computeStatus(m) }));
    const total = enriched.length;
    const expired = enriched.filter(m => m.expiry_status === 'expired').length;
    const expiring = enriched.filter(m => ['critical', 'warning_30', 'warning_60', 'warning_90'].includes(m.expiry_status)).length;
    const low_stock = enriched.filter(m => (m.quantidade != null && m.quantidade_minima != null && m.quantidade <= m.quantidade_minima)).length;
    const categories = {};
    for (const m of enriched) {
      const c = m.categoria || 'Outros';
      categories[c] = (categories[c] || 0) + 1;
    }
    const last_added = enriched.slice(0, 5);
    return json({ total, expired, expiring, low_stock, categories, last_added });
  }

  // Find medicine by barcode (lookup — user-scoped)
  if (segs[0] === 'medicines' && segs[1] === 'by-barcode' && segs.length === 3 && method === 'GET') {
    const code = String(segs[2]).slice(0, 64);
    const db = await getDb();
    const m = await findMedicineByBarcode(db, user, code);
    if (!m) return json({ found: false }, 404);
    return json({ found: true, medicine: { ...m, ...computeStatus(m) } });
  }

  // List medicines
  if (path === '/medicines' && method === 'GET') {
    const db = await getDb();
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').slice(0, 100);
    const cat = (url.searchParams.get('categoria') || '').slice(0, 60);
    let meds = await listMedicines(db, user, cat ? { categoria: cat } : {});
    if (q) {
      const ql = q.toLowerCase();
      meds = meds.filter(m =>
        String(m.nome_comercial || '').toLowerCase().includes(ql) ||
        String(m.nome_generico || '').toLowerCase().includes(ql) ||
        String(m.principio_ativo || '').toLowerCase().includes(ql) ||
        String(m.laboratorio || '').toLowerCase().includes(ql) ||
        String(m.categoria || '').toLowerCase().includes(ql) ||
        String(m.local || '').toLowerCase().includes(ql) ||
        String(m.codigo_barras || '').toLowerCase().includes(ql)
      );
    }
    const enriched = meds.map(m => ({ ...m, ...computeStatus(m) }));
    return json({ medicines: enriched });
  }

  // Create medicine
  if (path === '/medicines' && method === 'POST') {
    const body = await request.json();
    const now = new Date().toISOString();
    const doc = {
      id: uuidv4(),
      user_email: userEmail,
      family_id: user.family_id || null,
      ...buildMedicineFields(body),
      created_at: now,
      updated_at: now,
    };
    const db = await getDb();
    await insertMedicine(db, doc);
    await logHistory(db, {
      user_email: userEmail,
      medicine_id: doc.id,
      action: 'created',
      details: `Medicamento ${doc.nome_comercial} cadastrado com quantidade ${doc.quantidade}`,
      created_at: now,
    });
    return json({ ...doc, ...computeStatus(doc) });
  }

  // Doses already marked as taken on a given day (YYYY-MM-DD, the user's local date)
  if (path === '/doses' && method === 'GET') {
    const date = new URL(request.url).searchParams.get('date') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'date inválida' }, 400);
    const db = await getDb();
    const logs = await doseLogsForDay(db, await listMedicineIds(db, user), date);
    return json({ taken: logs.map(l => ({ medicine_id: l.medicine_id, time: l.dose_time })) });
  }

  // "Tomei": records the dose and takes one unit out of the stock
  if (segs[0] === 'medicines' && segs.length === 3 && segs[2] === 'take' && method === 'POST') {
    const id = segs[1];
    const body = await request.json().catch(() => ({}));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body?.date || '') ? body.date : null;
    const time = isValidTime(body?.time) ? body.time : null;
    if (!date || !time) return json({ error: 'date e time obrigatórios' }, 400);
    const db = await getDb();
    const m = await findMedicine(db, user, id);
    if (!m) return json({ error: 'não encontrado' }, 404);
    const already = await findDoseTaken(db, id, date, time);
    if (already) return json({ ok: true, already: true, quantidade: m.quantidade });
    const now = new Date().toISOString();
    const current = Number(m.quantidade) || 0;
    const quantidade = Math.max(0, current - 1);
    await logHistory(db, {
      user_email: userEmail,
      medicine_id: id,
      action: 'dose_taken',
      dose_date: date,
      dose_time: time,
      details: `Dose das ${time} tomada${current > 0 ? ` (estoque ${current} → ${quantidade})` : ''}`,
      created_at: now,
    });
    if (current > 0) await updateMedicine(db, user, id, { quantidade, updated_at: now });
    return json({ ok: true, quantidade });
  }

  // Resumo da bula em linguagem simples (guardado no medicamento para não repetir a chamada de IA)
  if (segs[0] === 'medicines' && segs.length === 3 && segs[2] === 'leaflet' && method === 'POST') {
    const id = segs[1];
    const body = await request.json().catch(() => ({}));
    const db = await getDb();
    const m = await findMedicine(db, user, id);
    if (!m) return json({ error: 'não encontrado' }, 404);
    if (m.bula_resumo && !body?.refresh) return json({ bula_resumo: m.bula_resumo, bula_resumo_at: m.bula_resumo_at || null });
    const rl = await hit(db, `leaflet:${userEmail}`, 30, HOUR);
    if (!rl.allowed) {
      const res = json({ error: 'Muitos resumos em pouco tempo. Tente de novo mais tarde.' }, 429);
      res.headers.set('Retry-After', String(rl.retryAfterSec));
      return res;
    }
    const bula_resumo = await summarizeLeaflet(m);
    const bula_resumo_at = new Date().toISOString();
    await updateMedicine(db, user, id, { bula_resumo, bula_resumo_at });
    return json({ bula_resumo, bula_resumo_at });
  }

  // Single medicine ops (user-scoped)
  if (segs[0] === 'medicines' && segs.length === 2) {
    const id = segs[1];
    const db = await getDb();
    if (method === 'GET') {
      const m = await findMedicine(db, user, id);
      if (!m) return json({ error: 'não encontrado' }, 404);
      const history = await historyOf(db, id);
      return json({ ...m, ...computeStatus(m), history });
    }
    if (method === 'PATCH') {
      const body = await request.json();
      const existing = await findMedicine(db, user, id);
      if (!existing) return json({ error: 'não encontrado' }, 404);
      // Só campos editáveis, com tipo e tamanho conferidos (lib/medicine-input.js).
      // Dono, família, datas internas e o resumo da bula ficam de fora.
      const updates = { ...pickMedicineUpdates(body), updated_at: new Date().toISOString() };
      const identityChanged = ['nome_comercial', 'principio_ativo', 'concentracao', 'forma_farmaceutica']
        .some(k => k in updates && String(updates[k] || '') !== String(existing[k] || ''));
      await updateMedicine(db, user, id, updates, identityChanged ? { bula_resumo: '', bula_resumo_at: '' } : undefined);
      if ('quantidade' in updates && updates.quantidade !== Number(existing.quantidade)) {
        const diff = updates.quantidade - (Number(existing.quantidade) || 0);
        await logHistory(db, {
          user_email: userEmail,
          medicine_id: id,
          action: diff > 0 ? 'added' : 'removed',
          details: `Quantidade ${diff > 0 ? '+' : ''}${diff} (de ${existing.quantidade} para ${updates.quantidade})`,
        });
      }
      const updated = await findMedicine(db, user, id);
      return json({ ...updated, ...computeStatus(updated) });
    }
    if (method === 'DELETE') {
      const r = await deleteMedicine(db, user, id);
      // Só registra no histórico se o medicamento era da pessoa (ou da família dela).
      if (r?.deletedCount) {
        await logHistory(db, {
          user_email: userEmail,
          medicine_id: id,
          action: 'deleted',
          details: 'Medicamento removido',
        });
      }
      return json({ ok: true });
    }
  }
  return null;
}

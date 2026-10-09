import { computeStatus } from '@/lib/medicine-status';
import { getDb } from '@/lib/mongo';
import { summarizeLeaflet } from '@/lib/ai';
import { v4 as uuidv4 } from 'uuid';
import { hit } from '@/lib/rate-limit';
import { normalizeDoseTimes, isValidTime } from '@/lib/doses';
import { COL, HIST, HOUR, json, scopeFilter } from '@/lib/api/common';

// Medicamentos, estatísticas, doses e bula.
export async function handleMedicines(request, { path, segs, method, user, userEmail }) {
  // Dashboard stats
  if (path === '/stats' && method === 'GET') {
    const db = await getDb();
    const meds = await db.collection(COL).find(scopeFilter(user)).sort({ created_at: -1 }).toArray();
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
    const code = segs[2];
    const db = await getDb();
    const m = await db.collection(COL).findOne({ ...scopeFilter(user), codigo_barras: code });
    if (!m) return json({ found: false }, 404);
    return json({ found: true, medicine: { ...m, ...computeStatus(m) } });
  }

  // List medicines
  if (path === '/medicines' && method === 'GET') {
    const db = await getDb();
    const url = new URL(request.url);
    const q = url.searchParams.get('q');
    const cat = url.searchParams.get('categoria');
    const filter = { ...scopeFilter(user) };
    if (cat) filter.categoria = cat;
    let meds = await db.collection(COL).find(filter).sort({ created_at: -1 }).toArray();
    if (q) {
      const ql = q.toLowerCase();
      meds = meds.filter(m =>
        (m.nome_comercial || '').toLowerCase().includes(ql) ||
        (m.nome_generico || '').toLowerCase().includes(ql) ||
        (m.principio_ativo || '').toLowerCase().includes(ql) ||
        (m.laboratorio || '').toLowerCase().includes(ql) ||
        (m.categoria || '').toLowerCase().includes(ql) ||
        (m.local || '').toLowerCase().includes(ql) ||
        (m.codigo_barras || '').toLowerCase().includes(ql)
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
      nome_comercial: body.nome_comercial || body.nome || '',
      nome_generico: body.nome_generico || '',
      principio_ativo: body.principio_ativo || '',
      laboratorio: body.laboratorio || body.laboratorio_comum || '',
      concentracao: body.concentracao || '',
      forma_farmaceutica: body.forma_farmaceutica || 'Comprimido',
      categoria: body.categoria || 'Outros',
      classe_terapeutica: body.classe_terapeutica || '',
      para_que_serve: body.para_que_serve || '',
      indicacoes: body.indicacoes || [],
      contraindicacoes: body.contraindicacoes || [],
      efeitos_colaterais: body.efeitos_colaterais || [],
      precisa_receita: !!body.precisa_receita,
      uso_continuo: !!body.uso_continuo,
      modo_armazenamento: body.modo_armazenamento || '',
      lote: body.lote || '',
      data_fabricacao: body.data_fabricacao || '',
      data_validade: body.data_validade || '',
      quantidade: body.quantidade != null ? Number(body.quantidade) : 1,
      quantidade_minima: body.quantidade_minima != null ? Number(body.quantidade_minima) : 1,
      local: body.local || '',
      observacoes: body.observacoes || '',
      codigo_barras: body.codigo_barras || '',
      dose_times: normalizeDoseTimes(body.dose_times),
      created_at: now,
      updated_at: now,
    };
    const db = await getDb();
    await db.collection(COL).insertOne(doc);
    await db.collection(HIST).insertOne({
      id: uuidv4(),
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
    const ids = (await db.collection(COL).find(scopeFilter(user)).project({ id: 1 }).toArray()).map(m => m.id);
    const logs = ids.length
      ? await db.collection(HIST).find({ medicine_id: { $in: ids }, action: 'dose_taken', dose_date: date }).toArray()
      : [];
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
    const m = await db.collection(COL).findOne({ id, ...scopeFilter(user) });
    if (!m) return json({ error: 'não encontrado' }, 404);
    const already = await db.collection(HIST).findOne({ medicine_id: id, action: 'dose_taken', dose_date: date, dose_time: time });
    if (already) return json({ ok: true, already: true, quantidade: m.quantidade });
    const now = new Date().toISOString();
    const current = Number(m.quantidade) || 0;
    const quantidade = Math.max(0, current - 1);
    await db.collection(HIST).insertOne({
      id: uuidv4(),
      user_email: userEmail,
      medicine_id: id,
      action: 'dose_taken',
      dose_date: date,
      dose_time: time,
      details: `Dose das ${time} tomada${current > 0 ? ` (estoque ${current} → ${quantidade})` : ''}`,
      created_at: now,
    });
    if (current > 0) await db.collection(COL).updateOne({ id, ...scopeFilter(user) }, { $set: { quantidade, updated_at: now } });
    return json({ ok: true, quantidade });
  }

  // Resumo da bula em linguagem simples (guardado no medicamento para não repetir a chamada de IA)
  if (segs[0] === 'medicines' && segs.length === 3 && segs[2] === 'leaflet' && method === 'POST') {
    const id = segs[1];
    const body = await request.json().catch(() => ({}));
    const db = await getDb();
    const m = await db.collection(COL).findOne({ id, ...scopeFilter(user) });
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
    await db.collection(COL).updateOne({ id, ...scopeFilter(user) }, { $set: { bula_resumo, bula_resumo_at } });
    return json({ bula_resumo, bula_resumo_at });
  }

  // Single medicine ops (user-scoped)
  if (segs[0] === 'medicines' && segs.length === 2) {
    const id = segs[1];
    const db = await getDb();
    if (method === 'GET') {
      const m = await db.collection(COL).findOne({ id, ...scopeFilter(user) });
      if (!m) return json({ error: 'não encontrado' }, 404);
      const history = await db.collection(HIST).find({ medicine_id: id }).sort({ created_at: -1 }).toArray();
      return json({ ...m, ...computeStatus(m), history });
    }
    if (method === 'PATCH') {
      const body = await request.json();
      const existing = await db.collection(COL).findOne({ id, ...scopeFilter(user) });
      if (!existing) return json({ error: 'não encontrado' }, 404);
      const updates = { ...body, updated_at: new Date().toISOString() };
      delete updates._id;
      delete updates.id;
      delete updates.user_email;
      if ('dose_times' in updates) updates.dose_times = normalizeDoseTimes(updates.dose_times);
      // O resumo da bula é gerado pelo servidor; o app não o define. Se o remédio mudou, ele deixa de valer.
      delete updates.bula_resumo;
      delete updates.bula_resumo_at;
      const identityChanged = ['nome_comercial', 'principio_ativo', 'concentracao', 'forma_farmaceutica']
        .some(k => k in updates && String(updates[k] || '') !== String(existing[k] || ''));
      await db.collection(COL).updateOne(
        { id, ...scopeFilter(user) },
        identityChanged ? { $set: updates, $unset: { bula_resumo: '', bula_resumo_at: '' } } : { $set: updates }
      );
      if (body.quantidade != null && Number(body.quantidade) !== Number(existing.quantidade)) {
        const diff = Number(body.quantidade) - Number(existing.quantidade);
        await db.collection(HIST).insertOne({
          id: uuidv4(),
          user_email: userEmail,
          medicine_id: id,
          action: diff > 0 ? 'added' : 'removed',
          details: `Quantidade ${diff > 0 ? '+' : ''}${diff} (de ${existing.quantidade} para ${body.quantidade})`,
          created_at: new Date().toISOString(),
        });
      }
      const updated = await db.collection(COL).findOne({ id, ...scopeFilter(user) });
      return json({ ...updated, ...computeStatus(updated) });
    }
    if (method === 'DELETE') {
      await db.collection(COL).deleteOne({ id, ...scopeFilter(user) });
      await db.collection(HIST).insertOne({
        id: uuidv4(),
        user_email: userEmail,
        medicine_id: id,
        action: 'deleted',
        details: 'Medicamento removido',
        created_at: new Date().toISOString(),
      });
      return json({ ok: true });
    }
  }
  return null;
}

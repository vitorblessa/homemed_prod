import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { enrichMedicine, enrichFromBarcodeAndImage, answerInventoryQuestion } from '@/lib/ai';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COL = 'medicines';
const HIST = 'history';
const USERS = 'users';
const SESSIONS = 'sessions';
const FAMILIES = 'families';
const PUSH_SUBS = 'push_subscriptions';
const COOKIE_NAME = 'homemed_session';
const EMERGENT_AUTH_API = 'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data';

function json(data, status = 200, extra = {}) {
  const res = NextResponse.json(data, { status });
  if (extra.setCookie) {
    res.cookies.set(COOKIE_NAME, extra.setCookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  if (extra.clearCookie) {
    res.cookies.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 0,
    });
  }
  return res;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}

function computeStatus(med) {
  const d = daysUntil(med.data_validade);
  if (d == null) return { expiry_status: 'unknown', days_until_expiry: null };
  if (d < 0) return { expiry_status: 'expired', days_until_expiry: d };
  if (d <= 7) return { expiry_status: 'critical', days_until_expiry: d };
  if (d <= 30) return { expiry_status: 'warning_30', days_until_expiry: d };
  if (d <= 60) return { expiry_status: 'warning_60', days_until_expiry: d };
  if (d <= 90) return { expiry_status: 'warning_90', days_until_expiry: d };
  return { expiry_status: 'ok', days_until_expiry: d };
}

async function currentUser(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const db = await getDb();
  const session = await db.collection(SESSIONS).findOne({ token });
  if (!session) return null;
  if (session.expires_at && new Date(session.expires_at) < new Date()) return null;
  const userDoc = await db.collection(USERS).findOne({ email: session.email });
  return {
    email: session.email,
    name: session.name,
    picture: session.picture,
    family_id: userDoc?.family_id || null,
  };
}

function randomInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

// Returns the scope filter for medicines: { family_id } if user in family, else { user_email }
function scopeFilter(user) {
  return user.family_id
    ? { family_id: user.family_id }
    : { user_email: user.email, $or: [{ family_id: null }, { family_id: { $exists: false } }] };
}

async function handle(request, ctx) {
  const params = await ctx.params;
  const segs = params?.path || [];
  const path = '/' + segs.join('/');
  const method = request.method;

  try {
    // ============ AUTH ============
    if (path === '/auth/register' && method === 'POST') {
      const body = await request.json();
      const email = (body?.email || '').toString().trim().toLowerCase();
      const password = (body?.password || '').toString();
      const name = (body?.name || '').toString().trim() || email.split('@')[0];
      if (!email || !email.includes('@')) return json({ error: 'Email inválido' }, 400);
      if (password.length < 6) return json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
      const db = await getDb();
      const existing = await db.collection(USERS).findOne({ email });
      if (existing && existing.password_hash) {
        return json({ error: 'Este email já está registrado. Faça login.' }, 409);
      }
      const password_hash = await bcrypt.hash(password, 10);
      const now = new Date();
      const doc = {
        email,
        name,
        picture: '',
        password_hash,
        auth_method: 'password',
        updated_at: now,
      };
      if (existing) {
        // Existing Google user adding password
        await db.collection(USERS).updateOne({ email }, { $set: doc });
      } else {
        await db.collection(USERS).updateOne(
          { email },
          { $set: doc, $setOnInsert: { id: uuidv4(), created_at: now } },
          { upsert: true }
        );
      }
      // Create session
      const token = uuidv4() + '.' + uuidv4();
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.collection(SESSIONS).insertOne({
        token, email, name, picture: '', expires_at: expires, created_at: now,
      });
      return json({ email, name, picture: '' }, 200, { setCookie: token });
    }

    if (path === '/auth/login' && method === 'POST') {
      const body = await request.json();
      const email = (body?.email || '').toString().trim().toLowerCase();
      const password = (body?.password || '').toString();
      if (!email || !password) return json({ error: 'Email e senha obrigatórios' }, 400);
      const db = await getDb();
      const user = await db.collection(USERS).findOne({ email });
      if (!user || !user.password_hash) {
        return json({ error: 'Email ou senha inválidos' }, 401);
      }
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return json({ error: 'Email ou senha inválidos' }, 401);
      // Reactivate on login
      if (user.deactivated) {
        await db.collection(USERS).updateOne({ email: user.email }, { $set: { deactivated: false }, $unset: { deactivated_at: '' } });
      }
      const token = uuidv4() + '.' + uuidv4();
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const now = new Date();
      await db.collection(SESSIONS).insertOne({
        token,
        email: user.email,
        name: user.name || email.split('@')[0],
        picture: user.picture || '',
        expires_at: expires,
        created_at: now,
      });
      return json({ email: user.email, name: user.name, picture: user.picture || '' }, 200, { setCookie: token });
    }

    if (path === '/auth/session' && method === 'POST') {
      const body = await request.json();
      const sessionId = body?.session_id;
      if (!sessionId) return json({ error: 'session_id required' }, 400);
      // Fetch profile from Emergent Auth
      const resp = await fetch(EMERGENT_AUTH_API, {
        headers: { 'X-Session-ID': sessionId },
        cache: 'no-store',
      });
      if (!resp.ok) {
        const t = await resp.text();
        return json({ error: 'Emergent auth failed', detail: t }, 401);
      }
      const profile = await resp.json();
      const email = profile.email;
      const name = profile.name || email;
      const picture = profile.picture || '';
      const sessionToken = profile.session_token || sessionId;

      const db = await getDb();
      const now = new Date();
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.collection(USERS).updateOne(
        { email },
        {
          $set: { email, name, picture, updated_at: now },
          $setOnInsert: { id: uuidv4(), created_at: now },
          $unset: { deactivated: '', deactivated_at: '' },
        },
        { upsert: true }
      );
      await db.collection(SESSIONS).updateOne(
        { token: sessionToken },
        { $set: { token: sessionToken, email, name, picture, expires_at: expires, created_at: now } },
        { upsert: true }
      );
      return json({ email, name, picture }, 200, { setCookie: sessionToken });
    }

    if (path === '/auth/me' && method === 'GET') {
      const user = await currentUser(request);
      if (!user) return json({ user: null }, 200);
      return json({ user });
    }

    if (path === '/auth/logout' && method === 'POST') {
      const token = request.cookies.get(COOKIE_NAME)?.value;
      if (token) {
        const db = await getDb();
        await db.collection(SESSIONS).deleteOne({ token });
      }
      return json({ ok: true }, 200, { clearCookie: true });
    }

    if (path === '/auth/deactivate' && method === 'POST') {
      const u = await currentUser(request);
      if (!u) return json({ error: 'Não autenticado' }, 401);
      const db = await getDb();
      await db.collection(USERS).updateOne(
        { email: u.email },
        { $set: { deactivated: true, deactivated_at: new Date() } }
      );
      await db.collection(SESSIONS).deleteMany({ email: u.email });
      return json({ ok: true, message: 'Conta desativada. Faça login novamente para reativar.' }, 200, { clearCookie: true });
    }

    if (path === '/auth/account' && method === 'DELETE') {
      const u = await currentUser(request);
      if (!u) return json({ error: 'Não autenticado' }, 401);
      const body = await request.json().catch(() => ({}));
      const confirmEmail = (body?.confirm_email || '').toString().trim().toLowerCase();
      if (confirmEmail !== u.email.toLowerCase()) {
        return json({ error: 'Confirmação incorreta. Digite exatamente seu email.' }, 400);
      }
      const db = await getDb();
      if (u.family_id) {
        const fam = await db.collection(FAMILIES).findOne({ id: u.family_id });
        if (fam) {
          const others = (fam.member_emails || []).filter(e => e !== u.email);
          if (others.length === 0) {
            await db.collection(FAMILIES).deleteOne({ id: fam.id });
            await db.collection(COL).updateMany({ family_id: fam.id }, { $set: { family_id: null } });
          } else {
            let newOwner = fam.owner_email;
            if (fam.owner_email === u.email) newOwner = others[0];
            await db.collection(FAMILIES).updateOne(
              { id: fam.id },
              { $pull: { member_emails: u.email }, $set: { owner_email: newOwner } }
            );
          }
        }
      }
      await db.collection(COL).deleteMany({ user_email: u.email });
      await db.collection(HIST).deleteMany({ user_email: u.email });
      await db.collection(PUSH_SUBS).deleteMany({ user_email: u.email });
      await db.collection(SESSIONS).deleteMany({ email: u.email });
      await db.collection(USERS).deleteOne({ email: u.email });
      return json({ ok: true, message: 'Conta excluída permanentemente.' }, 200, { clearCookie: true });
    }


    // Root (public)
    if (path === '/' || path === '') {
      return json({ ok: true, name: 'HomeMed API' });
    }

    // ============ AUTH REQUIRED FROM HERE ============
    const user = await currentUser(request);
    if (!user) return json({ error: 'Não autenticado' }, 401);
    const userEmail = user.email;

    // ============ FAMILY ============
    if (path === '/families/me' && method === 'GET') {
      if (!user.family_id) return json({ family: null });
      const db = await getDb();
      const fam = await db.collection(FAMILIES).findOne({ id: user.family_id });
      if (!fam) return json({ family: null });
      const memberDocs = await db.collection(USERS).find({ email: { $in: fam.member_emails || [] } }).toArray();
      const members = memberDocs.map(m => ({ email: m.email, name: m.name, picture: m.picture }));
      return json({ family: { id: fam.id, name: fam.name, invite_code: fam.invite_code, owner_email: fam.owner_email, members } });
    }

    if (path === '/families' && method === 'POST') {
      if (user.family_id) return json({ error: 'Você já está em uma família' }, 400);
      const body = await request.json();
      const name = (body?.name || 'Minha Família').toString().trim().slice(0, 60);
      const db = await getDb();
      const now = new Date().toISOString();
      const famId = uuidv4();
      await db.collection(FAMILIES).insertOne({
        id: famId,
        name,
        owner_email: userEmail,
        member_emails: [userEmail],
        invite_code: randomInviteCode(),
        created_at: now,
      });
      await db.collection(USERS).updateOne({ email: userEmail }, { $set: { family_id: famId, updated_at: new Date() } });
      // Migrate user's personal medicines into the family
      await db.collection(COL).updateMany(
        { user_email: userEmail, $or: [{ family_id: null }, { family_id: { $exists: false } }] },
        { $set: { family_id: famId } }
      );
      const fam = await db.collection(FAMILIES).findOne({ id: famId });
      return json({ family: { id: fam.id, name: fam.name, invite_code: fam.invite_code, owner_email: fam.owner_email, members: [{ email: userEmail, name: user.name, picture: user.picture }] } });
    }

    if (path === '/families/join' && method === 'POST') {
      if (user.family_id) return json({ error: 'Você já está em uma família' }, 400);
      const body = await request.json();
      const code = (body?.invite_code || '').toString().trim().toUpperCase();
      if (!code) return json({ error: 'Código obrigatório' }, 400);
      const db = await getDb();
      const fam = await db.collection(FAMILIES).findOne({ invite_code: code });
      if (!fam) return json({ error: 'Código inválido' }, 404);
      await db.collection(FAMILIES).updateOne({ id: fam.id }, { $addToSet: { member_emails: userEmail } });
      await db.collection(USERS).updateOne({ email: userEmail }, { $set: { family_id: fam.id } });
      return json({ family: { id: fam.id, name: fam.name, invite_code: fam.invite_code, owner_email: fam.owner_email } });
    }

    if (path === '/families/leave' && method === 'POST') {
      if (!user.family_id) return json({ error: 'Você não está em uma família' }, 400);
      const db = await getDb();
      const fam = await db.collection(FAMILIES).findOne({ id: user.family_id });
      if (!fam) {
        await db.collection(USERS).updateOne({ email: userEmail }, { $set: { family_id: null } });
        return json({ ok: true });
      }
      // If owner leaves and there are other members, transfer ownership
      let newOwner = fam.owner_email;
      if (fam.owner_email === userEmail) {
        const others = (fam.member_emails || []).filter(e => e !== userEmail);
        if (others.length > 0) newOwner = others[0];
      }
      await db.collection(FAMILIES).updateOne(
        { id: fam.id },
        { $pull: { member_emails: userEmail }, $set: { owner_email: newOwner } }
      );
      // If no members left, delete family and unlink its medicines back to personal
      const updated = await db.collection(FAMILIES).findOne({ id: fam.id });
      if (!updated?.member_emails?.length) {
        await db.collection(FAMILIES).deleteOne({ id: fam.id });
        await db.collection(COL).updateMany({ family_id: fam.id }, { $set: { family_id: null } });
      }
      await db.collection(USERS).updateOne({ email: userEmail }, { $set: { family_id: null } });
      return json({ ok: true });
    }

    if (path === '/families/regenerate-code' && method === 'POST') {
      if (!user.family_id) return json({ error: 'Sem família' }, 400);
      const db = await getDb();
      const fam = await db.collection(FAMILIES).findOne({ id: user.family_id });
      if (!fam) return json({ error: 'Família não encontrada' }, 404);
      if (fam.owner_email !== userEmail) return json({ error: 'Apenas o dono pode gerar novo código' }, 403);
      const newCode = randomInviteCode();
      await db.collection(FAMILIES).updateOne({ id: fam.id }, { $set: { invite_code: newCode } });
      return json({ invite_code: newCode });
    }

    if (segs[0] === 'families' && segs[1] === 'members' && segs.length === 3 && method === 'DELETE') {
      if (!user.family_id) return json({ error: 'Sem família' }, 400);
      const memberEmail = decodeURIComponent(segs[2]);
      const db = await getDb();
      const fam = await db.collection(FAMILIES).findOne({ id: user.family_id });
      if (!fam) return json({ error: 'Família não encontrada' }, 404);
      if (fam.owner_email !== userEmail) return json({ error: 'Apenas o dono pode remover membros' }, 403);
      if (memberEmail === userEmail) return json({ error: 'Use "sair" para remover a si mesmo' }, 400);
      await db.collection(FAMILIES).updateOne({ id: fam.id }, { $pull: { member_emails: memberEmail } });
      await db.collection(USERS).updateOne({ email: memberEmail }, { $set: { family_id: null } });
      return json({ ok: true });
    }

    // ============ PUSH SUBSCRIPTIONS ============
    if (path === '/push/subscribe' && method === 'POST') {
      const body = await request.json();
      const subscription = body?.subscription;
      if (!subscription?.endpoint) return json({ error: 'subscription obrigatório' }, 400);
      const db = await getDb();
      await db.collection(PUSH_SUBS).updateOne(
        { endpoint: subscription.endpoint },
        { $set: { endpoint: subscription.endpoint, subscription, user_email: userEmail, updated_at: new Date() } },
        { upsert: true }
      );
      return json({ ok: true });
    }

    if (path === '/push/unsubscribe' && method === 'POST') {
      const body = await request.json();
      const endpoint = body?.endpoint;
      if (endpoint) {
        const db = await getDb();
        await db.collection(PUSH_SUBS).deleteOne({ endpoint });
      }
      return json({ ok: true });
    }

    // AI enrichment (no persistence)
    if (path === '/ai/enrich' && method === 'POST') {
      const body = await request.json();
      const input = (body?.name || body?.query || '').toString().trim();
      if (!input) return json({ error: 'name obrigatório' }, 400);
      const result = await enrichMedicine(input);
      return json(result);
    }

    // AI enrichment from barcode + image (Gemini Vision)
    if (path === '/ai/enrich-barcode' && method === 'POST') {
      const body = await request.json();
      const barcode = (body?.barcode || '').toString().trim();
      const image_base64 = body?.image_base64;
      if (!barcode && !image_base64) return json({ error: 'barcode ou image_base64 obrigatório' }, 400);
      const result = await enrichFromBarcodeAndImage({ barcode, image_base64 });
      return json(result);
    }

    // Natural language query on inventory
    if (path === '/ai/ask' && method === 'POST') {
      const body = await request.json();
      const question = (body?.question || '').toString().trim();
      if (!question) return json({ error: 'question obrigatório' }, 400);
      const db = await getDb();
      const meds = await db.collection(COL).find(scopeFilter(user)).toArray();
      const answer = await answerInventoryQuestion(question, meds);
      return json({ answer });
    }

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
        await db.collection(COL).updateOne({ id, ...scopeFilter(user) }, { $set: updates });
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

    return json({ error: 'rota não encontrada', path, method }, 404);
  } catch (e) {
    console.error('API error', e);
    return json({ error: e.message || 'erro interno' }, 500);
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;

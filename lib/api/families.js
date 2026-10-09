import { getDb } from '@/lib/mongo';
import { v4 as uuidv4 } from 'uuid';
import { COL, USERS, FAMILIES, json } from '@/lib/api/common';

function randomInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

// Famílias: criar, entrar, sair, código de convite e membros.
export async function handleFamilies(request, { path, segs, method, user, userEmail }) {
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
  return null;
}

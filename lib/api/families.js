import { getDb } from '@/lib/mongo';
import { json } from '@/lib/api/common';
import { findUsersByEmails, setUserFamily } from '@/lib/data/users';
import {
  addFamilyMember, createFamily, deleteFamily, findFamilyById, findFamilyByInviteCode,
  randomInviteCode, removeFamilyMember, setInviteCode,
} from '@/lib/data/families';
import { moveMedicinesToFamily, releaseFamilyMedicines } from '@/lib/data/medicines';

const publicFamily = (fam, members) => ({
  id: fam.id, name: fam.name, invite_code: fam.invite_code, owner_email: fam.owner_email,
  ...(members ? { members } : {}),
});

// Famílias: criar, entrar, sair, código de convite e membros.
export async function handleFamilies(request, { path, segs, method, user, userEmail }) {
  if (path === '/families/me' && method === 'GET') {
    if (!user.family_id) return json({ family: null });
    const db = await getDb();
    const fam = await findFamilyById(db, user.family_id);
    if (!fam) return json({ family: null });
    const memberDocs = await findUsersByEmails(db, fam.member_emails || []);
    const members = memberDocs.map(m => ({ email: m.email, name: m.name, picture: m.picture }));
    return json({ family: publicFamily(fam, members) });
  }

  if (path === '/families' && method === 'POST') {
    if (user.family_id) return json({ error: 'Você já está em uma família' }, 400);
    const body = await request.json();
    const name = (body?.name || 'Minha Família').toString().trim().slice(0, 60);
    const db = await getDb();
    const fam = await createFamily(db, { name, ownerEmail: userEmail });
    await setUserFamily(db, userEmail, fam.id, { touch: true });
    // Migrate user's personal medicines into the family
    await moveMedicinesToFamily(db, userEmail, fam.id);
    return json({ family: publicFamily(fam, [{ email: userEmail, name: user.name, picture: user.picture }]) });
  }

  if (path === '/families/join' && method === 'POST') {
    if (user.family_id) return json({ error: 'Você já está em uma família' }, 400);
    const body = await request.json();
    const code = (body?.invite_code || '').toString().trim().toUpperCase();
    if (!code) return json({ error: 'Código obrigatório' }, 400);
    const db = await getDb();
    const fam = await findFamilyByInviteCode(db, code);
    if (!fam) return json({ error: 'Código inválido' }, 404);
    await addFamilyMember(db, fam.id, userEmail);
    await setUserFamily(db, userEmail, fam.id);
    return json({ family: publicFamily(fam) });
  }

  if (path === '/families/leave' && method === 'POST') {
    if (!user.family_id) return json({ error: 'Você não está em uma família' }, 400);
    const db = await getDb();
    const fam = await findFamilyById(db, user.family_id);
    if (!fam) {
      await setUserFamily(db, userEmail, null);
      return json({ ok: true });
    }
    // If owner leaves and there are other members, transfer ownership
    let newOwner = fam.owner_email;
    if (fam.owner_email === userEmail) {
      const others = (fam.member_emails || []).filter(e => e !== userEmail);
      if (others.length > 0) newOwner = others[0];
    }
    await removeFamilyMember(db, fam.id, userEmail, newOwner);
    // If no members left, delete family and unlink its medicines back to personal
    const updated = await findFamilyById(db, fam.id);
    if (!updated?.member_emails?.length) {
      await deleteFamily(db, fam.id);
      await releaseFamilyMedicines(db, fam.id);
    }
    await setUserFamily(db, userEmail, null);
    return json({ ok: true });
  }

  if (path === '/families/regenerate-code' && method === 'POST') {
    if (!user.family_id) return json({ error: 'Sem família' }, 400);
    const db = await getDb();
    const fam = await findFamilyById(db, user.family_id);
    if (!fam) return json({ error: 'Família não encontrada' }, 404);
    if (fam.owner_email !== userEmail) return json({ error: 'Apenas o dono pode gerar novo código' }, 403);
    const newCode = randomInviteCode();
    await setInviteCode(db, fam.id, newCode);
    return json({ invite_code: newCode });
  }

  if (segs[0] === 'families' && segs[1] === 'members' && segs.length === 3 && method === 'DELETE') {
    if (!user.family_id) return json({ error: 'Sem família' }, 400);
    const memberEmail = decodeURIComponent(segs[2]);
    const db = await getDb();
    const fam = await findFamilyById(db, user.family_id);
    if (!fam) return json({ error: 'Família não encontrada' }, 404);
    if (fam.owner_email !== userEmail) return json({ error: 'Apenas o dono pode remover membros' }, 403);
    if (memberEmail === userEmail) return json({ error: 'Use "sair" para remover a si mesmo' }, 400);
    await removeFamilyMember(db, fam.id, memberEmail);
    await setUserFamily(db, memberEmail, null);
    return json({ ok: true });
  }
  return null;
}

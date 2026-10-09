import { v4 as uuidv4 } from 'uuid';

// Acesso aos dados de famílias (coleção "families").

const FAMILIES = 'families';

export function randomInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export const findFamilyById = (db, id) => db.collection(FAMILIES).findOne({ id });
export const findFamilyByInviteCode = (db, code) => db.collection(FAMILIES).findOne({ invite_code: code });

export async function createFamily(db, { name, ownerEmail }) {
  const id = uuidv4();
  await db.collection(FAMILIES).insertOne({
    id,
    name,
    owner_email: ownerEmail,
    member_emails: [ownerEmail],
    invite_code: randomInviteCode(),
    created_at: new Date().toISOString(),
  });
  return findFamilyById(db, id);
}

export const addFamilyMember = (db, id, email) =>
  db.collection(FAMILIES).updateOne({ id }, { $addToSet: { member_emails: email } });

/** Tira o membro; `newOwner` (opcional) passa a ser o dono. */
export const removeFamilyMember = (db, id, email, newOwner) =>
  db.collection(FAMILIES).updateOne(
    { id },
    newOwner ? { $pull: { member_emails: email }, $set: { owner_email: newOwner } } : { $pull: { member_emails: email } }
  );

export const setInviteCode = (db, id, code) =>
  db.collection(FAMILIES).updateOne({ id }, { $set: { invite_code: code } });

export const deleteFamily = (db, id) => db.collection(FAMILIES).deleteOne({ id });

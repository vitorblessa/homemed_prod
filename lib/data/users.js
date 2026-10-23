import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Acesso aos dados de usuários e sessões (coleções "users" e "sessions").
// Toda função recebe o banco (db) como primeiro argumento; as rotas não
// montam consultas do Mongo por conta própria.

const USERS = 'users';
const SESSIONS = 'sessions';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------- usuários ----------

export const findUserByEmail = (db, email) => db.collection(USERS).findOne({ email });

export const findUsersByEmails = (db, emails) =>
  db.collection(USERS).find({ email: { $in: emails } }).toArray();

/** Conta com senha: cria, ou acrescenta a senha a uma conta que veio do Google. */
export async function savePasswordUser(db, { email, name, password_hash, existing, now = new Date() }) {
  const doc = { email, name, picture: '', password_hash, auth_method: 'password', updated_at: now };
  if (existing) {
    await db.collection(USERS).updateOne({ email }, { $set: doc });
  } else {
    await db.collection(USERS).updateOne(
      { email },
      { $set: doc, $setOnInsert: { id: uuidv4(), created_at: now } },
      { upsert: true }
    );
  }
}

/** Login com Google: cria ou atualiza a conta e a reativa se estava desativada. */
export const upsertGoogleUser = (db, { email, name, picture, now = new Date() }) =>
  db.collection(USERS).updateOne(
    { email },
    {
      $set: { email, name, picture, updated_at: now },
      $setOnInsert: { id: uuidv4(), created_at: now },
      $unset: { deactivated: '', deactivated_at: '' },
    },
    { upsert: true }
  );

export const reactivateUser = (db, email) =>
  db.collection(USERS).updateOne({ email }, { $set: { deactivated: false }, $unset: { deactivated_at: '' } });

export const deactivateUser = (db, email) =>
  db.collection(USERS).updateOne({ email }, { $set: { deactivated: true, deactivated_at: new Date() } });

export const deleteUser = (db, email) => db.collection(USERS).deleteOne({ email });

/** Guarda o hash do link de redefinição (o link em si nunca é guardado). */
export const saveResetRequest = (db, email, { hash, expiresAt, requestedAt = new Date() }) =>
  db.collection(USERS).updateOne(
    { email },
    { $set: { reset_token_hash: hash, reset_expires_at: expiresAt, reset_requested_at: requestedAt } }
  );

/** Troca a senha se o link for válido e ainda não expirou; consome o link (uso único). Devolve a conta ou null. */
export const consumeResetToken = (db, hash, { password_hash }) =>
  db.collection(USERS).findOneAndUpdate(
    { reset_token_hash: hash, reset_expires_at: { $gt: new Date() } },
    {
      $set: { password_hash, updated_at: new Date() },
      $unset: { reset_token_hash: '', reset_expires_at: '', reset_requested_at: '' },
    }
  );

/** familyId = null tira a pessoa da família. */
export const setUserFamily = (db, email, familyId, { touch = false } = {}) =>
  db.collection(USERS).updateOne(
    { email },
    { $set: touch ? { family_id: familyId, updated_at: new Date() } : { family_id: familyId } }
  );

// ---------- preferências ----------

export async function getUserSettings(db, email) {
  const doc = await db.collection(USERS).findOne({ email });
  return doc?.settings || {};
}

/** `set` usa chaves com ponto, ex.: { 'settings.theme': 'dark' }. */
export const updateUserSettings = (db, email, set) =>
  db.collection(USERS).updateOne({ email }, { $set: set });

// ---------- sessões ----------

/** Abre uma sessão de 7 dias e devolve o token (vai para o cookie). */
// O banco guarda só o SHA-256 do identificador da sessão (campo "token" com
// hashed: true). Quem vazar o banco não consegue usar o valor como cookie.
// Sessões antigas, guardadas em texto (sem "hashed"), continuam valendo até
// expirar (no máximo 7 dias) para ninguém ser deslogado.
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

export async function createSession(db, { email, name, picture = '', now = new Date() }) {
  const token = uuidv4() + '.' + uuidv4();
  await db.collection(SESSIONS).insertOne({
    token: hashToken(token), hashed: true, email, name, picture,
    expires_at: new Date(now.getTime() + SESSION_TTL_MS),
    created_at: now,
  });
  return token;
}

export async function findSession(db, token) {
  const hashed = await db.collection(SESSIONS).findOne({ token: hashToken(token), hashed: true });
  if (hashed) return hashed;
  return db.collection(SESSIONS).findOne({ token: String(token), hashed: { $exists: false } });
}

export async function deleteSession(db, token) {
  await db.collection(SESSIONS).deleteOne({ token: hashToken(token), hashed: true });
  await db.collection(SESSIONS).deleteOne({ token: String(token), hashed: { $exists: false } });
}
export const deleteSessionsOf = (db, email) => db.collection(SESSIONS).deleteMany({ email });

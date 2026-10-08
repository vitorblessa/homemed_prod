// Fixed-window attempt counter kept in MongoDB, so it works across the
// serverless instances Vercel spins up (an in-memory counter would reset on
// every cold start). Old windows are deleted by a TTL index.
//
// Fails open: if the counter itself errors, the request is allowed rather
// than locking everybody out of the app.

const COLLECTION = 'rate_limits';
let indexReady = false;

function ensureIndex(db) {
  if (indexReady) return;
  indexReady = true;
  db.collection(COLLECTION)
    .createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 })
    .catch(() => { indexReady = false; });
}

export function clientIp(request) {
  const h = request.headers;
  const forwarded = (h.get('x-forwarded-for') || '').split(',')[0].trim();
  return h.get('x-real-ip') || forwarded || 'unknown';
}

/**
 * Counts one attempt for `key` and says whether it is still within `limit`
 * attempts per `windowMs`. Returns { allowed, retryAfterSec }.
 */
export async function hit(db, key, limit, windowMs, now = Date.now()) {
  try {
    ensureIndex(db);
    const bucket = Math.floor(now / windowMs);
    const windowEnd = (bucket + 1) * windowMs;
    const r = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: `${key}:${bucket}` },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(windowEnd + 60_000) } },
      { upsert: true, returnDocument: 'after' }
    );
    const doc = r && r.value !== undefined ? r.value : r;
    const count = doc?.count || 1;
    return { allowed: count <= limit, retryAfterSec: Math.max(1, Math.ceil((windowEnd - now) / 1000)) };
  } catch (e) {
    console.warn('[rate-limit] counter failed, allowing request', e?.message);
    return { allowed: true, retryAfterSec: 0 };
  }
}

/** Forgets the current window for `key` (e.g. after a successful login). */
export async function clear(db, key, windowMs, now = Date.now()) {
  try {
    const bucket = Math.floor(now / windowMs);
    await db.collection(COLLECTION).deleteOne({ _id: `${key}:${bucket}` });
  } catch { /* ignore */ }
}

export function tooManyMessage(retryAfterSec) {
  const min = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Muitas tentativas. Tente novamente em ${min} minuto${min === 1 ? '' : 's'}.`;
}

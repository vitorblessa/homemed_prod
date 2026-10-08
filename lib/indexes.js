// Indexes the app's queries rely on. Created once per server instance, in the
// background; createIndex is idempotent (a no-op when the index already
// exists), and a failure on one index (e.g. old duplicate data blocking a
// unique one) is only logged, so it never breaks a request.

const INDEXES = [
  // Sign-in and every request look the user up by e-mail.
  ['users', { email: 1 }, { unique: true }],
  ['users', { reset_token_hash: 1 }, { sparse: true }],
  // Every request resolves the session cookie; sessions of an account are
  // revoked by e-mail; expired sessions are removed automatically.
  ['sessions', { token: 1 }, { unique: true }],
  ['sessions', { email: 1 }, {}],
  ['sessions', { expires_at: 1 }, { expireAfterSeconds: 0 }],
  // The medicine list, per owner or per family, newest first.
  ['medicines', { user_email: 1, created_at: -1 }, {}],
  ['medicines', { family_id: 1, created_at: -1 }, {}],
  ['medicines', { id: 1 }, {}],
  ['history', { medicine_id: 1, created_at: -1 }, {}],
  ['history', { user_email: 1 }, {}],
  ['families', { id: 1 }, { unique: true }],
  ['families', { invite_code: 1 }, {}],
];

let started = false;

export function ensureIndexes(db) {
  if (started) return;
  started = true;
  (async () => {
    // Web-push was never wired up to send anything; drop the leftover
    // subscriptions (personal data with no use). Safe to repeat: a missing
    // collection just errors, which is ignored.
    await db.collection('push_subscriptions').drop().catch(() => {});
    for (const [collection, keys, options] of INDEXES) {
      try {
        await db.collection(collection).createIndex(keys, { background: true, ...options });
      } catch (e) {
        console.warn(`[indexes] ${collection} ${JSON.stringify(keys)} not created: ${e?.message}`);
      }
    }
  })();
}

export { INDEXES };

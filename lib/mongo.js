import { MongoClient } from 'mongodb';
import { ensureIndexes } from './indexes';

const uri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || 'homemed';

let cached = global._mongoClient;
if (!cached) {
  cached = global._mongoClient = { client: null, promise: null };
}

export async function getDb() {
  if (!cached.promise) {
    cached.client = new MongoClient(uri, { maxPoolSize: 10 });
    cached.promise = cached.client.connect();
  }
  const client = await cached.promise;
  const db = client.db(dbName);
  ensureIndexes(db);
  return db;
}

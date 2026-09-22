import { MongoClient } from 'mongodb';

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
  return client.db(dbName);
}

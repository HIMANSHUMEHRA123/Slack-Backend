/**
 * Migration Script: PostgreSQL → MongoDB
 *
 * Reads all users from your existing PostgreSQL (Supabase) database
 * and inserts them into MongoDB.
 *
 * Usage:
 *   npx ts-node scripts/migrate-pg-to-mongo.ts
 *
 * Prerequisites:
 *   npm install pg (for this script only)
 *
 * Environment variables required:
 *   PG_CONNECTION_URL  – Your old PostgreSQL connection string
 *   MONGODB_URI        – Your new MongoDB connection string
 */

import { MongoClient } from 'mongodb';

// ─── Configuration ────────────────────────────────────────
const PG_CONNECTION_URL =
  process.env.PG_CONNECTION_URL ||
  'postgresql://postgres.gpmmustltyyynnzdvqse:gs8bJzbhhDOj6A3H@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/slack-clone';

async function migrate() {
  console.log('🔄 Starting migration: PostgreSQL → MongoDB\n');

  // ─── 1. Connect to PostgreSQL ─────────────────────────
  // Dynamic import so pg doesn't need to be in the main dependencies
  const { default: pg } = await import('pg');
  const pgClient = new pg.Client({ connectionString: PG_CONNECTION_URL });
  await pgClient.connect();
  console.log('✅ Connected to PostgreSQL');

  // ─── 2. Fetch all users ───────────────────────────────
  const result = await pgClient.query('SELECT * FROM users ORDER BY "createdAt" ASC');
  const users = result.rows;
  console.log(`📦 Found ${users.length} user(s) in PostgreSQL\n`);

  if (users.length === 0) {
    console.log('ℹ️  No users to migrate. Exiting.');
    await pgClient.end();
    return;
  }

  // ─── 3. Connect to MongoDB ────────────────────────────
  const mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  const db = mongoClient.db();
  const usersCollection = db.collection('users');
  console.log('✅ Connected to MongoDB');

  // ─── 4. Transform & Insert ────────────────────────────
  const mongoUsers = users.map((u: any) => ({
    email: u.email,
    password: u.password,       // Already hashed in PostgreSQL
    full_name: u.full_name,
    username: u.username,
    avatar_url: u.avatar_url || undefined,
    bio: u.bio || undefined,
    createdAt: new Date(u.createdAt),
    updatedAt: new Date(u.updatedAt),
    _pgId: u.id,                // Keep old UUID for reference
  }));

  const insertResult = await usersCollection.insertMany(mongoUsers);
  console.log(`\n✅ Migrated ${insertResult.insertedCount} user(s) to MongoDB`);

  // ─── 5. Verify ────────────────────────────────────────
  const count = await usersCollection.countDocuments();
  console.log(`📊 Total documents in 'users' collection: ${count}`);

  // ─── 6. Cleanup ───────────────────────────────────────
  await pgClient.end();
  await mongoClient.close();
  console.log('\n🎉 Migration complete!');
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

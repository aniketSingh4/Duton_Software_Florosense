import dotenv from "dotenv";
dotenv.config();

import { MongoClient } from "mongodb";

const SOURCE_URI = process.env.NEW_DB_URL;
const TARGET_URI = process.env.MONGO_URI;

if (!SOURCE_URI || !TARGET_URI) {
  throw new Error("MongoDB URIs are missing in .env");
}

const DB_NAME = "duton";

// Collections to MERGE with custom unique keys
const MERGE_RULES = {
  users: "email",
  user_sensors: "sensor_id",
  sensors: "sensor_id",
};

const BATCH_SIZE = 1000;

async function migrate() {
  const sourceClient = new MongoClient(SOURCE_URI);
  const targetClient = new MongoClient(TARGET_URI);

  await sourceClient.connect();
  await targetClient.connect();

  const sourceDB = sourceClient.db(DB_NAME);
  const targetDB = targetClient.db(DB_NAME);

  const collections = await sourceDB.listCollections().toArray();

  for (const { name } of collections) {
    console.log(`\nProcessing collection: ${name}`);

    const sourceCol = sourceDB.collection(name);
    const targetCol = targetDB.collection(name);

    const cursor = sourceCol.find();
    let batch = [];
    let inserted = 0;
    let skipped = 0;

    while (await cursor.hasNext()) {
      batch.push(await cursor.next());

      if (batch.length === BATCH_SIZE) {
        const result = await processBatch(name, batch, targetCol);
        inserted += result.inserted;
        skipped += result.skipped;
        batch = [];
      }
    }

    if (batch.length) {
      const result = await processBatch(name, batch, targetCol);
      inserted += result.inserted;
      skipped += result.skipped;
    }

    console.log(`Inserted: ${inserted}, Skipped: ${skipped}`);
  }

  await sourceClient.close();
  await targetClient.close();

  console.log("\n✅ Migration completed successfully");
}

async function processBatch(collectionName, docs, targetCol) {
  // MERGE collections using custom unique key
  if (MERGE_RULES[collectionName]) {
    const uniqueKey = MERGE_RULES[collectionName];

    const ops = docs
      .filter(d => d[uniqueKey]) // safety check
      .map(doc => ({
        updateOne: {
          filter: { [uniqueKey]: doc[uniqueKey] },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      }));

    if (!ops.length) return { inserted: 0, skipped: docs.length };

    const result = await targetCol.bulkWrite(ops, { ordered: false });

    return {
      inserted: result.upsertedCount,
      skipped: docs.length - result.upsertedCount,
    };
  }

  // COPY all other collections (_id based)
  try {
    const result = await targetCol.insertMany(docs, { ordered: false });
    return { inserted: result.insertedCount, skipped: 0 };
  } catch (err) {
    if (err.code === 11000 || err.writeErrors) {
      const inserted =
        err.result?.nInserted ?? err.insertedDocs?.length ?? 0;

      return {
        inserted,
        skipped: docs.length - inserted,
      };
    }
    throw err;
  }
}

migrate().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});

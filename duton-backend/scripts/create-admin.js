// Script to create default admin if it doesn't exist
import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URL = process.env.NEW_DB_URL;
const DB_NAME = process.env.TICKET_DB_NAME || "duton_tickets";

async function createDefaultAdmin() {
  if (!MONGO_URL) {
    console.error("NEW_DB_URL not set in environment variables");
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    
    const db = client.db(DB_NAME);
    const adminsCollection = db.collection("admins");
    
    // Check if admin already exists
    const existingAdmin = await adminsCollection.findOne({ username: "admin" });
    if (existingAdmin) {
      console.log("   Admin already exists:");
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Active: ${existingAdmin.is_active}`);
      return;
    }
    
    // Check if any admin exists
    const adminCount = await adminsCollection.countDocuments({});
    if (adminCount > 0) {
      console.log(`ℹ️  ${adminCount} admin(s) already exist in database`);
      const admins = await adminsCollection.find({}).toArray();
      admins.forEach(admin => {
        console.log(`   - ${admin.username} (${admin.email})`);
      });
      return;
    }
    
    // Create default admin
    const defaultPassword = "admin123";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    
    const adminId = uuidv4();
    const now = new Date();
    
    const defaultAdmin = {
      _id: adminId,
      username: "admin",
      email: "admin@duton.com",
      password_hash: passwordHash,
      full_name: "System Administrator",
      role: "admin",
      is_active: true,
      created_at: now,
      last_login: null,
    };
    
    await adminsCollection.insertOne(defaultAdmin);
    
    console.log("   Default admin created successfully!");
    console.log("   Username: admin");
    console.log("   Password: admin123");
    console.log("   Email: admin@duton.com");
    console.log("   IMPORTANT: Change this password immediately after first login!");
    
  } catch (error) {
    console.error("Error creating admin:", error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log(" Database connection closed");
  }
}

createDefaultAdmin();


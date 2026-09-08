// Script to set admin password to your choice
import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URL = process.env.NEW_DB_URL;
const DB_NAME = process.env.TICKET_DB_NAME || "duton_tickets";
const USERNAME = process.argv[2] || "admin";
const NEW_PASSWORD = process.argv[3];

async function setPassword() {
  if (!NEW_PASSWORD) {
    console.error(" Error: Password is required");
    console.log("\nUsage: node scripts/set-admin-password.js [username] [password]");
    console.log("Example: node scripts/set-admin-password.js admin MySecurePassword123");
    process.exit(1);
  }

  if (NEW_PASSWORD.length < 6) {
    console.error(" Error: Password must be at least 6 characters long");
    process.exit(1);
  }

  if (!MONGO_URL) {
    console.error(" NEW_DB_URL not set in environment variables");
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    
    const db = client.db(DB_NAME);
    const adminsCollection = db.collection("admins");
    
    // Find admin
    const admin = await adminsCollection.findOne({ username: USERNAME });
    if (!admin) {
      console.error(`Admin with username "${USERNAME}" not found`);
      process.exit(1);
    }
    
    console.log(` Found admin: ${admin.username} (${admin.email})`);
    
    // Generate new password hash
    console.log("\n Hashing password...");
    const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);
    
    // Update password
    console.log("Saving password to database...");
    const result = await adminsCollection.updateOne(
      { username: USERNAME },
      { $set: { password_hash: passwordHash } }
    );
    
    if (result.modifiedCount === 0) {
      console.error("Failed to update password");
      process.exit(1);
    }
    
    // Verify the password was saved correctly
    console.log(" Verifying password was saved correctly...");
    const updatedAdmin = await adminsCollection.findOne({ username: USERNAME });
    const passwordMatches = await bcrypt.compare(NEW_PASSWORD, updatedAdmin.password_hash);
    
    if (!passwordMatches) {
      console.error(" ERROR: Password verification failed after saving!");
      console.error("   This should not happen. Please try again.");
      process.exit(1);
    }
    
    console.log("\n Password set successfully!");
    console.log(`   Username: ${USERNAME}`);
    console.log(`   Password: ${NEW_PASSWORD}`);
    console.log(`   Password verified and working`);
    console.log("\n💡 You can now login with these credentials");
    
  } catch (error) {
    console.error(" Error setting password:", error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log("\n Database connection closed");
  }
}

setPassword();


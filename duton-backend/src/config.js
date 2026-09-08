import dotenv from "dotenv";

import path from "path";
import { fileURLToPath } from "url";

// Load backend env file regardless of the current working directory.
const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env");
dotenv.config({ path: envPath });

class Settings {
  constructor() {
    this.APP_NAME = process.env.TICKET_APP_NAME || "Duton Ticket API";
    this.HOST = process.env.TICKET_HOST || process.env.HOST || "127.0.0.1";
    this.PORT = parseInt(process.env.TICKET_PORT || process.env.PORT || "8001", 10);
    this.DEBUG = (process.env.TICKET_DEBUG || process.env.DEBUG || "false").toLowerCase() === "true";
    this.NODE_ENV = process.env.NODE_ENV || "development";

    this.MONGO_URL = process.env.NEW_DB_URL || process.env.MONGO_URL;
    if (!this.MONGO_URL) {
      throw new Error("NEW_DB_URL (Mongo connection string) must be set for the ticket backend.");
    }

    this.MONGO_DB_NAME = process.env.TICKET_DB_NAME || process.env.MONGO_DB_NAME || "duton";
    this.TICKETS_COLLECTION = process.env.TICKET_COLLECTION || "support_tickets";
    this.REPLIES_COLLECTION = process.env.TICKET_REPLY_COLLECTION || "ticket_replies";

    // Email API configuration used by `src/utils/emailService.js`.
    this.EMAIL_API_URL = process.env.EMAIL_API_URL || "https://smtp.florosense.cloud/send-email";
    this.EMAIL_API_TOKEN =
      process.env.EMAIL_API_TOKEN ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiNjY2ZWU4ZWY0YjkyOWYwN2E3M2Q3MmUzIn0sImlhdCI6MTcxOTQxODg0MH0.JyshxUgJohnFGcT5GDiwoUTXXZt4nyi5RSDdI7y8K9g";

    // SendGrid - OTP, magic link and assignee credential emails
    this.SENDGRID_API_KEY_ID = process.env.SENDGRID_API_KEY_ID || "";
    this.SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
    this.SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "no-reply@duton.com";
    this.SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || "Duton Ticket System";

    // SMTP (Brevo relay) - sensor alert and ticket notification emails
    this.SMTP_HOST = process.env.SMTP_HOST || "";
    this.SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 587;
    this.SMTP_SECURE = process.env.SMTP_SECURE === "true"; // true only for port 465
    this.SMTP_USER = process.env.SMTP_USER || "";
    this.SMTP_PASS = process.env.SMTP_PASS || "";
    this.SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "alerts@florosense.com";
    this.SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "Alert Notifications";
    this.TICKET_ASSIGNMENT_LOG_FILE = process.env.TICKET_ASSIGNMENT_LOG_FILE || "data/ticket-assignment-log.xlsx";
    // Runs daily at 03:15 PM and 06:00 PM in configured timezone.
    this.TICKET_ASSIGNMENT_CRON = "00 10 * * *";
    this.TICKET_REMINDER_CRON = "0 18 * * *";
    this.TICKET_CRON_TIMEZONE = process.env.TICKET_CRON_TIMEZONE || "Asia/Kolkata";

    this.JWT_SECRET = process.env.JWT_SECRET || process.env.TICKET_JWT_SECRET || "your-secret-key-change-in-production";

    this.CALIBRATION_API_KEY = process.env.CALIBRATION_API_KEY || "default-calibration-api-key-change-in-production";

    this.FLOROSENSE_BASE_URL = process.env.NEXT_PUBLIC_FLOROSENSE_API_URL || process.env.FLOROSENSE_BASE_URL || process.env.FLOROSENSE_API_URL;
    this.FLOROSENSE_API_KEY = process.env.NEXT_PUBLIC_FLOROSENSE_API_KEY || process.env.FLOROSENSE_API_KEY;

    if (!this.FLOROSENSE_BASE_URL) {
      throw new Error("FLOROSENSE_BASE_URL (or NEXT_PUBLIC_FLOROSENSE_API_URL) must be set in environment variables.");
    }

    if (!this.FLOROSENSE_API_KEY) {
      throw new Error("FLOROSENSE_API_KEY (or NEXT_PUBLIC_FLOROSENSE_API_KEY) must be set in environment variables.");
    }

    this.validate();
  }

  validate() {
    if (this.NODE_ENV === "production") {
      const sensitiveVars = {
        JWT_SECRET: this.JWT_SECRET,
        CALIBRATION_API_KEY: this.CALIBRATION_API_KEY,
        MONGO_URL: this.MONGO_URL,
      };

      const defaults = [
        "your-secret-key-change-in-production",
        "default-calibration-api-key-change-in-production",
      ];

      for (const [key, value] of Object.entries(sensitiveVars)) {
        if (!value || defaults.includes(value)) {
          throw new Error(`SECURITY CRITICAL: ${key} is using a default value or is missing in production environment.`);
        }
      }
    }
  }
}

let settingsInstance = null;

export function getSettings() {
  if (!settingsInstance) {
    settingsInstance = new Settings();
  }
  return settingsInstance;
}


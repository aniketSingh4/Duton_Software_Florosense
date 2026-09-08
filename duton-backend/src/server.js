import express from "express";
import cors from "cors";
import helmet from "helmet";
import os from "os";
import { getSettings } from "./config.js";
import * as database from "./services/database.js";
import { startSensorReadingCollector, stopSensorReadingCollector } from "./services/sensorReadingCollector.js";
import { startTicketAssignmentScheduler, stopTicketAssignmentScheduler } from "./services/ticketAssignmentScheduler.js";
import { startAlertMonitor, stopAlertMonitor } from "./services/alertMonitor.js";
import ticketsRouter from "./routes/tickets.js";
import adminRouter from "./routes/admin.js";
import usersRouter from "./routes/users.js";
import sensorsRouter from "./routes/sensors.js";
import assigneeRouter from "./routes/assignee.js";
import sitesRouter from "./routes/sites.js";
import calibrationRouter from "./routes/calibration.js";
import alertsRouter from "./routes/alerts.js";
import amcRouter from "./routes/amc.js";
const settings = getSettings();


const app = express();

// Security Middleware
app.use(helmet()); // Set security-related HTTP headers
app.set("trust proxy", 1); // Trust first proxy (Nginx)

// Middleware - CORS configuration
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const fallbackAllowedOrigins = ["*"];
const normalizeOrigin = (value = "") => value.replace(/\/$/, "");

const isOriginAllowed = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);
  const effectiveOrigins = [...allowedOrigins, ...fallbackAllowedOrigins];

  return effectiveOrigins.some((allowedOrigin) => {
    const normalizedAllowed = normalizeOrigin(allowedOrigin);

    if (normalizedAllowed === "*") return true;

    if (normalizedAllowed.includes("*")) {
      const escaped = normalizedAllowed
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");
      const pattern = new RegExp(`^${escaped}$`);
      return pattern.test(normalizedOrigin);
    }

    return normalizedAllowed === normalizedOrigin;
  });
};

const corsOptions = {
  // Allow only configured origins plus trusted production fallback domains.
  origin: (origin, callback) => {
    // Non-browser requests (no Origin header) should still work.
    if (!origin) return callback(null, true);
    return callback(null, isOriginAllowed(origin));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-API-KEY"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Ensure preflight requests are handled for all routes.
app.options("*", cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/tickets", ticketsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/users", usersRouter);
app.use("/api/sensors", sensorsRouter);
app.use("/api/assignee", assigneeRouter);
app.use("/api/sites", sitesRouter);
app.use("/api/admin/calibration", calibrationRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/amc", amcRouter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    detail: err.message || "Internal server error",
  });
});

// Connect to database on startup
async function start() {
  try {
    await database.connect();
    console.log("✅ Connected to MongoDB successfully");

    // Initialize default admin if no admins exist
    try {
      await database.initializeDefaultAdmin();
    } catch (error) {
      console.error("  ERROR: Could not initialize default admin:", error);
      console.error("   Error details:", error.message);
      console.error("   Stack:", error.stack);
    }

    // Start background sensor reading collector
    try {
      startSensorReadingCollector();
    } catch (error) {
      console.error("ERROR: Could not start sensor reading collector:", error);
      console.error("Error details:", error.message);
    }

    try {
      startTicketAssignmentScheduler();
    } catch (error) {
      console.error("ERROR: Could not start ticket assignment scheduler:", error);
      console.error("Error details:", error.message);
    }

    // Start automated alert notification monitor (offline / abnormal readings)
    try {
      startAlertMonitor();
    } catch (error) {
      console.error("ERROR: Could not start alert monitor:", error);
      console.error("Error details:", error.message);
    }

    const server = app.listen(settings.PORT, settings.HOST, () => {
      // Get network IP address
      const networkInterfaces = os.networkInterfaces();
      let networkIP = null;

      // Find the first non-internal IPv4 address
      for (const interfaceName of Object.keys(networkInterfaces)) {
        const addresses = networkInterfaces[interfaceName];
        for (const addr of addresses) {
          if (addr.family === 'IPv4' && !addr.internal) {
            networkIP = addr.address;
            break;
          }
        }
        if (networkIP) break;
      }

      // Display both localhost and network IP
      console.log(`${settings.APP_NAME} is running:`);
      console.log(`  Local:   http://localhost:${settings.PORT}`);
      console.log(`  Local:   http://127.0.0.1:${settings.PORT}`);
      if (networkIP) {
        console.log(`  Network: http://${networkIP}:${settings.PORT}`);
      }
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log("Shutting down gracefully...");
      stopSensorReadingCollector();
      stopTicketAssignmentScheduler();
      stopAlertMonitor();
      server.close(async () => {
        await database.disconnect();
        console.log("Database connection closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();


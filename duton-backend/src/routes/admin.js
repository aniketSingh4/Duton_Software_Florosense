import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import ExcelJS from "exceljs";
import * as database from "../services/database.js";
import { getSettings } from "../config.js";
import { generateOTP, sendOTPEmail } from "../utils/emailService.js";
import { validateEmail } from "../models/index.js";
import { generateAdminToken, verifyAdminToken, verifyUserToken, verifyAdminOrAssigneeToken } from "../middleware/auth.js";

const router = express.Router();
const settings = getSettings();

// Re-export verifyAdminToken for backward compatibility
export { verifyAdminToken } from "../middleware/auth.js";

// GET /admin/check - Check if default admin exists (for debugging)
router.get("/check", async (req, res, next) => {
  try {
    const allAdmins = await database.getAllAdmins();
    const defaultAdmin = await database.getAdminByUsername("admin");
    
    res.json({
      total_admins: allAdmins.length,
      default_admin_exists: defaultAdmin !== null,
      default_admin_details: defaultAdmin ? {
        username: defaultAdmin.username,
        email: defaultAdmin.email,
        is_active: defaultAdmin.is_active,
        created_at: defaultAdmin.created_at,
        has_id_field: !!defaultAdmin.id,
        has_id_underscore: !!defaultAdmin._id
      } : null,
      all_admins: allAdmins.map(a => ({ username: a.username, email: a.email }))
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/login - Admin login
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        detail: "Username and password are required",
      });
    }

    // Get admin from database
    const admin = await database.getAdminByUsername(username);
    if (!admin) {
      return res.status(401).json({
        detail: "Invalid username or password",
      });
    }

    // Check if admin is active
    if (admin.is_active === false) {
      return res.status(403).json({
        detail: "Admin account is deactivated",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        detail: "Invalid username or password",
      });
    }

    // Update last login
    await database.updateAdminLastLogin(username);

    // Generate JWT token
    const token = generateAdminToken(admin);

    // Handle both ObjectId _id and UUID id field
    const adminId = admin.id || (admin._id ? (typeof admin._id === 'string' ? admin._id : admin._id.toString()) : null);

    // Return admin info (without password) and token
    res.json({
      token,
      admin: {
        id: adminId,
        username: admin.username,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role || "admin",
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/register - Register new admin
// If no admins exist, registration is public. Otherwise, requires admin token.
router.post("/register", async (req, res, next) => {
  try {
    const { username, email, password, full_name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        detail: "Username, email, and password are required",
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        detail: "Password must be at least 6 characters long",
      });
    }

    // Check if any admins exist
    const allAdmins = await database.getAllAdmins();
    const hasAdmins = allAdmins.length > 0;

    // If admins exist, require authentication
    if (hasAdmins) {
      // Verify token
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res.status(401).json({
            detail: "Admin token required to create additional admins",
            hint: "Login as admin first, then use the token to create new admins"
          });
        }

        const token = authHeader.substring(7).trim();
        const jwt = await import("jsonwebtoken");
        const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Verify the admin exists and is active
        const admin = await database.getAdminByUsername(decoded.username);
        if (!admin || admin.is_active === false) {
          return res.status(401).json({
            detail: "Invalid admin token",
          });
        }
      } catch (tokenError) {
        return res.status(401).json({
          detail: "Invalid or expired admin token",
          hint: "Login as admin first to get a valid token"
        });
      }
    }

    // Check if username already exists
    const existingUsername = await database.getAdminByUsername(username);
    if (existingUsername) {
      return res.status(400).json({
        detail: "Username already exists",
      });
    }

    // Check if email already exists
    const existingEmail = await database.getAdminByEmail(email);
    if (existingEmail) {
      return res.status(400).json({
        detail: "Email already exists",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin
    const adminData = {
      username,
      email,
      password_hash: passwordHash,
      full_name: full_name || username,
      role: "admin",
      is_active: true,
    };

    const newAdmin = await database.createAdmin(adminData);

    // Handle both ObjectId _id and UUID id field
    const adminId = newAdmin.id || (newAdmin._id ? (typeof newAdmin._id === 'string' ? newAdmin._id : newAdmin._id.toString()) : null);

    res.status(201).json({
      message: hasAdmins ? "Admin created successfully" : "First admin created successfully",
      admin: {
        id: adminId,
        username: newAdmin.username,
        email: newAdmin.email,
        full_name: newAdmin.full_name,
        role: newAdmin.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/verify - Verify token and get admin info
router.get("/verify", verifyAdminToken, async (req, res, next) => {
  try {
    const admin = await database.getAdminByUsername(req.admin.username);
    if (!admin || admin.is_active === false) {
      return res.status(401).json({
        detail: "Admin not found or deactivated",
      });
    }

    // Handle both ObjectId _id and UUID id field
    const adminId = admin.id || (admin._id ? (typeof admin._id === 'string' ? admin._id : admin._id.toString()) : null);

    res.json({
      admin: {
        id: adminId,
        username: admin.username,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role || "admin",
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/debug-token - Debug token (for troubleshooting, no auth required)
router.post("/debug-token", async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        detail: "Token is required",
        hint: "Send token in request body: { 'token': 'your-token-here' }"
      });
    }

    try {
      // Try to decode without verification first
      const decodedWithoutVerify = jwt.decode(token, { complete: true });
      
      if (!decodedWithoutVerify) {
        return res.json({
          valid: false,
          error: "Token cannot be decoded - invalid format",
          token_preview: token.substring(0, 50) + "..."
        });
      }

      // Try to verify
      const decoded = jwt.verify(token, JWT_SECRET);
      
      return res.json({
        valid: true,
        decoded: decoded,
        expires_at: decodedWithoutVerify.payload.exp ? new Date(decodedWithoutVerify.payload.exp * 1000).toISOString() : "No expiration",
        is_expired: decodedWithoutVerify.payload.exp ? decodedWithoutVerify.payload.exp < Date.now() / 1000 : false,
        header: decodedWithoutVerify.header
      });
    } catch (error) {
      return res.json({
        valid: false,
        error: error.message,
        error_name: error.name,
        decoded_info: jwt.decode(token, { complete: true }),
        hint: error.name === "TokenExpiredError" ? "Token has expired - login again" : 
               error.name === "JsonWebTokenError" ? "Token signature invalid - may be from different server/secret" :
               "Unknown error"
      });
    }
  } catch (error) {
    next(error);
  }
});

// GET /admin/list - List all admins (protected route)
router.get("/list", verifyAdminToken, async (req, res, next) => {
  try {
    const admins = await database.getAllAdmins();
    res.json(admins);
  } catch (error) {
    next(error);
  }
});

// POST /admin/change-password - Change admin password (protected route)
router.post("/change-password", verifyAdminToken, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        detail: "Current password and new password are required",
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        detail: "New password must be at least 6 characters long",
      });
    }

    // Get admin
    const admin = await database.getAdminByUsername(req.admin.username);
    if (!admin) {
      return res.status(404).json({
        detail: "Admin not found",
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, admin.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        detail: "Current password is incorrect",
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // Update password
    await database.updateAdminPassword(req.admin.username, newPasswordHash);

    res.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/forgot-password - Request password reset OTP
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        detail: "Email is required",
      });
    }

    // Check if admin exists with this email
    const admin = await database.getAdminByEmail(email);
    if (!admin) {
      // Return success even if admin doesn't exist (security best practice)
      return res.json({
        success: true,
        message: "If the email exists in our system, you will receive an OTP shortly.",
      });
    }

    // Check if admin is active
    if (admin.is_active === false) {
      return res.status(403).json({
        detail: "Admin account is deactivated",
      });
    }

    // Generate OTP
    const otp = generateOTP(6);

    // Store OTP in database (expires in 10 minutes)
    await database.storeOTP(email, otp, 10);

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp);

    if (!emailSent) {
      return res.status(500).json({
        detail: "Failed to send OTP email. Please try again later.",
      });
    }

    res.json({
      success: true,
      message: "OTP sent successfully. Please check your email.",
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/verify-otp - Verify OTP for password reset
router.post("/verify-otp", async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        detail: "Email and OTP are required",
      });
    }

    // Verify OTP
    const isValid = await database.verifyOTP(email, otp);

    if (!isValid) {
      return res.status(401).json({
        detail: "Invalid or expired OTP",
      });
    }

    res.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/reset-password - Reset password using verified OTP
router.post("/reset-password", async (req, res, next) => {
  try {
    const { email, otp, new_password } = req.body;

    if (!email || !otp || !new_password) {
      return res.status(400).json({
        detail: "Email, OTP, and new password are required",
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        detail: "New password must be at least 6 characters long",
      });
    }

    // Verify OTP first
    const isValidOTP = await database.verifyOTP(email, otp);
    if (!isValidOTP) {
      return res.status(401).json({
        detail: "Invalid or expired OTP",
      });
    }

    // Get admin
    const admin = await database.getAdminByEmail(email);
    if (!admin) {
      return res.status(404).json({
        detail: "Admin not found",
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // Update password
    await database.updateAdminPassword(admin.username, newPasswordHash);

    // Delete any remaining OTPs for this email
    await database.deleteOTP(email);

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// CLIENT MANAGEMENT ROUTES (Admin only)
// =============================================================================

// GET /admin/clients - Get all client users
router.get("/clients", verifyAdminToken, async (req, res, next) => {
  try {
    const filters = {
      role: "client",
      is_active: req.query.is_active !== undefined ? req.query.is_active === "true" : undefined,
      search: req.query.search || null,
    };
    const clients = await database.getAllUsers(filters);

    res.json({
      success: true,
      message: "Clients retrieved successfully",
      data: clients
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/clients - Create a new client user
router.post("/clients", verifyAdminToken, async (req, res, next) => {
  try {
    const { username, email, password, client_name, site_name, site_address, spoc_name, spoc_contact } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        detail: "Username, email, and password are required",
      });
    }

    // Validate email
    try {
      validateEmail(email);
    } catch (validationError) {
      return res.status(400).json({
        detail: validationError.message,
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        detail: "Password must be at least 6 characters long",
      });
    }

    // Check if username already exists
    const existingUsername = await database.getUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({
        detail: "Username already exists",
      });
    }

    // Check if email already exists
    const existingEmail = await database.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({
        detail: "Email already exists",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create client user
    const clientData = {
      username,
      email,
      password_hash: passwordHash,
      client_name: client_name || "",
      site_name: site_name || "",
      site_address: site_address || "",
      spoc_name: spoc_name || "",
      spoc_contact: spoc_contact || null,
      role: "client",
      is_active: true,
    };

    const newClient = await database.createUser(clientData);

    res.status(201).json({
      success: true,
      message: "Client created successfully",
      data: {
        client: newClient
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/clients/:username - Get detailed information about a specific client
router.get("/clients/:username", verifyAdminToken, async (req, res, next) => {
  try {
    const { username } = req.params;
    const user = await database.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({
        detail: "Client not found",
      });
    }

    // Get assigned sensors
    const sensors = await database.getUserSensors(username);

    res.json({
      success: true,
      message: "Client details retrieved successfully",
      data: {
        client: {
          id: user._id,
          username: user.username,
          email: user.email,
          client_name: user.client_name,
          site_name: user.site_name,
          site_address: user.site_address,
          spoc_name: user.spoc_name,
          spoc_contact: user.spoc_contact,
          role: user.role,
          is_active: user.is_active,
          created_at: user.created_at,
          last_login: user.last_login,
        },
        sensors: sensors
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/clients/:username/sensors - Get sensors assigned to a specific client
router.get("/clients/:username/sensors", verifyAdminToken, async (req, res, next) => {
  try {
    const { username } = req.params;
    const user = await database.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({
        detail: "Client not found",
      });
    }

    const sensors = await database.getUserSensors(username);

    res.json({
      success: true,
      message: "Client sensors retrieved successfully",
      data: {
        username: username,
        sensors: sensors
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /admin/clients/:username/sensors - Assign sensors to a client
router.post("/clients/:username/sensors", verifyAdminToken, async (req, res, next) => {
  try {
    const { username } = req.params;
    const { sensor_ids } = req.body;

    if (!sensor_ids || !Array.isArray(sensor_ids) || sensor_ids.length === 0) {
      return res.status(400).json({
        detail: "sensor_ids array is required",
      });
    }

    const user = await database.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({
        detail: "Client not found",
      });
    }

    // Verify all sensors exist
    for (const sensorId of sensor_ids) {
      const sensor = await database.getSensorById(sensorId);
      if (!sensor) {
        return res.status(404).json({
          detail: `Sensor ${sensorId} not found`,
        });
      }
    }

    // Assign sensors
    const assignments = await database.assignSensorsToUser(username, sensor_ids);

    res.json({
      success: true,
      message: `Assigned ${assignments.length} sensors to ${username}`,
      data: {
        username: username,
        sensor_ids: sensor_ids,
        assignments: assignments
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /admin/clients/:username - Delete a client user
router.delete("/clients/:username", verifyAdminToken, async (req, res, next) => {
  try {
    const { username } = req.params;
    const user = await database.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({
        detail: "Client not found",
      });
    }

    // Don't allow deleting self
    if (user.username === req.admin.username) {
      return res.status(400).json({
        detail: "Cannot delete your own account",
      });
    }

    const deleted = await database.deleteUser(user._id);
    if (!deleted) {
      return res.status(404).json({
        detail: "Client not found",
      });
    }

    res.json({
      success: true,
      message: `Client ${username} deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// SENSOR MANAGEMENT ROUTES (Admin only)
// =============================================================================

// GET /admin/sensors - Get all sensors (Admin and Assignee)
router.get("/sensors", verifyAdminOrAssigneeToken, async (req, res, next) => {
  try {

    const filters = {
      is_active: req.query.is_active !== undefined ? req.query.is_active === "true" : undefined,
      client_name: req.query.client_name || null,
      search: req.query.search || null,
    };
    
    const sensors = await database.getAllSensors(filters);

    res.json({
      success: true,
      message: "Sensors retrieved successfully",
      data: {
        sensors: sensors,
        total_count: sensors.length
      }
    });
  } catch (error) {
    console.error("❌ Error fetching sensors:", error);
    next(error);
  }
});

// POST /admin/sensors - Create a new sensor
router.post("/sensors", verifyAdminToken, async (req, res, next) => {
  try {
    const { sensor_id, device_id, location, is_active, client_name, site_name, spoc_name, spoc_contact, remark, remark_date, installation_date } = req.body;

    if (!sensor_id) {
      return res.status(400).json({
        detail: "sensor_id is required",
      });
    }

    // Check if sensor already exists
    const existingSensor = await database.getSensorById(sensor_id);
    if (existingSensor) {
      return res.status(400).json({
        detail: "Sensor with this sensor_id already exists",
      });
    }

    const sensorData = {
      sensor_id,
      device_id: device_id || sensor_id,
      location: location || {},
      is_active: is_active !== false,
      client_name: client_name || "",
      site_name: site_name || "",
      spoc_name: spoc_name || null,
      spoc_contact: spoc_contact || null,
      remark: remark || null,
      remark_date: remark_date || null,
      installation_date: installation_date || null,
    };

    const newSensor = await database.createSensor(sensorData);

    res.status(201).json({
      success: true,
      message: "Sensor created successfully",
      data: {
        sensor: newSensor
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /admin/sensors/:sensor_id - Update sensor (Admin only)
router.put("/sensors/:sensor_id", verifyAdminToken, async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const sensor = await database.getSensorById(sensor_id);
    
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    const updates = {};
    const allowedFields = [
      "device_id",
      "location",
      "is_active",
      "client_name",
      "site_name",
      "spoc_name",
      "spoc_contact",
      "remark",
      "remark_date",
      "installation_date",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === "is_active") {
          updates[field] = req.body[field] === true || req.body[field] === "true";
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    const updatedSensor = await database.updateSensor(sensor_id, updates);
    if (!updatedSensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    res.json({
      success: true,
      message: "Sensor updated successfully",
      data: {
        sensor: updatedSensor
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /admin/sensors/:sensor_id - Delete sensor (Admin only)
router.delete("/sensors/:sensor_id", verifyAdminToken, async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const deleted = await database.deleteSensor(sensor_id);
    
    if (!deleted) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    res.json({
      success: true,
      message: "Sensor deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

function formatMetric(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return "-";
  }
  return num.toFixed(2);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function isSensorOffline(latestReading, nowMs, offlineThresholdMs) {
  if (!latestReading || !latestReading.timestamp) {
    return true;
  }

  const latestTs = new Date(latestReading.timestamp).getTime();
  if (Number.isNaN(latestTs)) {
    return true;
  }

  return (nowMs - latestTs) > offlineThresholdMs;
}

async function downloadSensorsExcel(req, res, next, mode) {
  try {
    const allSensors = await database.getAllSensors({});
    const sensorIds = allSensors.map((sensor) => sensor.sensor_id).filter(Boolean);
    const latestReadings = await database.getAllLatestSensorReadings(sensorIds);

    const offlineThresholdMs = 60 * 60 * 1000; // 60 minutes
    const nowMs = Date.now();

    const sensorsForExport = allSensors.filter((sensor) => {
      const latest = latestReadings[sensor.sensor_id];
      const offline = isSensorOffline(latest, nowMs, offlineThresholdMs);

      if (mode === "online") return !offline;
      if (mode === "offline") return offline;
      return true; // overall
    });

    const workbook = new ExcelJS.Workbook();
    const sheetName = mode === "online" ? "Online Sensors" : mode === "offline" ? "Offline Sensors" : "Overall Sensors";
    const fileName = mode === "online" ? "online-sensors.xlsx" : mode === "offline" ? "offline-sensors.xlsx" : "overall-sensors.xlsx";
    const sheet = workbook.addWorksheet(sheetName);

    sheet.columns = [
      { header: "Project name", key: "project_name", width: 34 },
      { header: "Sensor ID", key: "sensor_id", width: 18 },
      { header: "PM2.5 (UNIT)", key: "pm25", width: 15 },
      { header: "PM10 (UNIT)", key: "pm10", width: 15 },
      { header: "Temp (UNIT)", key: "temp", width: 14 },
      { header: "Humidity (UNIT)", key: "humidity", width: 16 },
      { header: "Installation Date", key: "installation_date", width: 24 },
      { header: "Remark", key: "remark", width: 24 },
      { header: "Status", key: "status", width: 32 },
    ];

    for (const sensor of sensorsForExport) {
      const latest = latestReadings[sensor.sensor_id];
      const lastReadingTime = latest?.timestamp ? formatDateTime(latest.timestamp) : "-";
      const offline = isSensorOffline(latest, nowMs, offlineThresholdMs);

      sheet.addRow({
        project_name: sensor.client_name || "-",
        sensor_id: sensor.sensor_id || "-",
        pm25: formatMetric(latest?.pm2_5),
        pm10: formatMetric(latest?.pm10_0),
        temp: formatMetric(latest?.temperature),
        humidity: formatMetric(latest?.humidity),
        installation_date: formatDateTime(sensor.created_at),
        remark: sensor.remark || "-",
        status: offline ? `Delay\nDelay since ${lastReadingTime}` : `Online\nLast reading ${lastReadingTime}`,
      });
    }

    sheet.getRow(1).font = { bold: true };
    sheet.getColumn("status").alignment = { wrapText: true, vertical: "top" };

    const fileBuffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.status(200).send(Buffer.from(fileBuffer));
  } catch (error) {
    next(error);
  }
}

// GET /admin/sensors/overall/download - Download overall sensors in Excel format (Admin only)
router.get("/sensors/overall/download", verifyAdminToken, async (req, res, next) => {
  await downloadSensorsExcel(req, res, next, "overall");
});

// GET /admin/sensors/online/download - Download online sensors in Excel format (Admin only)
router.get("/sensors/online/download", verifyAdminToken, async (req, res, next) => {
  await downloadSensorsExcel(req, res, next, "online");
});

// GET /admin/sensors/offline/download - Download offline sensors in Excel format (Admin only)
router.get("/sensors/offline/download", verifyAdminToken, async (req, res, next) => {
  await downloadSensorsExcel(req, res, next, "offline");
});

// GET /admin/sensors/available - Get all available sensors for assignment (Admin only)
router.get("/sensors/available", verifyAdminToken, async (req, res, next) => {
  try {
    const filters = {
      is_active: req.query.is_active !== undefined ? req.query.is_active === "true" : undefined,
      search: req.query.search || null,
    };
    const sensors = await database.getAllSensors(filters);

    res.json({
      success: true,
      message: "Available sensors retrieved successfully",
      data: {
        sensors: sensors
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /admin/dashboard/stats - Get admin dashboard statistics
router.get("/dashboard/stats", verifyAdminToken, async (req, res, next) => {
  try {
    const allUsers = await database.getAllUsers({});
    const allSensors = await database.getAllSensors({});

    const totalClients = allUsers.filter(u => u.role === "client").length;
    const totalUsers = allUsers.filter(u => u.role === "user").length;
    const totalSensors = allSensors.length;
    const activeSensors = allSensors.filter(s => s.is_active).length;
    const activeUsers = allUsers.filter(u => u.is_active).length;

    res.json({
      success: true,
      message: "Dashboard stats retrieved successfully",
      data: {
        total_clients: totalClients,
        total_users: totalUsers,
        total_sensors: totalSensors,
        active_sensors: activeSensors,
        active_users: activeUsers,
        database_type: "MongoDB"
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;


import express from "express";
import bcrypt from "bcrypt";
import * as database from "../services/database.js";
import { generateUserToken, verifyAdminToken, verifyAdminOrAssigneeToken } from "../middleware/auth.js";
import { sendAssigneeCredentialsEmail } from "../utils/emailService.js";

const router = express.Router();

// POST /assignee/create - Create assignee (Admin only)
router.post("/create", verifyAdminToken, async (req, res, next) => {
  try {
    const { full_name, email, username, password, send_credentials_email } = req.body;

    if (!full_name || !email || !username || !password) {
      return res.status(400).json({
        detail: "Name, email, username, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        detail: "Password must be at least 6 characters long",
      });
    }

    const existingByUsername = await database.getAssigneeByUsername(username);
    if (existingByUsername) {
      return res.status(400).json({
        detail: "Username already exists",
      });
    }

    const existingByEmail = await database.getAssigneeByEmail(email);
    if (existingByEmail) {
      return res.status(400).json({
        detail: "Email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const createdAssignee = await database.createAssignee({
      full_name,
      email,
      username,
      password_hash: passwordHash,
      role: "assignee",
      is_active: true,
    });

    let emailSent = false;
    if (send_credentials_email) {
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const dashboardUrl = `${baseUrl}/login`;
      emailSent = await sendAssigneeCredentialsEmail(
        email,
        full_name,
        username,
        password,
        dashboardUrl
      );
    }

    return res.status(201).json({
      message: "Assignee created successfully",
      assignee: createdAssignee,
      email_sent: emailSent,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /assignee/:username - Update assignee details (Admin only)
router.put("/:username", verifyAdminToken, async (req, res, next) => {
  try {
    const { username } = req.params;
    const assignee = await database.getAssigneeByUsername(username);
    if (!assignee) {
      return res.status(404).json({ detail: "Assignee not found" });
    }

    const { full_name, email, password, is_active } = req.body;
    if (!full_name || !email) {
      return res.status(400).json({
        detail: "Name and email are required",
      });
    }

    const existingByEmail = await database.getAssigneeByEmail(email);
    if (existingByEmail && existingByEmail.username !== username) {
      return res.status(400).json({ detail: "Email already exists" });
    }

    const updates = {
      full_name,
      email,
      is_active: is_active !== false && is_active !== "false",
    };

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          detail: "Password must be at least 6 characters long",
        });
      }
      updates.password_hash = await bcrypt.hash(password, 10);
    }

    const updatedAssignee = await database.updateAssignee(username, updates);
    return res.json({
      message: "Assignee updated successfully",
      assignee: updatedAssignee,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /assignee/:username - Delete assignee (Admin only)
router.delete("/:username", verifyAdminToken, async (req, res, next) => {
  try {
    const { username } = req.params;
    const deleted = await database.deleteAssignee(username);
    if (!deleted) {
      return res.status(404).json({ detail: "Assignee not found" });
    }
    return res.json({ message: "Assignee deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// POST /assignee/login - Assignee login
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        detail: "Username and password are required",
      });
    }

    // Get assignee from assignees collection
    const assignee = await database.getAssigneeByUsername(username);

    if (!assignee) {
      return res.status(401).json({
        detail: "Invalid username or password",
      });
    }

    // Check if assignee is active
    if (assignee.is_active === false) {
      return res.status(403).json({
        detail: "Assignee account is deactivated",
      });
    }

    // Check if password_hash exists
    if (!assignee.password_hash) {
      console.error(`❌ Assignee "${username}" has no password_hash`);
      return res.status(500).json({
        detail: "Assignee account configuration error. Please contact administrator.",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, assignee.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        detail: "Invalid username or password",
      });
    }

    // Update last login
    await database.updateAssigneeLastLogin(username);

    // Generate JWT token (using assignee as user object for token generation)
    const token = generateUserToken(assignee);

    // Handle both ObjectId _id and UUID id field
    const assigneeId = assignee.id || (assignee._id ? (typeof assignee._id === 'string' ? assignee._id : assignee._id.toString()) : null);

    // Return assignee info (without password) and token
    res.json({
      token,
      assignee: {
        id: assigneeId,
        username: assignee.username,
        email: assignee.email,
        full_name: assignee.full_name,
        role: assignee.role || "assignee",
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /assignee/list - List all assignees (Admin only)
router.get("/list", verifyAdminOrAssigneeToken, async (req, res, next) => {
  try {
    const assignees = await database.getAllAssignees();
    res.json(assignees);
  } catch (error) {
    next(error);
  }
});

// GET /assignee/performance/:username - Get assignee performance stats
router.get("/performance/:username", verifyAdminOrAssigneeToken, async (req, res, next) => {
  try {
    const { username } = req.params;
    const { time_period = "month" } = req.query;
    
    // Validate time period
    const validPeriods = ["week", "month", "year"];
    if (!validPeriods.includes(time_period)) {
      return res.status(400).json({
        detail: `Invalid time_period. Must be one of: ${validPeriods.join(", ")}`,
      });
    }
    
    const performance = await database.getAssigneePerformance(username, time_period);
    res.json({
      success: true,
      message: "Assignee performance retrieved successfully",
      data: performance
    });
  } catch (error) {
    next(error);
  }
});

export default router;


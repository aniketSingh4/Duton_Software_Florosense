import express from "express";
import multer from "multer";
import jwt from "jsonwebtoken";
import * as database from "../services/database.js";
import { TicketPriority, TicketStatus, validateIssueType, validateDescription, validateMessage } from "../models/index.js";
import { verifyUserToken } from "../middleware/auth.js";

const router = express.Router();

// Configure multer for file uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });
const patchUploadMiddleware = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return upload.array("images", 10)(req, res, next);
  }
  return next();
};

// Helper to convert buffer to base64
function bufferToBase64(buffer) {
  return buffer.toString("base64");
}

function getTokenPayload(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return null;
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function isAdminTicketRequest(req) {
  return getTokenPayload(req)?.role === "admin";
}

// GET /tickets - List all tickets with optional filters
router.get("/", verifyUserToken, async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status || null,
      priority: req.query.priority || null,
      sensor_id: req.query.sensor_id || null,
      search: req.query.search && req.query.search.length >= 2 ? req.query.search : null,
    };

    // For magic link users, only show tickets they created
    if (req.user.share_access) {
      // Magic link user - filter by created_by (email from JWT)
      filters.created_by = req.user.email || req.user.username;
    } else if (req.user.username) {
      // Fetch user details from DB to check current role
      const dbUser = await database.getUserByUsername(req.user.username);
      if (dbUser && ["user", "builder", "contractor"].includes(dbUser.role)) {
        filters.created_by = dbUser.username;
      }
    }
    // For admin, client, assignee (or if user not found meaning potentially admin/assignee) - show all tickets

    const tickets = await database.listTickets(filters);
    res.json(tickets);
  } catch (error) {
    next(error);
  }
});

// POST /tickets - Create a new support ticket with optional image upload
router.post("/", upload.single("image"), async (req, res, next) => {
  try {
    let ticketData;

    // Check if request is FormData or JSON
    const contentType = req.headers["content-type"] || "";
    const isFormData = contentType.includes("multipart/form-data");

    if (isFormData) {
      // Handle FormData (with image)
      let imageData = null;
      let imageContentType = null;

      if (req.file && req.file.buffer) {
        imageData = bufferToBase64(req.file.buffer);
        imageContentType = req.file.mimetype || "image/jpeg";
      }

      ticketData = {
        sensor_id: req.body.sensor_id || null,
        sensor_name: req.body.sensor_name || null,
        issue_type: req.body.issue_type || null,
        description: req.body.description || null,
        priority: req.body.priority || "Medium",
        assignee: req.body.assignee || null,
        created_by: req.body.created_by || null,
        full_name: req.body.full_name || null,
        location: req.body.location || null,
        raised_by: req.body.raised_by || null,
        image_data: imageData,
        image_content_type: imageContentType,
      };
    } else {
      // Handle JSON (no image)
      const jsonData = req.body;
      ticketData = {
        sensor_id: jsonData.sensor_id || null,
        sensor_name: jsonData.sensor_name || null,
        issue_type: jsonData.issue_type || null,
        description: jsonData.description || null,
        priority: jsonData.priority || "Medium",
        assignee: jsonData.assignee || null,
        created_by: jsonData.created_by || null,
        full_name: jsonData.full_name || null,
        location: jsonData.location || null,
        raised_by: jsonData.raised_by || null,
        image_data: null,
      };
    }

    // Validate and determine owner
    const ownerIdentifier = ticketData.created_by || ticketData.full_name;
    ticketData.created_by = ownerIdentifier;
    if (!ownerIdentifier) {
      return res.status(400).json({
        detail: "Unable to determine ticket owner. Please log in again.",
      });
    }

    // Validate required fields
    try {
      if (ticketData.issue_type) {
        validateIssueType(ticketData.issue_type);
      } else {
        return res.status(400).json({
          detail: "issue_type is required",
        });
      }
      if (ticketData.description) {
        validateDescription(ticketData.description);
      } else {
        return res.status(400).json({
          detail: "description is required",
        });
      }
    } catch (validationError) {
      return res.status(400).json({
        detail: validationError.message,
      });
    }

    // Check ticket limits
    const activeStatuses = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS];
    const isAdminRequest = isAdminTicketRequest(req);

    if (ticketData.sensor_id && !isAdminRequest) {
      const hasSensorTicket = await database.hasActiveTicketForSensor(
        ownerIdentifier,
        ticketData.sensor_id,
        activeStatuses
      );
      if (hasSensorTicket) {
        return res.status(400).json({
          detail: "You already have an active ticket for this sensor.",
        });
      }
    }

    if (!isAdminRequest) {
      const hasIssueTypeTicket = await database.hasActiveTicketForIssueType(
        ownerIdentifier,
        ticketData.issue_type,
        activeStatuses
      );
      if (hasIssueTypeTicket) {
        return res.status(400).json({
          detail: "You already have an active ticket for this issue type.",
        });
      }
    }

    if (!isAdminRequest) {
      const userTicketCount = await database.countActiveTicketsForUser(
        ownerIdentifier,
        activeStatuses
      );
      if (userTicketCount >= 4) {
        return res.status(400).json({
          detail: "You already have the maximum number of active tickets (4).",
        });
      }
    }

    const ticket = await database.createTicket(ticketData);
    res.status(201).json(ticket);
  } catch (error) {
    next(error);
  }
});

// GET /tickets/:ticket_id - Get a single ticket
router.get("/:ticket_id", async (req, res, next) => {
  try {
    const ticket = await database.getTicket(req.params.ticket_id);
    if (!ticket) {
      return res.status(404).json({ detail: "Ticket not found" });
    }
    res.json(ticket);
  } catch (error) {
    next(error);
  }
});

// PATCH /tickets/:ticket_id - Update a ticket
router.patch("/:ticket_id", patchUploadMiddleware, async (req, res, next) => {
  try {
    // Get existing ticket to merge images
    const existingTicket = await database.getTicket(req.params.ticket_id);
    if (!existingTicket) {
      return res.status(404).json({ detail: "Ticket not found" });
    }

    // Build update object with only provided fields
    const updates = {};
    const allowedFields = [
      "sensor_id",
      "issue_type",
      "description",
      "priority",
      "status",
      "assignee",
      "full_name",
      "location",
      "closed_by",
    ];

    const requestBody = req.body || {};
    for (const field of allowedFields) {
      if (requestBody[field] !== undefined) {
        updates[field] = requestBody[field];
      }
    }

    if (typeof updates.closed_by === "string") {
      updates.closed_by = updates.closed_by.trim() || null;
    }

    // When a ticket is being closed, record who closed it. Fall back to the
    // caller's identity if the client did not send closed_by.
    if (updates.status === TicketStatus.CLOSED && existingTicket.status !== TicketStatus.CLOSED) {
      if (!updates.closed_by) {
        const tokenPayload = getTokenPayload(req);
        updates.closed_by =
          tokenPayload?.full_name || tokenPayload?.username || tokenPayload?.email || null;
      }
      if (!updates.closed_by) {
        return res.status(400).json({
          detail: "closed_by is required when closing a ticket.",
        });
      }
    }

    // Queue assignee changes for daily batch instead of immediate dispatch.
    if (Object.prototype.hasOwnProperty.call(updates, "assignee")) {
      const assigneeValue = typeof updates.assignee === "string" ? updates.assignee.trim() : updates.assignee;

      if (assigneeValue) {
        updates.pending_assignee = assigneeValue;
        updates.assignment_dispatched = false;
        updates.assignment_dispatched_at = null;
      } else {
        updates.pending_assignee = null;
      }

      // Prevent direct assignment during admin action.
      delete updates.assignee;
    }

    // Handle image uploads - merge new images with existing ones
    if (req.files && req.files.length > 0) {
      // Get existing images from ticket
      let existingImages = [];
      if (existingTicket.images && Array.isArray(existingTicket.images)) {
        existingImages = existingTicket.images;
      } else if (existingTicket.image_data) {
        // Convert old format (single image) to new format (array)
        existingImages = [{
          data: existingTicket.image_data,
          content_type: existingTicket.image_content_type || "image/jpeg"
        }];
      }

      // Convert new uploaded files to image objects
      const newImages = req.files.map(file => ({
        data: bufferToBase64(file.buffer),
        content_type: file.mimetype || "image/jpeg"
      }));

      // Merge existing images with new images
      updates.images = [...existingImages, ...newImages];
      // Clear old single image fields if they exist
      updates.image_data = null;
      updates.image_content_type = null;
    }

    const ticket = await database.updateTicket(req.params.ticket_id, updates);
    if (!ticket) {
      return res.status(404).json({ detail: "Ticket not found" });
    }
    res.json(ticket);
  } catch (error) {
    next(error);
  }
});

// POST /tickets/:ticket_id/replies - Add a reply to a ticket
router.post("/:ticket_id/replies", async (req, res, next) => {
  try {
    // Validate message
    try {
      validateMessage(req.body.message);
    } catch (validationError) {
      return res.status(400).json({
        detail: validationError.message,
      });
    }

    const ticket = await database.getTicket(req.params.ticket_id);
    if (!ticket) {
      return res.status(404).json({ detail: "Ticket not found" });
    }

    const payload = {
      author: req.body.author || "User",
      message: req.body.message,
    };

    const reply = await database.addReply(req.params.ticket_id, payload, ticket.sensor_id);
    res.status(201).json(reply);
  } catch (error) {
    next(error);
  }
});

// DELETE /tickets/:ticket_id - Delete a ticket
router.delete("/:ticket_id", async (req, res, next) => {
  try {
    const deleted = await database.deleteTicket(req.params.ticket_id);
    if (!deleted) {
      return res.status(404).json({ detail: "Ticket not found" });
    }
    res.status(200).json({ message: "Ticket deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;


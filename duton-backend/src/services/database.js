import { MongoClient, ObjectId } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { getSettings } from "../config.js";
import { TicketPriority, TicketStatus } from "../models/index.js";

const settings = getSettings();

let mongoClient = null;
let ticketsCollection = null;
let repliesCollection = null;
let adminsCollection = null;
let assigneesCollection = null;
let otpsCollection = null;
let usersCollection = null;
let sensorsCollection = null;
let userSensorsCollection = null;
let shareAccessTokensCollection = null;
let sitesCollection = null;
let userSitesCollection = null;
let calibrationsCollection = null;
let sensorReadingsCollection = null;
let alertStatesCollection = null;
let alertLogsCollection = null;
let amcFeaturesCollection = null;
let amcAuditLogsCollection = null;

export async function connect() {
  // Log database connection info (mask password for security)
  let maskedUrl = 'NOT SET';
  if (settings.MONGO_URL) {
    // Mask password in MongoDB connection string
    // Handles formats like: mongodb://user:pass@host or mongodb+srv://user:pass@host
    maskedUrl = settings.MONGO_URL.replace(/(:\/\/[^:]+:)([^@]+)(@)/, (match, prefix, password, suffix) => {
      return prefix + '****' + suffix;
    });
  }

  // Extract database name from URL if present, otherwise use settings
  let dbNameFromUrl = null;
  if (settings.MONGO_URL) {
    const urlMatch = settings.MONGO_URL.match(/\/([^/?]+)(\?|$)/);
    if (urlMatch && urlMatch[1] && urlMatch[1] !== 'admin' && urlMatch[1] !== 'test') {
      dbNameFromUrl = urlMatch[1];
    }
  }
  const finalDbName = dbNameFromUrl || settings.MONGO_DB_NAME;


  mongoClient = new MongoClient(settings.MONGO_URL);
  await mongoClient.connect();
  const db = mongoClient.db(finalDbName);
  ticketsCollection = db.collection(settings.TICKETS_COLLECTION);
  repliesCollection = db.collection(settings.REPLIES_COLLECTION);
  adminsCollection = db.collection("admins");
  assigneesCollection = db.collection("assignees");
  otpsCollection = db.collection("admin_otps");
  usersCollection = db.collection("users");
  sensorsCollection = db.collection("sensors");
  userSensorsCollection = db.collection("user_sensors");
  shareAccessTokensCollection = db.collection("share_access_tokens");
  sitesCollection = db.collection("sites");
  userSitesCollection = db.collection("user_sites");
  calibrationsCollection = db.collection("calibrations");
  sensorReadingsCollection = db.collection("sensor_readings");
  alertStatesCollection = db.collection("alert_states");
  alertLogsCollection = db.collection("alert_logs");
  amcFeaturesCollection = db.collection("amc_features");
  amcAuditLogsCollection = db.collection("amc_audit_logs");

  // Helper function to create index safely (handles existing indexes)
  const createIndexSafe = async (collection, indexSpec, options = {}) => {
    try {
      await collection.createIndex(indexSpec, options);
    } catch (error) {
      // If index already exists with different options, try to drop and recreate
      if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
        try {
          // Get index name from spec
          const indexName = options.name || Object.keys(indexSpec).join('_') + '_1';
          await collection.dropIndex(indexName);
          await collection.createIndex(indexSpec, options);
        } catch (dropError) {
          // If drop fails, just log and continue (index might not exist or be different)
        }
      } else if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        // Index exists with same keys but different options - this is usually fine
      } else {
        // Other errors - log but don't fail
      }
    }
  };

  // Create indexes
  await createIndexSafe(ticketsCollection, { status: 1 });
  await createIndexSafe(ticketsCollection, { priority: 1 });
  await createIndexSafe(ticketsCollection, { sensor_id: 1 });
  await createIndexSafe(repliesCollection, { ticket_id: 1 });
  await createIndexSafe(adminsCollection, { username: 1 }, { unique: true });
  await createIndexSafe(adminsCollection, { email: 1 }, { unique: true });
  await createIndexSafe(assigneesCollection, { username: 1 }, { unique: true });
  await createIndexSafe(assigneesCollection, { email: 1 }, { unique: true });
  await createIndexSafe(otpsCollection, { email: 1 });
  await createIndexSafe(otpsCollection, { expires_at: 1 }, { expireAfterSeconds: 0 });

  // User indexes
  await createIndexSafe(usersCollection, { username: 1 }, { unique: true });
  await createIndexSafe(usersCollection, { email: 1 }, { unique: true });
  await createIndexSafe(usersCollection, { role: 1 });
  await createIndexSafe(usersCollection, { is_active: 1 });

  // Sensor indexes
  await createIndexSafe(sensorsCollection, { sensor_id: 1 }, { unique: true });
  await createIndexSafe(sensorsCollection, { device_id: 1 });
  await createIndexSafe(sensorsCollection, { is_active: 1 });
  await createIndexSafe(sensorsCollection, { client_name: 1 });

  // User-Sensor indexes
  await createIndexSafe(userSensorsCollection, { username: 1, sensor_id: 1 }, { unique: true });
  await createIndexSafe(userSensorsCollection, { username: 1 });
  await createIndexSafe(userSensorsCollection, { sensor_id: 1 });

  // AMC / Warranty tracking indexes
  await createIndexSafe(amcFeaturesCollection, { sensor_id: 1 }, { unique: true });
  await createIndexSafe(amcFeaturesCollection, { username: 1 });
  await createIndexSafe(amcFeaturesCollection, { tracked: 1 });
  await createIndexSafe(amcAuditLogsCollection, { username: 1, changed_at: -1 });
  await createIndexSafe(amcAuditLogsCollection, { sensor_id: 1, changed_at: -1 });

  // Site indexes
  await createIndexSafe(sitesCollection, { site_id: 1 }, { unique: true });
  await createIndexSafe(sitesCollection, { site_name: 1 });

  // User-Site indexes
  await createIndexSafe(userSitesCollection, { username: 1, site_id: 1 }, { unique: true });
  await createIndexSafe(userSitesCollection, { username: 1 });
  await createIndexSafe(userSitesCollection, { site_id: 1 });

  // Sensor-Site relationship index
  await createIndexSafe(sensorsCollection, { site_id: 1 });

  // Calibration indexes
  await createIndexSafe(calibrationsCollection, { sensor_id: 1 }, { unique: true });

  // Sensor Readings indexes - for efficient querying
  await createIndexSafe(sensorReadingsCollection, { sensor_id: 1, timestamp: -1 });
  await createIndexSafe(sensorReadingsCollection, { timestamp: -1 });
  await createIndexSafe(sensorReadingsCollection, { sensor_id: 1 });

  // Alert state indexes
  await createIndexSafe(alertStatesCollection, { sensor_id: 1 }, { unique: true });

  // Alert log indexes
  await createIndexSafe(alertLogsCollection, { sensor_id: 1, created_at: -1 });
  await createIndexSafe(alertLogsCollection, { created_at: -1 });
  await createIndexSafe(alertLogsCollection, { alert_type: 1 });
  await createIndexSafe(alertLogsCollection, { alert_status: 1 });
}

export async function disconnect() {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    ticketsCollection = null;
    repliesCollection = null;
    adminsCollection = null;
    assigneesCollection = null;
    otpsCollection = null;
    usersCollection = null;
    sensorsCollection = null;
    userSensorsCollection = null;
    sitesCollection = null;
    userSitesCollection = null;
    sensorReadingsCollection = null;
    alertStatesCollection = null;
    alertLogsCollection = null;
  }
}

function _now() {
  return new Date();
}

function _ensureCollections() {
  if (ticketsCollection === null || repliesCollection === null) {
    throw new Error("MongoDB collections are not initialized. Call connect() first.");
  }
}

function _serializeTicket(doc, replies = null) {
  // Handle images - support both old format (single image) and new format (array)
  let images = [];
  if (doc.images && Array.isArray(doc.images)) {
    // New format: array of images
    images = doc.images;
  } else if (doc.image_data) {
    // Old format: single image - convert to array format
    images = [{
      data: doc.image_data,
      content_type: doc.image_content_type || "image/jpeg"
    }];
  }

  return {
    id: doc._id,
    sensor_id: doc.sensor_id,
    sensor_name: doc.sensor_name,
    issue_type: doc.issue_type,
    description: doc.description,
    priority: doc.priority,
    status: doc.status,
    assignee: doc.assignee,
    pending_assignee: doc.pending_assignee || null,
    assignment_dispatched: doc.assignment_dispatched === true,
    assignment_dispatched_at: doc.assignment_dispatched_at ? doc.assignment_dispatched_at.toISOString() : null,
    reminder_last_sent_at: doc.reminder_last_sent_at ? doc.reminder_last_sent_at.toISOString() : null,
    created_by: doc.created_by,
    full_name: doc.full_name,
    location: doc.location,
    raised_by: doc.raised_by || null,
    images: images,
    // Keep old fields for backward compatibility
    image_data: doc.image_data,
    image_content_type: doc.image_content_type,
    created_at: doc.created_at ? doc.created_at.toISOString() : null,
    updated_at: doc.updated_at ? doc.updated_at.toISOString() : null,
    closed_at: doc.closed_at ? doc.closed_at.toISOString() : null,
    closed_by: doc.closed_by || null,
    replies: replies || [],
  };
}

function _serializeReply(doc) {
  return {
    id: doc._id,
    ticket_id: doc.ticket_id,
    sensor_id: doc.sensor_id,
    author: doc.author,
    message: doc.message,
    created_at: doc.created_at ? doc.created_at.toISOString() : null,
  };
}

export async function createTicket(data) {
  _ensureCollections();
  const ticketId = data.id || uuidv4();
  const now = _now();

  const imageData = data.image_data;
  const doc = {
    _id: ticketId,
    sensor_id: data.sensor_id,
    sensor_name: data.sensor_name,
    issue_type: data.issue_type,
    description: data.description,
    priority: data.priority || TicketPriority.MEDIUM,
    status: TicketStatus.OPEN,
    assignee: data.assignee,
    pending_assignee: data.pending_assignee || null,
    assignment_dispatched: data.assignment_dispatched === true,
    assignment_dispatched_at: data.assignment_dispatched_at || null,
    created_by: data.created_by,
    full_name: data.full_name,
    location: data.location,
    raised_by: data.raised_by || null,
    image_data: imageData,
    image_content_type: data.image_content_type,
    created_at: now,
    updated_at: now,
  };
  await ticketsCollection.insertOne(doc);
  return _serializeTicket(doc, []);
}

export async function listTickets(filters) {
  _ensureCollections();
  const query = {};

  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.priority) {
    query.priority = filters.priority;
  }
  if (filters.sensor_id) {
    query.sensor_id = filters.sensor_id;
  }
  if (filters.created_by) {
    // Filter by ticket creator (for magic link users)
    query.created_by = filters.created_by;
  }
  if (filters.search) {
    const searchRegex = { $regex: filters.search, $options: "i" };
    query.$or = [
      { issue_type: searchRegex },
      { description: searchRegex },
      { assignee: searchRegex },
      { full_name: searchRegex },
      { location: searchRegex },
    ];
  }

  const tickets = await ticketsCollection
    .find(query)
    .sort({ created_at: -1 })
    .toArray();

  if (tickets.length === 0) {
    return [];
  }

  const ticketIds = tickets.map((ticket) => ticket._id);
  const replyDocs = await repliesCollection
    .find({ ticket_id: { $in: ticketIds } })
    .sort({ created_at: 1 })
    .toArray();

  const repliesMap = {};
  for (const reply of replyDocs) {
    if (!repliesMap[reply.ticket_id]) {
      repliesMap[reply.ticket_id] = [];
    }
    repliesMap[reply.ticket_id].push(_serializeReply(reply));
  }

  return tickets.map((ticket) => _serializeTicket(ticket, repliesMap[ticket._id] || []));
}

export async function getTicket(ticketId) {
  _ensureCollections();
  const ticket = await ticketsCollection.findOne({ _id: ticketId });
  if (!ticket) {
    return null;
  }

  const replyDocs = await repliesCollection
    .find({ ticket_id: ticketId })
    .sort({ created_at: 1 })
    .toArray();
  const replies = replyDocs.map((reply) => _serializeReply(reply));
  return _serializeTicket(ticket, replies);
}

export async function updateTicket(ticketId, updates) {
  _ensureCollections();
  const updateFields = {};
  const nullableFields = new Set([
    "pending_assignee",
    "assignment_dispatched_at",
    "closed_at",
    "closed_by",
  ]);

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && (value !== null || nullableFields.has(key))) {
      updateFields[key] = value;
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return await getTicket(ticketId);
  }

  // Get existing ticket to check current status
  const existingTicket = await ticketsCollection.findOne({ _id: ticketId });

  // If status is being changed to "Closed", set closed_at timestamp
  if (updates.status === TicketStatus.CLOSED && existingTicket && existingTicket.status !== TicketStatus.CLOSED) {
    updateFields.closed_at = _now();
  }
  // If status is being changed from "Closed" to something else, clear closed_at and closed_by
  else if (updates.status && updates.status !== TicketStatus.CLOSED && existingTicket && existingTicket.status === TicketStatus.CLOSED) {
    updateFields.closed_at = null;
    updateFields.closed_by = null;
  }

  updateFields.updated_at = _now();
  const result = await ticketsCollection.findOneAndUpdate(
    { _id: ticketId },
    { $set: updateFields },
    { returnDocument: "after" }
  );

  if (!result) {
    return null;
  }

  const replyDocs = await repliesCollection
    .find({ ticket_id: ticketId })
    .sort({ created_at: 1 })
    .toArray();
  const replies = replyDocs.map((reply) => _serializeReply(reply));
  return _serializeTicket(result, replies);
}

export async function addReply(ticketId, payload, sensorId) {
  _ensureCollections();
  const replyId = uuidv4();
  const doc = {
    _id: replyId,
    ticket_id: ticketId,
    sensor_id: sensorId,
    author: payload.author,
    message: payload.message,
    created_at: _now(),
  };
  await repliesCollection.insertOne(doc);
  await ticketsCollection.updateOne({ _id: ticketId }, { $set: { updated_at: _now() } });
  return _serializeReply(doc);
}

export async function deleteTicket(ticketId) {
  _ensureCollections();
  // Delete all replies for this ticket
  await repliesCollection.deleteMany({ ticket_id: ticketId });
  // Delete the ticket
  const result = await ticketsCollection.findOneAndDelete({ _id: ticketId });
  return result ? true : false;
}

export async function countActiveTicketsForUser(createdBy, statuses = null) {
  _ensureCollections();
  if (!createdBy) {
    return 0;
  }
  const query = { created_by: createdBy };
  if (statuses) {
    query.status = { $in: statuses };
  }
  return await ticketsCollection.countDocuments(query);
}

export async function hasActiveTicketForSensor(createdBy, sensorId, statuses = null) {
  _ensureCollections();
  if (!createdBy || !sensorId) {
    return false;
  }
  const query = {
    created_by: createdBy,
    sensor_id: sensorId,
  };
  if (statuses) {
    query.status = { $in: statuses };
  }
  const doc = await ticketsCollection.findOne(query, { projection: { _id: 1 } });
  return doc !== null;
}

export async function hasActiveTicketForIssueType(createdBy, issueType, statuses = null) {
  _ensureCollections();
  if (!createdBy || !issueType) {
    return false;
  }
  const query = {
    created_by: createdBy,
    issue_type: issueType,
  };
  if (statuses) {
    query.status = { $in: statuses };
  }
  const doc = await ticketsCollection.findOne(query, { projection: { _id: 1 } });
  return doc !== null;
}

// =============================================================================
// ADMIN DATABASE FUNCTIONS
// =============================================================================

function _ensureAdminCollection() {
  if (adminsCollection === null) {
    throw new Error("MongoDB admin collection is not initialized. Call connect() first.");
  }
}

function _ensureAssigneeCollection() {
  if (assigneesCollection === null) {
    throw new Error("MongoDB assignee collection is not initialized. Call connect() first.");
  }
}

function _serializeAdmin(doc) {
  // Helper to safely convert to ISO string
  const toISOString = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }
    if (value.toISOString && typeof value.toISOString === 'function') {
      return value.toISOString();
    }
    return null;
  };

  // Handle both ObjectId _id and UUID id field
  const docId = doc.id || (doc._id ? (typeof doc._id === 'string' ? doc._id : doc._id.toString()) : null);

  return {
    id: docId,
    username: doc.username,
    email: doc.email,
    full_name: doc.full_name,
    role: doc.role || "admin",
    is_active: doc.is_active !== false,
    created_at: toISOString(doc.created_at),
    last_login: toISOString(doc.last_login),
  };
}

function _serializeAssignee(doc) {
  // Helper to safely convert to ISO string
  const toISOString = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }
    if (value.toISOString && typeof value.toISOString === 'function') {
      return value.toISOString();
    }
    return null;
  };

  // Handle both ObjectId _id and UUID id field
  const docId = doc.id || (doc._id ? (typeof doc._id === 'string' ? doc._id : doc._id.toString()) : null);

  return {
    id: docId,
    username: doc.username,
    email: doc.email,
    full_name: doc.full_name,
    role: doc.role || "assignee",
    is_active: doc.is_active !== false,
    created_at: toISOString(doc.created_at),
    last_login: toISOString(doc.last_login),
  };
}

export async function getAdminByUsername(username) {
  _ensureAdminCollection();
  const admin = await adminsCollection.findOne({ username });
  if (!admin) {
    return null;
  }
  return admin;
}

export async function getAdminByEmail(email) {
  _ensureAdminCollection();
  const admin = await adminsCollection.findOne({ email });
  if (!admin) {
    return null;
  }
  return admin;
}

export async function createAdmin(adminData) {
  try {
    _ensureAdminCollection();

    // Generate UUID for id field, let MongoDB generate ObjectId for _id
    const adminId = adminData.id || uuidv4();
    const now = _now();

    const doc = {
      // Let MongoDB generate ObjectId for _id automatically
      id: adminId, // UUID string field
      username: adminData.username,
      email: adminData.email,
      password_hash: adminData.password_hash,
      full_name: adminData.full_name || adminData.username,
      role: adminData.role || "admin",
      is_active: adminData.is_active !== false,
      created_at: now,
      last_login: null,
    };

    const result = await adminsCollection.insertOne(doc);

    if (!result.acknowledged) {
      throw new Error("Failed to insert admin document");
    }

    // Fetch the created document to return serialized version
    const createdDoc = await adminsCollection.findOne({ _id: result.insertedId });
    if (!createdDoc) {
      throw new Error("Admin was inserted but could not be retrieved");
    }

    return _serializeAdmin(createdDoc);
  } catch (error) {
    console.error("Error in createAdmin:", error);
    throw error;
  }
}

export async function updateAdminLastLogin(username) {
  _ensureAdminCollection();
  await adminsCollection.updateOne(
    { username },
    { $set: { last_login: _now() } }
  );
}

export async function updateAdminPassword(username, passwordHash) {
  _ensureAdminCollection();
  const result = await adminsCollection.findOneAndUpdate(
    { username },
    { $set: { password_hash: passwordHash } },
    { returnDocument: "after" }
  );
  if (!result) {
    return null;
  }
  return _serializeAdmin(result);
}

export async function getAllAdmins() {
  _ensureAdminCollection();
  const admins = await adminsCollection.find({}).sort({ created_at: -1 }).toArray();
  return admins.map((admin) => _serializeAdmin(admin));
}

export async function initializeDefaultAdmin() {
  try {
    _ensureAdminCollection();

    // Check if admin with username "admin" already exists
    const existingAdmin = await adminsCollection.findOne({ username: "admin" });
    if (existingAdmin) {
      return null; // Admin already exists
    }

    // Check total admin count
    const adminCount = await adminsCollection.countDocuments({});
    if (adminCount > 0) {
      return null; // Other admins exist
    }

    // Create default admin (password should be changed on first login)
    const bcrypt = await import("bcrypt");
    const defaultPassword = "admin123"; // Should be changed immediately
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const defaultAdmin = {
      username: "admin",
      email: "admin@duton.com",
      password_hash: passwordHash,
      full_name: "System Administrator",
      role: "admin",
      is_active: true,
    };

    const createdAdmin = await createAdmin(defaultAdmin);
    return createdAdmin;
  } catch (error) {
    console.error("Error creating default admin:", error);
    throw error;
  }
}

// =============================================================================
// ASSIGNEE DATABASE FUNCTIONS
// =============================================================================

export async function getAssigneeByUsername(username) {
  _ensureAssigneeCollection();
  const assignee = await assigneesCollection.findOne({ username });
  if (!assignee) {
    return null;
  }
  return assignee;
}

export async function getAssigneeByEmail(email) {
  _ensureAssigneeCollection();
  const assignee = await assigneesCollection.findOne({ email });
  if (!assignee) {
    return null;
  }
  return assignee;
}

export async function createAssignee(assigneeData) {
  _ensureAssigneeCollection();
  const assigneeId = assigneeData.id || uuidv4();
  const now = _now();

  const doc = {
    id: assigneeId,
    username: assigneeData.username,
    email: assigneeData.email,
    password_hash: assigneeData.password_hash,
    full_name: assigneeData.full_name || assigneeData.username,
    role: assigneeData.role || "assignee",
    is_active: assigneeData.is_active !== false,
    created_at: now,
    last_login: null,
  };

  const result = await assigneesCollection.insertOne(doc);
  if (!result.acknowledged) {
    throw new Error("Failed to insert assignee document");
  }

  const createdDoc = await assigneesCollection.findOne({ _id: result.insertedId });
  if (!createdDoc) {
    throw new Error("Assignee was inserted but could not be retrieved");
  }

  return _serializeAssignee(createdDoc);
}

export async function updateAssignee(username, updates) {
  _ensureAssigneeCollection();
  const result = await assigneesCollection.findOneAndUpdate(
    { username },
    { $set: updates },
    { returnDocument: "after" }
  );
  if (!result) {
    return null;
  }
  return _serializeAssignee(result);
}

export async function deleteAssignee(username) {
  _ensureAssigneeCollection();
  const result = await assigneesCollection.deleteOne({ username });
  return result.deletedCount > 0;
}

export async function updateAssigneeLastLogin(username) {
  _ensureAssigneeCollection();
  await assigneesCollection.updateOne(
    { username },
    { $set: { last_login: _now() } }
  );
}

export async function getAllAssignees() {
  _ensureAssigneeCollection();
  const assignees = await assigneesCollection.find({}).sort({ created_at: -1 }).toArray();
  return assignees.map((assignee) => _serializeAssignee(assignee));
}

export async function getAssigneePerformance(assigneeUsername, timePeriod = "month") {
  _ensureCollections();

  // Calculate date range based on time period
  const now = new Date();
  let startDate = new Date();

  switch (timePeriod) {
    case "week":
      startDate.setDate(now.getDate() - 7);
      break;
    case "month":
      startDate.setMonth(now.getMonth() - 1);
      break;
    case "year":
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(now.getMonth() - 1);
  }

  const assigneeMatch = {
    $regex: `^${String(assigneeUsername).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    $options: "i",
  };

  const query = {
    $and: [
      { $or: [{ assignee: assigneeMatch }, { pending_assignee: assigneeMatch }] },
      {
        $or: [
          { created_at: { $gte: startDate } },
          { updated_at: { $gte: startDate } },
          { assignment_dispatched_at: { $gte: startDate } },
        ],
      },
    ],
  };

  const tickets = await ticketsCollection.find(query).toArray();

  // Count total assigned tickets
  const totalAssigned = tickets.length;

  // Count closed tickets (check for both "Closed" and TicketStatus.CLOSED)
  const closedTickets = tickets.filter(ticket =>
    ticket.status === "Closed" || ticket.status === TicketStatus.CLOSED
  ).length;

  // Calculate completion rate
  const completionRate = totalAssigned > 0 ? (closedTickets / totalAssigned) * 100 : 0;

  return {
    assignee: assigneeUsername,
    time_period: timePeriod,
    total_assigned: totalAssigned,
    closed: closedTickets,
    open: totalAssigned - closedTickets,
    completion_rate: Math.round(completionRate * 100) / 100, // Round to 2 decimal places
    start_date: startDate.toISOString(),
    end_date: now.toISOString()
  };
}

export async function getAssigneeContactByUsername(username) {
  _ensureAssigneeCollection();
  _ensureUserCollection();
  if (!username) {
    return null;
  }

  let assignee = await assigneesCollection.findOne({ username });
  if (!assignee) {
    assignee = await usersCollection.findOne({ username, role: "assignee" });
    if (!assignee) {
      return null;
    }
  }

  return {
    username: assignee.username,
    email: assignee.email || null,
    full_name: assignee.full_name || assignee.username,
  };
}

export async function listQueuedAssignmentsForBatch() {
  _ensureCollections();

  const queuedTickets = await ticketsCollection
    .find({
      pending_assignee: { $exists: true, $nin: [null, ""] },
      assignment_dispatched: { $ne: true },
    })
    .sort({ created_at: 1 })
    .toArray();

  return queuedTickets.map((ticket) => _serializeTicket(ticket, []));
}

export async function listPendingReminderTicketsForBatch() {
  _ensureCollections();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const pendingTickets = await ticketsCollection
    .find({
      assignee: { $exists: true, $nin: [null, ""] },
      status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
      $or: [
        { reminder_last_sent_at: { $exists: false } },
        { reminder_last_sent_at: null },
        { reminder_last_sent_at: { $lt: startOfToday } },
      ],
    })
    .sort({ created_at: 1 })
    .toArray();

  return pendingTickets.map((ticket) => _serializeTicket(ticket, []));
}

export async function markReminderSentForTickets(ticketIds) {
  _ensureCollections();
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    return;
  }

  await ticketsCollection.updateMany(
    { _id: { $in: ticketIds } },
    { $set: { reminder_last_sent_at: _now(), updated_at: _now() } }
  );
}

export async function listPendingTicketsForAssignee(username) {
  _ensureCollections();
  if (!username) {
    return [];
  }

  const tickets = await ticketsCollection
    .find({
      assignee: username,
      status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
    })
    .sort({ created_at: 1 })
    .toArray();

  return tickets.map((ticket) => _serializeTicket(ticket, []));
}

// =============================================================================
// OTP DATABASE FUNCTIONS (FOR FORGOT PASSWORD)
// =============================================================================

function _ensureOTPCollection() {
  if (otpsCollection === null) {
    throw new Error("MongoDB OTP collection is not initialized. Call connect() first.");
  }
}

export async function storeOTP(email, otp, expiresInMinutes = 10) {
  _ensureOTPCollection();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // Delete any existing OTPs for this email
  await otpsCollection.deleteMany({ email });

  // Store new OTP
  await otpsCollection.insertOne({
    email,
    otp,
    expires_at: expiresAt,
    created_at: _now(),
  });
}

export async function verifyOTP(email, otp) {
  _ensureOTPCollection();
  const otpDoc = await otpsCollection.findOne({ email, otp });

  if (!otpDoc) {
    return false;
  }

  // Check if expired
  if (otpDoc.expires_at < new Date()) {
    await otpsCollection.deleteOne({ email, otp });
    return false;
  }

  // Delete OTP after successful verification
  await otpsCollection.deleteOne({ email, otp });
  return true;
}

export async function deleteOTP(email) {
  _ensureOTPCollection();
  await otpsCollection.deleteMany({ email });
}

// =============================================================================
// USER DATABASE FUNCTIONS
// =============================================================================

function _ensureUserCollection() {
  if (usersCollection === null) {
    throw new Error("MongoDB users collection is not initialized. Call connect() first.");
  }
}

function _serializeUser(doc) {
  const toISOString = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }
    return null;
  };

  // Handle both ObjectId _id and UUID id field
  // MongoDB documents may have _id as ObjectId and id as UUID string
  const docId = doc.id || (doc._id ? (typeof doc._id === 'string' ? doc._id : doc._id.toString()) : null);

  return {
    id: docId,
    username: doc.username,
    email: doc.email,
    client_name: doc.client_name,
    site_name: doc.site_name,
    site_address: doc.site_address,
    spoc_name: doc.spoc_name,
    spoc_contact: doc.spoc_contact,
    role: doc.role || "user",
    is_active: doc.is_active !== false,
    alert_notifications_enabled: doc.alert_notifications_enabled !== false,
    alert_emails: Array.isArray(doc.alert_emails) ? doc.alert_emails : [],
    alert_cc: Array.isArray(doc.alert_cc) ? doc.alert_cc : [],
    created_at: toISOString(doc.created_at),
    last_login: toISOString(doc.last_login),
  };
}

export async function getUserByUsername(username) {
  _ensureUserCollection();
  // Try exact match first
  let user = await usersCollection.findOne({ username });

  // If not found, try case-insensitive search
  if (!user) {
    const allUsers = await usersCollection.find({}).toArray();
    user = allUsers.find(u =>
      u.username && u.username.toLowerCase() === username.toLowerCase()
    );
  }

  if (!user) {
    return null;
  }
  return user;
}

export async function getUserByEmail(email) {
  _ensureUserCollection();
  const user = await usersCollection.findOne({ email });
  if (!user) {
    return null;
  }
  return user;
}

export async function getUserById(userId) {
  _ensureUserCollection();
  // Try to find by id field first (UUID), then by _id (ObjectId or UUID)
  let user = await usersCollection.findOne({ id: userId });
  if (!user) {
    // Try as ObjectId if it's a valid ObjectId string
    if (ObjectId.isValid(userId) && userId.length === 24) {
      user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    } else {
      // Try as string _id
      user = await usersCollection.findOne({ _id: userId });
    }
  }
  if (!user) {
    return null;
  }
  return user;
}

export async function createUser(userData) {
  _ensureUserCollection();
  // Generate UUID for id field, let MongoDB generate ObjectId for _id
  const userId = userData.id || uuidv4();
  const now = _now();

  const doc = {
    // Let MongoDB generate ObjectId for _id automatically
    id: userId, // UUID string field
    username: userData.username,
    email: userData.email,
    password_hash: userData.password_hash,
    client_name: userData.client_name,
    site_name: userData.site_name,
    site_address: userData.site_address,
    spoc_name: userData.spoc_name,
    spoc_contact: userData.spoc_contact || null,
    role: userData.role || "user",
    is_active: userData.is_active !== false,
    created_at: now,
    last_login: null,
  };

  await usersCollection.insertOne(doc);
  return _serializeUser(doc);
}

export async function updateUser(userId, updates) {
  _ensureUserCollection();
  const updateFields = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== null && value !== undefined) {
      updateFields[key] = value;
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return await getUserById(userId);
  }

  // Try to find by id field first, then by _id
  let query = { id: userId };
  let user = await usersCollection.findOne(query);

  if (!user) {
    // Try as ObjectId if it's a valid ObjectId string
    if (ObjectId.isValid(userId) && userId.length === 24) {
      query = { _id: new ObjectId(userId) };
    } else {
      query = { _id: userId };
    }
  }

  const result = await usersCollection.findOneAndUpdate(
    query,
    { $set: updateFields },
    { returnDocument: "after" }
  );

  if (!result) {
    return null;
  }
  return _serializeUser(result);
}

export async function updateUserLastLogin(username) {
  _ensureUserCollection();
  await usersCollection.updateOne(
    { username },
    { $set: { last_login: _now() } }
  );
}

export async function getAllUsers(filters = {}) {
  _ensureUserCollection();
  const query = {};

  if (filters.roles?.length) {
    query.role = { $in: filters.roles };
  } else if (filters.role) {
    query.role = filters.role;
  }
  if (filters.is_active !== undefined) {
    query.is_active = filters.is_active;
  }
  if (filters.search) {
    const searchRegex = { $regex: filters.search, $options: "i" };
    query.$or = [
      { username: searchRegex },
      { email: searchRegex },
      { client_name: searchRegex },
      { site_name: searchRegex },
    ];
  }

  const users = await usersCollection
    .find(query)
    .sort({ created_at: -1 })
    .toArray();

  return users.map((user) => _serializeUser(user));
}

export async function deleteUser(userId) {
  _ensureUserCollection();
  // Try to find by id field first, then by _id
  let query = { id: userId };
  let user = await usersCollection.findOne(query);

  if (!user) {
    // Try as ObjectId if it's a valid ObjectId string
    if (ObjectId.isValid(userId) && userId.length === 24) {
      query = { _id: new ObjectId(userId) };
    } else {
      query = { _id: userId };
    }
  }

  const result = await usersCollection.findOneAndDelete(query);
  if (result) {
    // Also delete user-sensor assignments
    await userSensorsCollection.deleteMany({ username: result.username });
  }
  return result ? true : false;
}

// =============================================================================
// SENSOR DATABASE FUNCTIONS
// =============================================================================

function _ensureSensorCollection() {
  if (sensorsCollection === null) {
    throw new Error("MongoDB sensors collection is not initialized. Call connect() first.");
  }
}

function _serializeSensor(doc) {
  const toISOString = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }
    return null;
  };

  // Handle both ObjectId _id and UUID id field
  const docId = doc.id || (doc._id ? (typeof doc._id === 'string' ? doc._id : doc._id.toString()) : null);

  return {
    id: docId,
    sensor_id: doc.sensor_id,
    device_id: doc.device_id,
    location: doc.location || {},
    is_active: doc.is_active !== false,
    name: doc.name || "",
    client_name: doc.client_name,
    site_name: doc.site_name,
    site_id: doc.site_id || null,
    site_address: doc.site_address || null,
    spoc_name: doc.spoc_name,
    spoc_contact: doc.spoc_contact,
    remark: doc.remark,
    remark_date: doc.remark_date,
    installation_date: toISOString(doc.installation_date),
    created_at: toISOString(doc.created_at),
  };
}

export async function getSensorById(sensorId) {
  _ensureSensorCollection();
  const sensor = await sensorsCollection.findOne({ sensor_id: sensorId });
  if (!sensor) {
    return null;
  }
  return sensor;
}

export async function createSensor(sensorData) {
  _ensureSensorCollection();
  const sensorId = sensorData.sensor_id;
  if (!sensorId) {
    throw new Error("sensor_id is required");
  }

  const now = _now();
  const doc = {
    // Let MongoDB generate ObjectId for _id automatically
    id: uuidv4(), // UUID string field
    sensor_id: sensorId,
    device_id: sensorData.device_id || sensorId,
    location: sensorData.location || {},
    is_active: sensorData.is_active !== false,
    name: sensorData.name || "",
    client_name: sensorData.client_name,
    site_name: sensorData.site_name,
    site_id: sensorData.site_id || null,
    site_address: sensorData.site_address || null,
    spoc_name: sensorData.spoc_name || null,
    spoc_contact: sensorData.spoc_contact || null,
    remark: sensorData.remark || null,
    remark_date: sensorData.remark_date || null,
    installation_date: sensorData.installation_date ? new Date(sensorData.installation_date) : null,
    created_at: now,
  };

  await sensorsCollection.insertOne(doc);
  return _serializeSensor(doc);
}

export async function updateSensor(sensorId, updates) {
  _ensureSensorCollection();
  const updateFields = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== null && value !== undefined) {
      updateFields[key] = value;
    }
  }

  // Store installation_date as a real Date so it can be queried by range
  if (typeof updateFields.installation_date === "string") {
    const parsed = new Date(updateFields.installation_date);
    if (isNaN(parsed.getTime())) {
      delete updateFields.installation_date;
    } else {
      updateFields.installation_date = parsed;
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return await getSensorById(sensorId);
  }

  const result = await sensorsCollection.findOneAndUpdate(
    { sensor_id: sensorId },
    { $set: updateFields },
    { returnDocument: "after" }
  );

  if (!result) {
    return null;
  }
  return _serializeSensor(result);
}

export async function getAllSensors(filters = {}) {
  _ensureSensorCollection();
  const query = {};

  if (filters.is_active !== undefined) {
    query.is_active = filters.is_active === true || filters.is_active === "true";
  }
  if (filters.client_name) {
    query.client_name = filters.client_name;
  }
  if (filters.search) {
    const searchRegex = { $regex: filters.search, $options: "i" };
    query.$or = [
      { sensor_id: searchRegex },
      { device_id: searchRegex },
      { client_name: searchRegex },
      { site_name: searchRegex },
    ];
  }

  const sensors = await sensorsCollection
    .find(query)
    .sort({ created_at: -1 })
    .toArray();

  if (sensors.length === 0) {
    return [];
  }

  return sensors.map((sensor) => _serializeSensor(sensor));
}

export async function deleteSensor(sensorId) {
  _ensureSensorCollection();
  // Delete sensor and all user-sensor assignments
  await userSensorsCollection.deleteMany({ sensor_id: sensorId });
  const result = await sensorsCollection.findOneAndDelete({ sensor_id: sensorId });
  return result ? true : false;
}

// ========== Calibration Database Functions ==========

function _ensureCalibrationCollection() {
  if (calibrationsCollection === null) {
    throw new Error("MongoDB calibrations collection is not initialized. Call connect() first.");
  }
}

function _serializeCalibration(doc) {
  if (!doc) return null;
  const toISOString = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }
    return null;
  };

  const docId = doc.id || (doc._id ? (typeof doc._id === 'string' ? doc._id : doc._id.toString()) : null);

  // Support both old format (rh_strength_a, etc.) and new format (pm25/pm10)
  if (doc.pm25 || doc.pm10) {
    // New format: pm25/pm10 structure
    return {
      id: docId,
      sensor_id: doc.sensor_id,
      pm25: {
        k0: doc.pm25?.k0 ?? 0,
        k1: doc.pm25?.k1 ?? 1,
        variationMin: doc.pm25?.variationMin ?? 0,
        variationMax: doc.pm25?.variationMax ?? 0,
      },
      pm10: {
        k0: doc.pm10?.k0 ?? 0,
        k1: doc.pm10?.k1 ?? 1,
        variationMin: doc.pm10?.variationMin ?? 0,
        variationMax: doc.pm10?.variationMax ?? 0,
      },
      created_at: toISOString(doc.created_at),
      updated_at: toISOString(doc.updated_at),
    };
  } else {
    // Old format: legacy fields (for backward compatibility)
    return {
      id: docId,
      sensor_id: doc.sensor_id,
      rh_strength_a: doc.rh_strength_a ?? 0,
      rh_curvature_b: doc.rh_curvature_b ?? 0,
      initial_offset_k0: doc.initial_offset_k0 ?? 0,
      fine_multiplier_k1: doc.fine_multiplier_k1 ?? 1,
      offset_alpha: doc.offset_alpha ?? null,
      scale_factor_beta: doc.scale_factor_beta ?? null,
      pm_swap: doc.pm_swap ?? false,
      random_offset_pm25: doc.random_offset_pm25 ?? null,
      random_offset_pm10: doc.random_offset_pm10 ?? null,
      created_at: toISOString(doc.created_at),
      updated_at: toISOString(doc.updated_at),
    };
  }
}

export async function getCalibrationBySensorId(sensorId) {
  _ensureCalibrationCollection();
  const calibration = await calibrationsCollection.findOne({ sensor_id: sensorId });
  if (!calibration) {
    return null;
  }
  return _serializeCalibration(calibration);
}

export async function createCalibration(calibrationData) {
  _ensureCalibrationCollection();
  const sensorId = calibrationData.sensor_id;
  if (!sensorId) {
    throw new Error("sensor_id is required");
  }

  // Check if calibration already exists
  const existing = await calibrationsCollection.findOne({ sensor_id: sensorId });
  if (existing) {
    throw new Error("Calibration already exists for this sensor_id");
  }

  const now = new Date();

  // Support both new format (pm25/pm10) and old format (legacy fields)
  let doc;
  if (calibrationData.pm25 || calibrationData.pm10) {
    // New format: pm25/pm10 structure
    doc = {
      id: uuidv4(),
      sensor_id: sensorId,
      pm25: {
        k0: calibrationData.pm25?.k0 ?? 0,
        k1: calibrationData.pm25?.k1 ?? 1,
        variationMin: calibrationData.pm25?.variationMin ?? 0,
        variationMax: calibrationData.pm25?.variationMax ?? 0,
      },
      pm10: {
        k0: calibrationData.pm10?.k0 ?? 0,
        k1: calibrationData.pm10?.k1 ?? 1,
        variationMin: calibrationData.pm10?.variationMin ?? 0,
        variationMax: calibrationData.pm10?.variationMax ?? 0,
      },
      created_at: now,
      updated_at: now,
    };
  } else {
    // Old format: legacy fields (for backward compatibility)
    doc = {
      id: uuidv4(),
      sensor_id: sensorId,
      rh_strength_a: calibrationData.rh_strength_a ?? 0,
      rh_curvature_b: calibrationData.rh_curvature_b ?? 0,
      initial_offset_k0: calibrationData.initial_offset_k0 ?? 0,
      fine_multiplier_k1: calibrationData.fine_multiplier_k1 ?? 1,
      offset_alpha: calibrationData.offset_alpha ?? null,
      scale_factor_beta: calibrationData.scale_factor_beta ?? null,
      pm_swap: calibrationData.pm_swap ?? false,
      random_offset_pm25: calibrationData.random_offset_pm25 ?? null,
      random_offset_pm10: calibrationData.random_offset_pm10 ?? null,
      created_at: now,
      updated_at: now,
    };
  }

  await calibrationsCollection.insertOne(doc);
  return _serializeCalibration(doc);
}

export async function updateCalibration(sensorId, updates) {
  _ensureCalibrationCollection();
  const updateFields = {};

  // Support both new format (pm25/pm10) and old format (legacy fields)
  if (updates.pm25 || updates.pm10) {
    // New format: pm25/pm10 structure
    if (updates.pm25) {
      updateFields.pm25 = {
        k0: updates.pm25.k0 ?? 0,
        k1: updates.pm25.k1 ?? 1,
        variationMin: updates.pm25.variationMin ?? 0,
        variationMax: updates.pm25.variationMax ?? 0,
      };
    }
    if (updates.pm10) {
      updateFields.pm10 = {
        k0: updates.pm10.k0 ?? 0,
        k1: updates.pm10.k1 ?? 1,
        variationMin: updates.pm10.variationMin ?? 0,
        variationMax: updates.pm10.variationMax ?? 0,
      };
    }
  } else {
    // Old format: legacy fields (for backward compatibility)
    const allowedFields = [
      'rh_strength_a', 'rh_curvature_b', 'initial_offset_k0', 'fine_multiplier_k1',
      'offset_alpha', 'scale_factor_beta', 'pm_swap', 'random_offset_pm25', 'random_offset_pm10'
    ];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields[key] = value;
      }
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return await getCalibrationBySensorId(sensorId);
  }

  updateFields.updated_at = new Date();

  const result = await calibrationsCollection.findOneAndUpdate(
    { sensor_id: sensorId },
    { $set: updateFields },
    { returnDocument: "after" }
  );

  if (!result) {
    return null;
  }
  return _serializeCalibration(result);
}

// =============================================================================
// USER-SENSOR ASSIGNMENT DATABASE FUNCTIONS
// =============================================================================

function _ensureUserSensorCollection() {
  if (userSensorsCollection === null) {
    throw new Error("MongoDB user_sensors collection is not initialized. Call connect() first.");
  }
}

function _serializeUserSensor(doc) {
  const toISOString = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }
    return null;
  };

  // Handle both ObjectId _id and UUID id field
  const docId = doc.id || (doc._id ? (typeof doc._id === 'string' ? doc._id : doc._id.toString()) : null);

  return {
    id: docId,
    username: doc.username,
    sensor_id: doc.sensor_id,
    assigned_at: toISOString(doc.assigned_at),
  };
}

export async function assignSensorToUser(username, sensorId) {
  _ensureUserSensorCollection();

  // Check if assignment already exists
  const existing = await userSensorsCollection.findOne({ username, sensor_id: sensorId });
  if (existing) {
    return _serializeUserSensor(existing);
  }

  const assignmentId = uuidv4();
  const now = _now();

  const doc = {
    // Let MongoDB generate ObjectId for _id automatically
    id: assignmentId, // UUID string field
    username,
    sensor_id: sensorId,
    assigned_at: now,
  };

  await userSensorsCollection.insertOne(doc);
  return _serializeUserSensor(doc);
}

export async function assignSensorsToUser(username, sensorIds) {
  _ensureUserSensorCollection();
  const now = _now();
  const assignments = [];

  for (const sensorId of sensorIds) {
    // Check if assignment already exists
    const existing = await userSensorsCollection.findOne({ username, sensor_id: sensorId });
    if (!existing) {
      const doc = {
        // Let MongoDB generate ObjectId for _id automatically
        id: uuidv4(), // UUID string field
        username,
        sensor_id: sensorId,
        assigned_at: now,
      };
      await userSensorsCollection.insertOne(doc);
      assignments.push(_serializeUserSensor(doc));
    } else {
      assignments.push(_serializeUserSensor(existing));
    }
  }

  return assignments;
}

export async function getUserSensors(username) {
  _ensureUserSensorCollection();
  const assignments = await userSensorsCollection
    .find({ username })
    .sort({ assigned_at: -1 })
    .toArray();

  if (assignments.length === 0) {
    return [];
  }

  // Fetch all assigned sensors in a single query instead of one query per assignment
  _ensureSensorCollection();
  const sensorDocs = await sensorsCollection
    .find({ sensor_id: { $in: assignments.map((a) => a.sensor_id) } })
    .toArray();
  const sensorsById = new Map(sensorDocs.map((s) => [s.sensor_id, s]));

  const sensors = [];
  for (const assignment of assignments) {
    const sensor = sensorsById.get(assignment.sensor_id);
    if (sensor) {
      sensors.push({
        ..._serializeSensor(sensor),
        assigned_at: _serializeUserSensor(assignment).assigned_at,
      });
    }
  }

  return sensors;
}

// Get users by role - checks both users and assignees collections
export async function getUsersByRole(role) {
  const result = [];

  if (role === "user" || role === "client") {
    // Get from users collection
    _ensureUserCollection();
    const users = await usersCollection
      .find({ role: role, is_active: true })
      .sort({ created_at: -1 })
      .toArray();
    result.push(...users.map((user) => ({
      username: user.username,
      email: user.email,
      role: user.role,
      client_name: user.client_name || "",
      site_name: user.site_name || "",
    })));
  } else if (role === "assignee") {
    // Get from assignees collection
    _ensureAssigneeCollection();
    const assignees = await assigneesCollection
      .find({ is_active: true })
      .sort({ created_at: -1 })
      .toArray();
    result.push(...assignees.map((assignee) => ({
      username: assignee.username,
      email: assignee.email,
      role: "assignee",
      full_name: assignee.full_name || "",
    })));
  } else if (role === "engineer" || role === "technician") {
    // Check if engineers/technicians are stored in users collection with role field
    _ensureUserCollection();
    const users = await usersCollection
      .find({ role: role, is_active: true })
      .sort({ created_at: -1 })
      .toArray();
    result.push(...users.map((user) => ({
      username: user.username,
      email: user.email,
      role: user.role,
      client_name: user.client_name || "",
      site_name: user.site_name || "",
    })));

    // Also check assignees collection for engineers/technicians
    _ensureAssigneeCollection();
    const assignees = await assigneesCollection
      .find({ role: role, is_active: true })
      .sort({ created_at: -1 })
      .toArray();
    result.push(...assignees.map((assignee) => ({
      username: assignee.username,
      email: assignee.email,
      role: assignee.role || "assignee",
      full_name: assignee.full_name || "",
    })));
  }

  return result;
}

export async function removeSensorFromUser(username, sensorId) {
  _ensureUserSensorCollection();
  const result = await userSensorsCollection.findOneAndDelete({ username, sensor_id: sensorId });
  return result ? true : false;
}

export async function removeAllSensorsFromUser(username) {
  _ensureUserSensorCollection();
  await userSensorsCollection.deleteMany({ username });
  return true;
}

export async function getUsersForSensor(sensorId) {
  _ensureUserSensorCollection();

  // Try exact match first
  let assignments = await userSensorsCollection
    .find({ sensor_id: sensorId })
    .sort({ assigned_at: -1 })
    .toArray();

  // If no exact match, try case-insensitive match
  if (assignments.length === 0) {
    assignments = await userSensorsCollection
      .find({ sensor_id: { $regex: new RegExp(`^${sensorId}$`, 'i') } })
      .sort({ assigned_at: -1 })
      .toArray();
  }

  // Also try matching by name field if sensorId might be a name
  if (assignments.length === 0) {
    // Check if there's a sensor with this name and get its sensor_id
    const sensor = await sensorsCollection.findOne({
      $or: [
        { sensor_id: sensorId },
        { name: sensorId },
        { identifier: sensorId }
      ]
    });

    if (sensor && sensor.sensor_id) {
      assignments = await userSensorsCollection
        .find({ sensor_id: sensor.sensor_id })
        .sort({ assigned_at: -1 })
        .toArray();
    }
  }

  return assignments.map((assignment) => _serializeUserSensor(assignment));
}

export function getDatabase() {
  if (!mongoClient || !mongoClient.db()) {
    throw new Error("Database connection not established.");
  }
  return mongoClient.db();
}

// =============================================================================
// SITE DATABASE FUNCTIONS
// =============================================================================

function _ensureSiteCollection() {
  if (sitesCollection === null) {
    throw new Error("MongoDB sites collection is not initialized. Call connect() first.");
  }
}

function _serializeSite(doc) {
  const toISOString = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }
    return null;
  };

  const docId = doc.id || (doc._id ? (typeof doc._id === 'string' ? doc._id : doc._id.toString()) : null);

  return {
    id: docId,
    site_id: doc.site_id,
    site_name: doc.site_name || "",
    site_address: doc.site_address || "",
    location: doc.location || {},
    client_name: doc.client_name || "",
    created_at: toISOString(doc.created_at),
  };
}

export async function createSite(siteData) {
  _ensureSensorCollection();

  // Check if site with this name already exists in sensors
  const existingSensor = await sensorsCollection.findOne({
    site_name: siteData.site_name,
    site_name: { $exists: true, $ne: "", $ne: null }
  });

  if (existingSensor) {
    throw new Error("Site with this name already exists in sensors");
  }

  // Sites are created implicitly when sensors are created with site_name
  // So we just return the site data structure
  const siteId = siteData.site_id || `site_${siteData.site_name.replace(/\s+/g, '_').toLowerCase()}`;
  const now = _now();

  const site = {
    id: uuidv4(),
    site_id: siteId,
    site_name: siteData.site_name || "",
    site_address: siteData.site_address || "",
    location: siteData.location || {},
    client_name: siteData.client_name || "",
    created_at: now,
  };

  return _serializeSite(site);
}

export async function getSiteById(siteId) {
  _ensureSensorCollection();
  // Find a sensor with matching site_id or site_name
  // Note: siteId can be either a site_id (like "site_manufacturing_unit_e") or site_name (like "Manufacturing Unit E")
  // Since sites are derived from sensors by site_name, we prioritize site_name lookup
  const sensor = await sensorsCollection.findOne({
    $or: [
      { site_name: siteId }, // First try site_name (most reliable since it exists in sensors)
      { site_id: siteId }    // Then try site_id (may not exist in all sensors)
    ],
    site_name: { $exists: true, $ne: "", $ne: null }
  });

  if (!sensor) {
    return null;
  }

  // Return site object based on sensor
  return {
    id: sensor.id || uuidv4(),
    site_id: sensor.site_id || `site_${sensor.site_name.replace(/\s+/g, '_').toLowerCase()}`,
    site_name: sensor.site_name,
    site_address: sensor.site_address || "",
    location: sensor.location || {},
    client_name: sensor.client_name || "",
    created_at: sensor.created_at || new Date(),
  };
}

export async function getSiteByIdSerialized(siteId) {
  const site = await getSiteById(siteId);
  if (!site) {
    return null;
  }
  return _serializeSite(site);
}

export async function getAllSites(filters = {}) {
  _ensureSensorCollection();

  // Build query to find sensors with site_name
  const sensorQuery = {
    site_name: { $exists: true, $ne: "", $ne: null }
  };

  if (filters.site_name) {
    const searchRegex = { $regex: filters.site_name, $options: "i" };
    sensorQuery.site_name = { ...sensorQuery.site_name, ...searchRegex };
  }
  if (filters.client_name) {
    sensorQuery.client_name = filters.client_name;
  }

  // Get sensors with site_name (project only needed fields)
  const sensors = await sensorsCollection
    .find(
      sensorQuery,
      {
        projection: {
          site_id: 1,
          site_name: 1,
          site_address: 1,
          address: 1,
          location: 1,
          client_name: 1,
          created_at: 1,
        }
      }
    )
    .toArray();

  // Extract unique sites from sensors
  const siteMap = new Map();

  for (const sensor of sensors) {
    const siteName = sensor.site_name;
    if (siteName && siteName.trim() !== "") {
      // Use site_name as the key and keep first encountered sensor details
      if (!siteMap.has(siteName)) {
        const siteId = sensor.site_id || `site_${siteName.replace(/\s+/g, '_').toLowerCase()}`;

        // Try to get address from various possible fields
        const address = sensor.site_address ||
          sensor.address ||
          (sensor.location?.address ? sensor.location.address : "") ||
          "";

        siteMap.set(siteName, {
          id: uuidv4(), // Generate a temporary ID
          site_id: siteId,
          site_name: siteName,
          site_address: address,
          location: sensor.location || {},
          client_name: sensor.client_name || "",
          created_at: sensor.created_at || new Date(),
        });
      }
    }
  }

  // Convert map to array and sort
  const sites = Array.from(siteMap.values()).sort((a, b) => {
    const dateA = a.created_at instanceof Date ? a.created_at : new Date(a.created_at);
    const dateB = b.created_at instanceof Date ? b.created_at : new Date(b.created_at);
    return dateB - dateA;
  });

  return sites.map((site) => _serializeSite(site));
}

export async function updateSite(siteId, updates) {
  _ensureSensorCollection();

  // Update all sensors with this site_name
  const updateFields = {};
  const allowedFields = ['site_name', 'site_address', 'location', 'client_name'];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== null && value !== undefined && allowedFields.includes(key)) {
      updateFields[key] = value;
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return await getSiteByIdSerialized(siteId);
  }

  // Find sensors with this site (by site_id or site_name)
  const query = {
    $or: [
      { site_id: siteId },
      { site_name: siteId }
    ],
    site_name: { $exists: true, $ne: "", $ne: null }
  };

  // Get the original site_name to update all sensors
  const firstSensor = await sensorsCollection.findOne(query);
  if (!firstSensor) {
    return null;
  }

  const originalSiteName = firstSensor.site_name;

  // Update all sensors with this site_name
  const result = await sensorsCollection.updateMany(
    { site_name: originalSiteName },
    { $set: updateFields }
  );

  if (result.matchedCount === 0) {
    return null;
  }

  // Return updated site
  const updatedSensor = await sensorsCollection.findOne({ site_name: updates.site_name || originalSiteName });
  if (!updatedSensor) {
    return await getSiteByIdSerialized(siteId);
  }

  return _serializeSite({
    id: updatedSensor.id || uuidv4(),
    site_id: updatedSensor.site_id || siteId,
    site_name: updatedSensor.site_name,
    site_address: updatedSensor.site_address || "",
    location: updatedSensor.location || {},
    client_name: updatedSensor.client_name || "",
    created_at: updatedSensor.created_at || new Date(),
  });
}

export async function deleteSite(siteId) {
  _ensureSensorCollection();
  _ensureUserSiteCollection();

  // Find the site name from sensors
  const sensor = await sensorsCollection.findOne({
    $or: [
      { site_id: siteId },
      { site_name: siteId }
    ],
    site_name: { $exists: true, $ne: "", $ne: null }
  });

  if (!sensor) {
    return false;
  }

  const siteName = sensor.site_name;

  // Remove site_id from all sensors with this site_name (set to null)
  await sensorsCollection.updateMany(
    { site_name: siteName },
    { $unset: { site_id: "" } }
  );

  // Remove user-site assignments
  await userSitesCollection.deleteMany({
    $or: [
      { site_id: siteId },
      { site_id: siteName }
    ]
  });

  return true;
}

// =============================================================================
// USER-SITE ASSIGNMENT DATABASE FUNCTIONS
// =============================================================================

function _ensureUserSiteCollection() {
  if (userSitesCollection === null) {
    throw new Error("MongoDB user_sites collection is not initialized. Call connect() first.");
  }
}

function _serializeUserSite(doc) {
  const toISOString = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }
    return null;
  };

  return {
    id: doc.id || (doc._id ? (typeof doc._id === 'string' ? doc._id : doc._id.toString()) : null),
    username: doc.username,
    site_id: doc.site_id,
    assigned_at: toISOString(doc.assigned_at),
  };
}

export async function assignSitesToUser(username, siteIds) {
  _ensureUserSiteCollection();
  const now = _now();
  const assignments = [];

  for (const siteId of siteIds) {
    // siteId can be either site_id or site_name - normalize to site_name for storage
    // First, get the site to ensure it exists and get the actual site_name
    const site = await getSiteById(siteId);
    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    // Use site_name as the identifier for assignments (since sites are derived from sensors by site_name)
    const siteIdentifier = site.site_name || siteId;

    // Check if assignment already exists (by site_name or site_id)
    const existing = await userSitesCollection.findOne({
      username,
      $or: [
        { site_id: siteIdentifier },
        { site_id: site.site_id },
        { site_id: siteId }
      ]
    });

    if (!existing) {
      const doc = {
        id: uuidv4(),
        username,
        site_id: siteIdentifier, // Store site_name as site_id in user_sites collection
        assigned_at: now,
      };
      await userSitesCollection.insertOne(doc);
      assignments.push(_serializeUserSite(doc));
    } else {
      assignments.push(_serializeUserSite(existing));
    }
  }

  return assignments;
}

export async function getUserSites(username) {
  _ensureUserSiteCollection();
  _ensureSiteCollection();

  const assignments = await userSitesCollection
    .find({ username })
    .sort({ assigned_at: -1 })
    .toArray();

  // Get site details for each assignment
  const sites = [];
  for (const assignment of assignments) {
    const site = await getSiteById(assignment.site_id);
    if (site) {
      sites.push({
        ..._serializeSite(site),
        assigned_at: _serializeUserSite(assignment).assigned_at,
      });
    }
  }

  return sites;
}

export async function getUsersForSite(siteId) {
  _ensureUserSiteCollection();
  const assignments = await userSitesCollection
    .find({ site_id: siteId })
    .sort({ assigned_at: -1 })
    .toArray();

  return assignments.map((assignment) => _serializeUserSite(assignment));
}

export async function removeSiteFromUser(username, siteId) {
  _ensureUserSiteCollection();
  // siteId can be either site_id or site_name
  // Since user_sites stores site_name as site_id (see assignSitesToUser line 1633),
  // we need to handle both cases
  let result = await userSitesCollection.findOneAndDelete({ username, site_id: siteId });

  // If not found, try to get the site and use its site_name
  // (since stored site_id is actually the site_name)
  if (!result) {
    const site = await getSiteById(siteId);
    if (site && site.site_name) {
      // Try removing with site_name (which is what's stored in user_sites.site_id)
      result = await userSitesCollection.findOneAndDelete({
        username,
        site_id: site.site_name
      });
    }
  }

  return result ? true : false;
}

export async function removeAllSitesFromUser(username) {
  _ensureUserSiteCollection();
  await userSitesCollection.deleteMany({ username });
  return true;
}

export async function getSensorsForSite(siteId) {
  _ensureSensorCollection();
  // Find sensors by site_id or site_name
  const sensors = await sensorsCollection
    .find({
      $or: [
        { site_id: siteId },
        { site_name: siteId }
      ],
      site_name: { $exists: true, $ne: "", $ne: null }
    })
    .sort({ created_at: -1 })
    .toArray();

  return sensors.map((sensor) => _serializeSensor(sensor));
}

// Share Access Token Functions
function _ensureShareAccessTokenCollection() {
  if (shareAccessTokensCollection === null) {
    throw new Error("Database connection not established. Call connect() first.");
  }
}

function _serializeShareAccessToken(doc) {
  return {
    id: doc.id || doc._id?.toString(),
    _id: doc._id?.toString(),
    token_hash: doc.token_hash,
    sensor_id: doc.sensor_id,
    email: doc.email,
    created_by: doc.created_by,
    created_at: doc.created_at,
    expires_at: doc.expires_at,
    used: doc.used || false,
    used_at: doc.used_at || null,
    revoked: doc.revoked || false,
    revoked_at: doc.revoked_at || null,
    revoked_by: doc.revoked_by || null,
    permissions: doc.permissions || ["view"],
    ip_address: doc.ip_address || null,
    user_agent: doc.user_agent || null,
    session_id: doc.session_id || null,
  };
}

// Generate a share access token
export async function createShareAccessToken(data) {
  _ensureShareAccessTokenCollection();

  // Generate random token
  const token = crypto.randomBytes(32).toString('hex');

  // Hash the token before storing
  const tokenHash = await bcrypt.hash(token, 10);

  const tokenId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (data.duration_hours || 24) * 3600000);

  const doc = {
    id: tokenId,
    token_hash: tokenHash,
    sensor_id: data.sensor_id,
    email: data.email,
    created_by: data.created_by,
    created_at: now,
    expires_at: expiresAt,
    used: false,
    used_at: null,
    revoked: false,
    revoked_at: null,
    revoked_by: null,
    permissions: data.permissions || ["view"],
    ip_address: null,
    user_agent: null,
    session_id: null,
  };

  await shareAccessTokensCollection.insertOne(doc);

  // Return the plain token (only time it's returned - for email)
  return {
    token: token,
    tokenData: _serializeShareAccessToken(doc)
  };
}

// Validate and use a share access token
export async function validateShareAccessToken(token, ipAddress = null, userAgent = null) {
  _ensureShareAccessTokenCollection();

  // Get all active tokens (we need to check each one since they're hashed)
  // Removed used: false check to allow multiple uses
  const tokens = await shareAccessTokensCollection.find({
    revoked: false,
    expires_at: { $gt: new Date() }
  }).toArray();

  // Find matching token by comparing hash
  let matchedToken = null;
  for (const tokenDoc of tokens) {
    const isMatch = await bcrypt.compare(token, tokenDoc.token_hash);
    if (isMatch) {
      matchedToken = tokenDoc;
      break;
    }
  }

  if (!matchedToken) {
    return null; // Token not found, expired, used, or revoked
  }

  // Token "used" marking is intentionally disabled so share links can be reused.

  return _serializeShareAccessToken(matchedToken);
}

// Get active tokens for a sensor
export async function getShareAccessTokens(sensorId) {
  _ensureShareAccessTokenCollection();

  const tokens = await shareAccessTokensCollection
    .find({ sensor_id: sensorId })
    .sort({ created_at: -1 })
    .toArray();

  return tokens.map(_serializeShareAccessToken);
}

// Revoke a share access token
export async function revokeShareAccessToken(tokenId, revokedBy) {
  _ensureShareAccessTokenCollection();

  const result = await shareAccessTokensCollection.updateOne(
    { id: tokenId },
    {
      $set: {
        revoked: true,
        revoked_at: new Date(),
        revoked_by: revokedBy
      }
    }
  );

  return result.modifiedCount > 0;
}

// Revoke all tokens for a sensor/email combination
export async function revokeAllShareAccessTokens(sensorId, email) {
  _ensureShareAccessTokenCollection();

  const result = await shareAccessTokensCollection.updateMany(
    { sensor_id: sensorId, email: email, used: false, revoked: false },
    {
      $set: {
        revoked: true,
        revoked_at: new Date()
      }
    }
  );

  return result.modifiedCount;
}

// =============================================================================
// SENSOR READINGS DATABASE FUNCTIONS
// =============================================================================

function _ensureSensorReadingCollection() {
  if (sensorReadingsCollection === null) {
    throw new Error("MongoDB sensor_readings collection is not initialized. Call connect() first.");
  }
}

function _serializeSensorReading(doc) {
  const toISOString = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }
    return null;
  };

  return {
    id: doc.id || (doc._id ? (typeof doc._id === 'string' ? doc._id : doc._id.toString()) : null),
    sensor_id: doc.sensor_id,
    pm2_5: doc.pm2_5 ?? doc.pms_2_5 ?? null,
    pm10_0: doc.pm10_0 ?? doc.pms_10 ?? null,
    pms_2_5: doc.pms_2_5 ?? doc.pm2_5 ?? null,
    pms_10: doc.pms_10 ?? doc.pm10_0 ?? null,
    temperature: doc.temperature ?? doc.ambient_temperature ?? null,
    humidity: doc.humidity ?? doc.relative_humidity ?? null,
    timestamp: toISOString(doc.timestamp),
    created_at: toISOString(doc.created_at),
  };
}

// Store a sensor reading
export async function storeSensorReading(sensorId, readingData) {
  _ensureSensorReadingCollection();

  const now = new Date();
  const timestamp = readingData.timestamp ? new Date(readingData.timestamp) : now;

  // Avoid storing duplicate readings (same sensor_id and timestamp within 1 second)
  const existing = await sensorReadingsCollection.findOne({
    sensor_id: sensorId,
    timestamp: {
      $gte: new Date(timestamp.getTime() - 1000),
      $lte: new Date(timestamp.getTime() + 1000)
    }
  });

  if (existing) {
    // Update existing reading instead of creating duplicate
    const doc = {
      sensor_id: sensorId,
      pm2_5: readingData.pm2_5 ?? readingData.pms_2_5 ?? null,
      pm10_0: readingData.pm10_0 ?? readingData.pms_10 ?? null,
      pms_2_5: readingData.pms_2_5 ?? readingData.pm2_5 ?? null,
      pms_10: readingData.pms_10 ?? readingData.pm10_0 ?? null,
      temperature: readingData.temperature ?? readingData.ambient_temperature ?? null,
      humidity: readingData.humidity ?? readingData.relative_humidity ?? null,
      timestamp: timestamp,
      created_at: existing.created_at || now,
    };

    await sensorReadingsCollection.updateOne(
      { _id: existing._id },
      { $set: doc }
    );

    return _serializeSensorReading({ ...doc, _id: existing._id });
  }

  // Create new reading
  const doc = {
    id: uuidv4(),
    sensor_id: sensorId,
    pm2_5: readingData.pm2_5 ?? readingData.pms_2_5 ?? null,
    pm10_0: readingData.pm10_0 ?? readingData.pms_10 ?? null,
    pms_2_5: readingData.pms_2_5 ?? readingData.pm2_5 ?? null,
    pms_10: readingData.pms_10 ?? readingData.pm10_0 ?? null,
    temperature: readingData.temperature ?? readingData.ambient_temperature ?? null,
    humidity: readingData.humidity ?? readingData.relative_humidity ?? null,
    timestamp: timestamp,
    created_at: now,
  };

  await sensorReadingsCollection.insertOne(doc);
  return _serializeSensorReading(doc);
}

// Get latest reading for a sensor
export async function getLatestSensorReading(sensorId) {
  _ensureSensorReadingCollection();

  const reading = await sensorReadingsCollection
    .findOne(
      { sensor_id: sensorId },
      { sort: { timestamp: -1 } }
    );

  if (!reading) {
    return null;
  }

  return _serializeSensorReading(reading);
}

export async function getAllLatestSensorReadings(sensorIds = null) {
  _ensureSensorReadingCollection();

  // Sorting by (sensor_id, timestamp) matches the compound index, letting the
  // $group below run as a DISTINCT_SCAN instead of sorting the full collection
  const pipeline = [
    ...(sensorIds && sensorIds.length > 0 ? [{ $match: { sensor_id: { $in: sensorIds } } }] : []),
    { $sort: { sensor_id: 1, timestamp: -1 } },
    {
      $group: {
        _id: "$sensor_id",
        sensor_id: { $first: "$sensor_id" },
        timestamp: { $first: "$timestamp" },
        pm2_5: { $first: "$pm2_5" },
        pm10_0: { $first: "$pm10_0" },
        pms_2_5: { $first: "$pms_2_5" },
        pms_10: { $first: "$pms_10" },
        temperature: { $first: "$temperature" },
        humidity: { $first: "$humidity" },
        ambient_temperature: { $first: "$ambient_temperature" },
        relative_humidity: { $first: "$relative_humidity" },
      }
    }
  ];

  const results = await sensorReadingsCollection.aggregate(pipeline).toArray();

  const readings = {};
  for (const reading of results) {
    readings[reading.sensor_id] = {
      sensor_id: reading.sensor_id,
      timestamp: reading.timestamp,
      pm2_5: reading.pm2_5 ?? reading.pms_2_5 ?? null,
      pm10_0: reading.pm10_0 ?? reading.pms_10 ?? null,
      temperature: reading.temperature ?? reading.ambient_temperature ?? null,
      humidity: reading.humidity ?? reading.relative_humidity ?? null,
    };
  }

  return readings;
}

// Get readings for a sensor within a time range
export async function getSensorReadings(sensorId, startDate = null, endDate = null, limit = 1000) {
  _ensureSensorReadingCollection();

  const query = { sensor_id: sensorId };

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) {
      query.timestamp.$gte = new Date(startDate);
    }
    if (endDate) {
      query.timestamp.$lte = new Date(endDate);
    }
  }

  const readings = await sensorReadingsCollection
    .find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();

  return readings.map(reading => _serializeSensorReading(reading));
}

// ALERT NOTIFICATION DATABASE FUNCTIONS

function _ensureAlertCollections() {
  if (alertStatesCollection === null || alertLogsCollection === null) {
    throw new Error("MongoDB alert collections are not initialized. Call connect() first.");
  }
}

function _serializeAlertLog(doc) {
  const toISOString = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
  };

  return {
    id: doc.id || (doc._id ? doc._id.toString() : null),
    alert_type: doc.alert_type,
    sensor_id: doc.sensor_id,
    client_name: doc.client_name || null,
    site_name: doc.site_name || null,
    site_address: doc.site_address || null,
    reading_value: doc.reading_value ?? null,
    offline_duration_hours: doc.offline_duration_hours ?? null,
    recipients: Array.isArray(doc.recipients) ? doc.recipients : [],
    cc: Array.isArray(doc.cc) ? doc.cc : [],
    delivery_status: doc.delivery_status,
    alert_status: doc.alert_status,
    created_at: toISOString(doc.created_at),
    resolved_at: toISOString(doc.resolved_at),
  };
}

// Per-sensor alert bookkeeping (last time each alert type was emailed)
export async function getAlertStates() {
  _ensureAlertCollections();
  const states = await alertStatesCollection.find({}).toArray();
  const bySensor = {};
  for (const state of states) {
    bySensor[state.sensor_id] = state;
  }
  return bySensor;
}

export async function updateAlertState(sensorId, fields) {
  _ensureAlertCollections();
  await alertStatesCollection.updateOne(
    { sensor_id: sensorId },
    { $set: { ...fields, sensor_id: sensorId, updated_at: _now() } },
    { upsert: true }
  );
}

export async function createAlertLog(entry) {
  _ensureAlertCollections();
  const doc = {
    id: uuidv4(),
    alert_type: entry.alert_type,
    sensor_id: entry.sensor_id,
    client_name: entry.client_name || null,
    site_name: entry.site_name || null,
    site_address: entry.site_address || null,
    reading_value: entry.reading_value ?? null,
    offline_duration_hours: entry.offline_duration_hours ?? null,
    recipients: entry.recipients || [],
    cc: entry.cc || [],
    delivery_status: entry.delivery_status,
    alert_status: "open",
    created_at: _now(),
    resolved_at: null,
  };
  await alertLogsCollection.insertOne(doc);
  return _serializeAlertLog(doc);
}

// Mark all open alerts of a type for a sensor as resolved (called when condition clears)
export async function resolveOpenAlerts(sensorId, alertType) {
  _ensureAlertCollections();
  const result = await alertLogsCollection.updateMany(
    { sensor_id: sensorId, alert_type: alertType, alert_status: "open" },
    { $set: { alert_status: "resolved", resolved_at: _now() } }
  );
  return result.modifiedCount;
}

export async function getAlertLogs(filters = {}) {
  _ensureAlertCollections();
  const query = {};

  if (filters.alert_type) {
    query.alert_type = filters.alert_type;
  }
  if (filters.alert_status) {
    query.alert_status = filters.alert_status;
  }
  if (filters.search) {
    const searchRegex = { $regex: filters.search, $options: "i" };
    query.$or = [
      { sensor_id: searchRegex },
      { client_name: searchRegex },
      { site_name: searchRegex },
      { recipients: searchRegex },
    ];
  }

  const skip = Number.isFinite(filters.skip) ? filters.skip : 0;
  const limit = Number.isFinite(filters.limit) ? filters.limit : 50;

  const totalCount = await alertLogsCollection.countDocuments(query);
  const logs = await alertLogsCollection
    .find(query)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return {
    logs: logs.map((log) => _serializeAlertLog(log)),
    totalCount,
  };
}

// Update a client's alert notification settings (toggle + recipients/CC)
export async function updateUserAlertSettings(username, settingsUpdate) {
  _ensureUserCollection();
  const updateFields = {};

  if (settingsUpdate.alert_notifications_enabled !== undefined) {
    updateFields.alert_notifications_enabled = settingsUpdate.alert_notifications_enabled === true;
  }
  if (Array.isArray(settingsUpdate.alert_emails)) {
    updateFields.alert_emails = settingsUpdate.alert_emails.map((e) => String(e).trim()).filter(Boolean);
  }
  if (Array.isArray(settingsUpdate.alert_cc)) {
    updateFields.alert_cc = settingsUpdate.alert_cc.map((e) => String(e).trim()).filter(Boolean);
  }

  if (Object.keys(updateFields).length === 0) {
    throw new Error("No valid alert settings provided");
  }

  updateFields.updated_at = _now();

  const result = await usersCollection.findOneAndUpdate(
    { username },
    { $set: updateFields },
    { returnDocument: "after" }
  );

  const updated = result?.value || result;
  if (!updated || !updated.username) {
    return null;
  }
  return _serializeUser(updated);
}

// Bulk enable/disable alert notifications for every client (builder/contractor)
export async function bulkSetAlertNotifications(enabled) {
  _ensureUserCollection();
  const result = await usersCollection.updateMany(
    { role: { $in: ["builder", "contractor"] } },
    { $set: { alert_notifications_enabled: enabled === true, updated_at: _now() } }
  );
  return result?.modifiedCount ?? 0;
}

// Raw readings (unserialized values) for a sensor since a given date, oldest first
export async function getRawSensorReadingsSince(sensorId, sinceDate) {
  _ensureSensorReadingCollection();
  return sensorReadingsCollection
    .find({ sensor_id: sensorId, timestamp: { $gte: new Date(sinceDate) } })
    .sort({ timestamp: 1 })
    .toArray();
}

// =============================================================================
// AMC / WARRANTY TRACKING FUNCTIONS
// =============================================================================

function _ensureAmcCollections() {
  if (amcFeaturesCollection === null || amcAuditLogsCollection === null) {
    throw new Error("MongoDB AMC collections are not initialized. Call connect() first.");
  }
}

function _serializeAmcRecord(doc) {
  if (!doc) return null;
  return {
    id: doc.id || (doc._id ? doc._id.toString() : null),
    sensor_id: doc.sensor_id,
    username: doc.username || null,
    client_name: doc.client_name || null,
    tracked: doc.tracked === true,
    installation_date: doc.installation_date || null,
    warranty_expiry: doc.warranty_expiry || null,
    amc_renewal_date: doc.amc_renewal_date || null,
    amc_expiry: doc.amc_expiry || null,
    created_at: doc.created_at || null,
    updated_at: doc.updated_at || null,
    updated_by: doc.updated_by || null,
  };
}

// Fetch sensors by a list of sensor_ids (serialized)
export async function getSensorsByIds(sensorIds = []) {
  _ensureSensorCollection();
  if (!Array.isArray(sensorIds) || sensorIds.length === 0) return [];
  const docs = await sensorsCollection.find({ sensor_id: { $in: sensorIds } }).toArray();
  return docs.map((doc) => _serializeSensor(doc));
}

// Fetch users by a list of usernames (serialized)
export async function getUsersByUsernames(usernames = []) {
  _ensureUserCollection();
  if (!Array.isArray(usernames) || usernames.length === 0) return [];
  const docs = await usersCollection.find({ username: { $in: usernames } }).toArray();
  return docs.map((doc) => _serializeUser(doc));
}

// AMC records with optional filters: { username, tracked, sensor_ids }
export async function getAmcRecords(filters = {}) {
  _ensureAmcCollections();
  const query = {};
  if (filters.username) query.username = filters.username;
  if (filters.tracked !== undefined) query.tracked = filters.tracked === true;
  if (Array.isArray(filters.sensor_ids) && filters.sensor_ids.length > 0) {
    query.sensor_id = { $in: filters.sensor_ids };
  }
  const docs = await amcFeaturesCollection.find(query).toArray();
  return docs.map(_serializeAmcRecord);
}

export async function getAmcRecordsForSensors(sensorIds = []) {
  if (!Array.isArray(sensorIds) || sensorIds.length === 0) return [];
  return getAmcRecords({ sensor_ids: sensorIds });
}

// Insert or update the AMC record for one sensor
export async function upsertAmcRecord(sensorId, fields) {
  _ensureAmcCollections();
  const now = _now();
  const result = await amcFeaturesCollection.findOneAndUpdate(
    { sensor_id: sensorId },
    {
      $set: { ...fields, sensor_id: sensorId },
      $setOnInsert: { id: uuidv4(), created_at: now },
    },
    { upsert: true, returnDocument: "after" }
  );
  const doc = result?.value || result;
  return _serializeAmcRecord(doc);
}

export async function insertAmcAuditLogs(entries = []) {
  _ensureAmcCollections();
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  const docs = entries.map((entry) => ({ id: uuidv4(), ...entry }));
  const result = await amcAuditLogsCollection.insertMany(docs);
  return result?.insertedCount ?? docs.length;
}

// Paginated audit trail, newest first
export async function getAmcAuditLogs(filters = {}) {
  _ensureAmcCollections();
  const query = {};
  if (filters.username) query.username = filters.username;
  if (filters.sensor_id) query.sensor_id = filters.sensor_id;

  const skip = filters.skip || 0;
  const limit = filters.limit || 50;

  const [docs, totalCount] = await Promise.all([
    amcAuditLogsCollection.find(query).sort({ changed_at: -1 }).skip(skip).limit(limit).toArray(),
    amcAuditLogsCollection.countDocuments(query),
  ]);

  const logs = docs.map((doc) => ({
    id: doc.id || doc._id?.toString(),
    username: doc.username,
    client_name: doc.client_name || null,
    sensor_id: doc.sensor_id,
    field: doc.field,
    old_value: doc.old_value ?? null,
    new_value: doc.new_value ?? null,
    changed_by: doc.changed_by,
    changed_at: doc.changed_at instanceof Date ? doc.changed_at.toISOString() : doc.changed_at,
  }));

  return { logs, totalCount };
}

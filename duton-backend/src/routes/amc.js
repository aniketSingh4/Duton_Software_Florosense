import express from "express";
import { verifyUserToken, requireAdmin } from "../middleware/auth.js";
import * as database from "../services/database.js";
import * as amcService from "../services/amcService.js";

const router = express.Router();

// ---------------------------------------------------------------------------
// Client dashboard: marquee alert status for the logged-in user (any role)
// ---------------------------------------------------------------------------
router.get("/my-alert", verifyUserToken, async (req, res, next) => {
  try {
    // Admins and magic-link viewers never see the client marquee.
    if (req.user.role === "admin" || req.user.share_access) {
      return res.json({ success: true, data: { alert_active: false, sensors: [] } });
    }
    const data = await amcService.getAlertForUser(req.user.username);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Admin: clients with AMC flags
// ---------------------------------------------------------------------------
router.get("/clients", verifyUserToken, requireAdmin, async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const search = req.query.search || null;
    const { clients, totalCount } = await amcService.listClientsWithAmc({ search, skip, limit });
    res.json({
      success: true,
      message: "AMC clients retrieved successfully",
      data: { clients, total_count: totalCount, skip, limit },
    });
  } catch (error) {
    next(error);
  }
});

// Admin: sensors of one client with AMC status
router.get("/clients/:username/sensors", verifyUserToken, requireAdmin, async (req, res, next) => {
  try {
    const data = await amcService.getClientAmcSensors(req.params.username);
    if (!data) {
      return res.status(404).json({ detail: "Client not found" });
    }
    res.json({ success: true, message: "Client AMC sensors retrieved successfully", data });
  } catch (error) {
    next(error);
  }
});

// Admin: save tracking + dates for a client's sensors
// Body: { sensors: [{ sensor_id, tracked, installation_date?, amc_renewal_date? }] }
router.put("/clients/:username/sensors", verifyUserToken, requireAdmin, async (req, res, next) => {
  try {
    const data = await amcService.saveClientAmcSensors(
      req.params.username,
      req.body?.sensors,
      req.user.username
    );
    res.json({ success: true, message: "AMC tracking saved successfully", data });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ detail: error.message });
    }
    next(error);
  }
});

// Admin: toggle OFF - stop tracking every sensor of a client
router.post("/clients/:username/disable", verifyUserToken, requireAdmin, async (req, res, next) => {
  try {
    const data = await amcService.disableClientAmc(req.params.username, req.user.username);
    res.json({ success: true, message: "AMC tracking disabled for client", data });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ detail: error.message });
    }
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Admin: expiry monitoring list  (?type=warranty|amc|both)
// ---------------------------------------------------------------------------
router.get("/expiring", verifyUserToken, requireAdmin, async (req, res, next) => {
  try {
    const type = ["warranty", "amc", "both"].includes(req.query.type) ? req.query.type : "both";
    const data = await amcService.getExpiringList({ type });
    res.json({ success: true, message: "Expiry list retrieved successfully", data: { ...data, type } });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Admin: audit trail of AMC changes
// ---------------------------------------------------------------------------
router.get("/audit", verifyUserToken, requireAdmin, async (req, res, next) => {
  try {
    const filters = {
      username: req.query.username || null,
      sensor_id: req.query.sensor_id || null,
      skip: parseInt(req.query.skip) || 0,
      limit: Math.min(parseInt(req.query.limit) || 50, 200),
    };
    const { logs, totalCount } = await database.getAmcAuditLogs(filters);
    res.json({
      success: true,
      message: "AMC audit logs retrieved successfully",
      data: { logs, total_count: totalCount, skip: filters.skip, limit: filters.limit },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

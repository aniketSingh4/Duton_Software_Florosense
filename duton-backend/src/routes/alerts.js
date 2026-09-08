import express from "express";
import * as database from "../services/database.js";
import { verifyUserToken, requireAdmin } from "../middleware/auth.js";
import { runAlertChecks } from "../services/alertMonitor.js";

const router = express.Router();

// Get alert history (admin only) - searchable, filterable, paginated
router.get("/logs", verifyUserToken, requireAdmin, async (req, res, next) => {
  try {
    const filters = {
      alert_type: req.query.alert_type || null,
      alert_status: req.query.alert_status || null,
      search: req.query.search || null,
      skip: parseInt(req.query.skip) || 0,
      limit: Math.min(parseInt(req.query.limit) || 20, 100),
    };

    const { logs, totalCount } = await database.getAlertLogs(filters);

    res.json({
      success: true,
      message: "Alert logs retrieved successfully",
      data: {
        logs,
        total_count: totalCount,
        skip: filters.skip,
        limit: filters.limit,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/settings/bulk", verifyUserToken, requireAdmin, async (req, res, next) => {
  try {
    const { alert_notifications_enabled } = req.body;

    if (typeof alert_notifications_enabled !== "boolean") {
      return res.status(400).json({ detail: "alert_notifications_enabled (boolean) is required" });
    }

    const updatedCount = await database.bulkSetAlertNotifications(alert_notifications_enabled);

    res.json({
      success: true,
      message: `Alert notifications ${alert_notifications_enabled ? "enabled" : "disabled"} for all clients`,
      data: { updated_count: updatedCount },
    });
  } catch (error) {
    next(error);
  }
});

// Update a client's alert notification settings (admin only)
// Body: { alert_notifications_enabled?: bool, alert_emails?: string[], alert_cc?: string[] }
router.patch("/settings/:username", verifyUserToken, requireAdmin, async (req, res, next) => {
  try {
    const { alert_notifications_enabled, alert_emails, alert_cc } = req.body;

    const updated = await database.updateUserAlertSettings(req.params.username, {
      alert_notifications_enabled,
      alert_emails,
      alert_cc,
    });

    if (!updated) {
      return res.status(404).json({ detail: "User not found" });
    }

    res.json({
      success: true,
      message: "Alert settings updated successfully",
      data: updated,
    });
  } catch (error) {
    if (error.message === "No valid alert settings provided") {
      return res.status(400).json({ detail: error.message });
    }
    next(error);
  }
});

// Manually trigger an alert check cycle (admin only, for testing)
router.post("/run-checks", verifyUserToken, requireAdmin, async (req, res, next) => {
  try {
    await runAlertChecks();
    res.json({
      success: true,
      message: "Alert checks completed",
    });
  } catch (error) {
    next(error);
  }
});

export default router;

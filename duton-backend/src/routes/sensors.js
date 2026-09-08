import express from "express";
import * as sensorController from "../controllers/sensorController.js";
import { verifyUserToken } from "../middleware/auth.js";
import { verifyAdminToken } from "../middleware/auth.js";
import { verifyFlorosenseApiKey } from "../middleware/apiKey.js";

const router = express.Router();

// User routes
router.get("/user-sensors", verifyUserToken, sensorController.getUserSensors);
router.get("/current/:sensor_id", verifyUserToken, sensorController.getCurrentSensor);
router.get("/info/:sensor_id", verifyUserToken, sensorController.getSensorInfo);
router.get("/list", verifyUserToken, sensorController.listSensors);
router.get("/anomalies", verifyUserToken, sensorController.getSensorAnomalies);
router.get("/chart-data/:sensor_id", verifyUserToken, sensorController.getSensorChartData);
router.get("/latest/:sensor_id", verifyUserToken, sensorController.getLatestReading);
router.get("/latest-all", verifyUserToken, sensorController.getAllLatestReadings);
router.get("/historical/:sensor_id", verifyUserToken, sensorController.getHistoricalData);
router.get("/florosense-historical/:sensor_id", verifyUserToken, sensorController.getFlorosenseHistorical);

// Admin only routes
router.post("/", verifyAdminToken, sensorController.createSensor);
router.put("/:sensor_id", verifyAdminToken, sensorController.updateSensor);
router.delete("/:sensor_id", verifyAdminToken, sensorController.deleteSensor);
router.get("/available", verifyAdminToken, sensorController.getAvailableSensors);

// Admin and Assignee routes - allow updating remarks
router.put("/:sensor_id/remark", verifyUserToken, sensorController.updateSensorRemark);

// Admin and Assignee routes - calibration management
router.put("/:sensor_id/calibration", verifyUserToken, sensorController.updateSensorCalibration);
router.get("/:sensor_id/calibration", verifyUserToken, sensorController.getSensorCalibration);

// Document Management routes (Admin or Assignee)
router.post("/:sensor_id/documents", verifyUserToken, sensorController.uploadSensorDocument);
router.get("/:sensor_id/documents", verifyUserToken, sensorController.getSensorDocuments);
router.get("/:sensor_id/documents/:document_id", verifyUserToken, sensorController.downloadSensorDocument);
router.delete("/:sensor_id/documents/:document_id", verifyUserToken, sensorController.deleteSensorDocument);

// Sensor Assignment routes (Admin only)
router.get("/users-by-role/:role", verifyAdminToken, sensorController.getUsersByRole);
router.post("/:sensor_id/assign", verifyAdminToken, sensorController.assignSensorToUser);
router.get("/:sensor_id/assignments", verifyAdminToken, sensorController.getUsersForSensor);
router.delete("/:sensor_id/assign/:username", verifyAdminToken, sensorController.unassignSensorFromUser);

// Share Access (Magic Link) routes
router.post("/validate-magic-link", sensorController.validateMagicLink); // Public route (no auth)
router.post("/:sensor_id/share-access", verifyAdminToken, sensorController.generateShareAccessLink);
router.get("/:sensor_id/share-access", verifyAdminToken, sensorController.getShareAccessTokens);
router.delete("/:sensor_id/share-access/:token_id", verifyAdminToken, sensorController.revokeShareAccessToken);

// All Sensors API (API key only)
router.get("/all", verifyFlorosenseApiKey, sensorController.getAllSensorsAPI);


// Get Site Data from Google Sheet
router.get("/sheet-data-all", verifyFlorosenseApiKey, sensorController.getAllSensorsSheetData);
router.get("/sheet-data/:sensor_id", verifyFlorosenseApiKey, sensorController.getSensorSheetData);

// Get Sensor Details (API key only)
router.get("/:sensor_id", verifyFlorosenseApiKey, sensorController.getSensorDetailsAdmin);

export default router;

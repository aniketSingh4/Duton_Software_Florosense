import express from "express";
import * as calibrationController from "../controllers/calibrationController.js";
import { verifyAdminToken, verifyUserToken } from "../middleware/auth.js";

const router = express.Router();

// GET /admin/calibration/sensors/:sensor_id - Get calibration (Admin or User with access)
router.get("/sensors/:sensor_id", verifyUserToken, calibrationController.getCalibration);

// PUT /admin/calibration/sensors/:sensor_id - Update calibration (Admin only)
router.put("/sensors/:sensor_id", verifyAdminToken, calibrationController.updateCalibration);

// POST /admin/calibration/sensors/:sensor_id - Create calibration (Admin only)
router.post("/sensors/:sensor_id", verifyAdminToken, calibrationController.createCalibration);

export default router;


import express from "express";
import * as siteController from "../controllers/siteController.js";
import { verifyAdminToken, verifyUserToken } from "../middleware/auth.js";

const router = express.Router();

// Admin only routes
router.post("/", verifyAdminToken, siteController.createSite);
router.get("/", verifyAdminToken, siteController.getAllSites);
router.get("/:site_id", verifyUserToken, siteController.getSiteById);
router.put("/:site_id", verifyAdminToken, siteController.updateSite);
router.delete("/:site_id", verifyAdminToken, siteController.deleteSite);

// Site assignment routes (Admin only)
router.post("/assign/:username", verifyAdminToken, siteController.assignSitesToUser);
router.delete("/assign/:username/:site_id", verifyAdminToken, siteController.removeSiteFromUser);

// Get sites for user
router.get("/user/:username", verifyUserToken, siteController.getUserSites);

// Get sensors for a site
router.get("/:site_id/sensors", verifyUserToken, siteController.getSiteSensors);

// Get users assigned to a site (Admin only)
router.get("/:site_id/users", verifyAdminToken, siteController.getSiteUsers);

export default router;


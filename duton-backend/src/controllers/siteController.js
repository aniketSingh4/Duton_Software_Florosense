import * as database from "../services/database.js";
import { UserRole } from "../models/index.js";

// Create a new site (Admin only)
export const createSite = async (req, res, next) => {
  try {
    const { site_id, site_name, site_address, location, client_name } = req.body;

    if (!site_name) {
      return res.status(400).json({
        detail: "site_name is required",
      });
    }

    const site = await database.createSite({
      site_id: site_id || null,
      site_name,
      site_address: site_address || "",
      location: location || {},
      client_name: client_name || "",
    });

    res.status(201).json({
      success: true,
      message: "Site created successfully",
      data: site,
    });
  } catch (error) {
    if (error.message?.includes("already exists")) {
      return res.status(400).json({
        detail: error.message,
      });
    }
    next(error);
  }
};

// Get all sites (Admin only)
export const getAllSites = async (req, res, next) => {
  try {
    const filters = {
      site_name: req.query.site_name || null,
      client_name: req.query.client_name || null,
    };

    const sites = await database.getAllSites(filters);
    res.json({
      success: true,
      message: "Sites retrieved successfully",
      data: sites,
    });
  } catch (error) {
    next(error);
  }
};

// Get site by ID
export const getSiteById = async (req, res, next) => {
  try {
    const { site_id } = req.params;
    const site = await database.getSiteByIdSerialized(site_id);

    if (!site) {
      return res.status(404).json({
        detail: "Site not found",
      });
    }

    res.json({
      success: true,
      message: "Site retrieved successfully",
      data: site,
    });
  } catch (error) {
    next(error);
  }
};

// Update site (Admin only)
export const updateSite = async (req, res, next) => {
  try {
    const { site_id } = req.params;
    const { site_name, site_address, location, client_name } = req.body;

    const updates = {};
    if (site_name !== undefined) updates.site_name = site_name;
    if (site_address !== undefined) updates.site_address = site_address;
    if (location !== undefined) updates.location = location;
    if (client_name !== undefined) updates.client_name = client_name;

    const site = await database.updateSite(site_id, updates);

    if (!site) {
      return res.status(404).json({
        detail: "Site not found",
      });
    }

    res.json({
      success: true,
      message: "Site updated successfully",
      data: site,
    });
  } catch (error) {
    next(error);
  }
};

// Delete site (Admin only)
export const deleteSite = async (req, res, next) => {
  try {
    const { site_id } = req.params;
    const deleted = await database.deleteSite(site_id);

    if (!deleted) {
      return res.status(404).json({
        detail: "Site not found",
      });
    }

    res.json({
      success: true,
      message: "Site deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Assign sites to user (Admin only)
export const assignSitesToUser = async (req, res, next) => {
  try {
    const { username } = req.params;
    const { site_ids } = req.body;

    if (!site_ids || !Array.isArray(site_ids) || site_ids.length === 0) {
      return res.status(400).json({
        detail: "site_ids array is required",
      });
    }

    // Verify user exists
    const user = await database.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({
        detail: "User not found",
      });
    }

    // Verify all sites exist (siteId can be site_id or site_name)
    for (const siteId of site_ids) {
      const site = await database.getSiteById(siteId);
      if (!site) {
        return res.status(404).json({
          detail: `Site ${siteId} not found`,
        });
      }
    }

    const assignments = await database.assignSitesToUser(username, site_ids);

    res.json({
      success: true,
      message: "Sites assigned successfully",
      data: assignments,
    });
  } catch (error) {
    next(error);
  }
};

// Get sites assigned to user
export const getUserSites = async (req, res, next) => {
  try {
    const { username } = req.params;

    // Check if requesting own sites or admin
    if (req.user.username !== username && req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({
        detail: "Access denied. You can only view your own sites.",
      });
    }

    const sites = await database.getUserSites(username);
    res.json({
      success: true,
      message: "User sites retrieved successfully",
      data: sites,
    });
  } catch (error) {
    next(error);
  }
};

// Remove site assignment from user (Admin only)
export const removeSiteFromUser = async (req, res, next) => {
  try {
    const { username, site_id } = req.params;

    const removed = await database.removeSiteFromUser(username, site_id);

    if (!removed) {
      return res.status(404).json({
        detail: "Site assignment not found",
      });
    }

    res.json({
      success: true,
      message: "Site assignment removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get sensors for a site
export const getSiteSensors = async (req, res, next) => {
  try {
    const { site_id } = req.params;

    // Check if user has access to this site
    let hasAccess = false;
    
    // Admin and assignee can access all sites
    if (req.user.role === UserRole.ADMIN || req.user.role === "assignee") {
      hasAccess = true;
    } else {
      // For builders/contractors, check if site is assigned to them
      if (req.user.role === UserRole.BUILDER || req.user.role === UserRole.CONTRACTOR) {
        const userSites = await database.getUserSites(req.user.username);
        hasAccess = userSites.some(s => s.site_id === site_id);
      } else {
        // For regular users, check sensor assignments
        const userSensors = await database.getUserSensors(req.user.username);
        const siteSensors = await database.getSensorsForSite(site_id);
        const siteSensorIds = siteSensors.map(s => s.sensor_id);
        hasAccess = userSensors.some(s => siteSensorIds.includes(s.sensor_id));
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        detail: "Access denied to this site",
      });
    }

    const sensors = await database.getSensorsForSite(site_id);
    res.json({
      success: true,
      message: "Site sensors retrieved successfully",
      data: sensors,
    });
  } catch (error) {
    next(error);
  }
};

// Get users assigned to a site (Admin only)
export const getSiteUsers = async (req, res, next) => {
  try {
    const { site_id } = req.params;

    const assignments = await database.getUsersForSite(site_id);
    res.json({
      success: true,
      message: "Site users retrieved successfully",
      data: assignments,
    });
  } catch (error) {
    next(error);
  }
};


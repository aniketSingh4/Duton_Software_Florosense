import * as database from "../services/database.js";
import { UserRole } from "../models/index.js";
import { getSettings } from "../config.js";
import fs from "fs";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { sendMagicLinkEmail } from "../utils/emailService.js";
import jwt from "jsonwebtoken";
import {
  fetchAllSitesFromGoogleSheet,
  fetchSiteBySensorIdFromGoogleSheet,
} from "../services/googleSheetFetch.js";

export const getUserSensors = async (req, res, next) => {
  try {
    // Check if user is accessing via magic link (share_access token)
    if (req.user.share_access && req.user.sensor_id) {
      // For magic link users, return only the sensor they have access to
      const sensor = await database.getSensorById(req.user.sensor_id);
      if (sensor) {
        // Serialize sensor in the same format as getUserSensors returns
        // (matching _serializeSensor function format)
        const toISOString = (value) => {
          if (!value) return null;
          if (value instanceof Date) return value.toISOString();
          if (typeof value === 'string') {
            const date = new Date(value);
            return isNaN(date.getTime()) ? null : date.toISOString();
          }
          return null;
        };

        const docId = sensor.id || (sensor._id ? (typeof sensor._id === 'string' ? sensor._id : sensor._id.toString()) : null);

        const serializedSensor = {
          id: docId,
          sensor_id: sensor.sensor_id,
          device_id: sensor.device_id,
          location: sensor.location || {},
          is_active: sensor.is_active !== false,
          client_name: sensor.client_name,
          site_name: sensor.site_name,
          spoc_name: sensor.spoc_name,
          spoc_contact: sensor.spoc_contact,
          remark: sensor.remark,
          remark_date: sensor.remark_date,
          created_at: toISOString(sensor.created_at),
          assigned_at: new Date().toISOString()
        };

        res.json({
          success: true,
          message: "User sensors retrieved successfully",
          data: [serializedSensor]
        });
        return;
      } else {
        // Sensor not found
        res.json({
          success: true,
          message: "User sensors retrieved successfully",
          data: []
        });
        return;
      }
    }

    // For builders/contractors, get sensors from assigned sites
    if (req.user.role === UserRole.BUILDER || req.user.role === UserRole.CONTRACTOR) {
      const userSites = await database.getUserSites(req.user.username);
      const allSensors = [];

      for (const site of userSites) {
        const siteSensors = await database.getSensorsForSite(site.site_id);
        allSensors.push(...siteSensors);
      }

      // Remove duplicates and serialize
      const uniqueSensors = [];
      const seenSensorIds = new Set();

      for (const sensor of allSensors) {
        if (!seenSensorIds.has(sensor.sensor_id)) {
          seenSensorIds.add(sensor.sensor_id);
          const toISOString = (value) => {
            if (!value) return null;
            if (value instanceof Date) return value.toISOString();
            if (typeof value === 'string') {
              const date = new Date(value);
              return isNaN(date.getTime()) ? null : date.toISOString();
            }
            return null;
          };
          uniqueSensors.push({
            id: sensor.id || (sensor._id ? (typeof sensor._id === 'string' ? sensor._id : sensor._id.toString()) : null),
            sensor_id: sensor.sensor_id,
            device_id: sensor.device_id,
            location: sensor.location || {},
            is_active: sensor.is_active !== false,
            client_name: sensor.client_name,
            site_name: sensor.site_name,
            spoc_name: sensor.spoc_name,
            spoc_contact: sensor.spoc_contact,
            remark: sensor.remark,
            remark_date: sensor.remark_date,
            created_at: toISOString(sensor.created_at),
            assigned_at: new Date().toISOString(),
          });
        }
      }

      res.json({
        success: true,
        message: "User sensors retrieved successfully",
        data: uniqueSensors
      });
      return;
    }

    // For regular users, get sensors from assignments
    const sensors = await database.getUserSensors(req.user.username);
    res.json({
      success: true,
      message: "User sensors retrieved successfully",
      data: sensors
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentSensor = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;

    // Check if user is accessing via magic link (share_access token)
    let hasAccess = false;
    if (req.user.share_access && req.user.sensor_id === sensor_id) {
      // Magic link user has access to this specific sensor
      hasAccess = true;
    } else if (req.user.role === UserRole.BUILDER || req.user.role === UserRole.CONTRACTOR) {
      // For builders/contractors, check if sensor belongs to an assigned site
      const sensor = await database.getSensorById(sensor_id);
      if (sensor) {
        const userSites = await database.getUserSites(req.user.username);
        // Check both site_id and site_name since sensors might only have site_name
        hasAccess = userSites.some(s =>
          s.site_id === sensor.site_id ||
          s.site_id === sensor.site_name ||
          s.site_name === sensor.site_id ||
          s.site_name === sensor.site_name
        );
      }
    } else {
      // For regular users, check database assignments
      const userSensors = await database.getUserSensors(req.user.username);
      hasAccess = userSensors.some(s => s.sensor_id === sensor_id);
    }

    // Admin and assignee can access all sensors
    if (!hasAccess && req.user.role !== UserRole.ADMIN && req.user.role !== "assignee") {
      return res.status(403).json({
        detail: "Access denied to this sensor",
      });
    }

    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    res.json({
      success: true,
      message: "Current sensor data retrieved successfully",
      data: {
        sensor_id: sensor.sensor_id,
        device_id: sensor.device_id,
        location: sensor.location,
        is_active: sensor.is_active,
        client_name: sensor.client_name,
        site_name: sensor.site_name,
        spoc_name: sensor.spoc_name,
        spoc_contact: sensor.spoc_contact,
        remark: sensor.remark,
        remark_date: sensor.remark_date,
        created_at: sensor.created_at,
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getSensorInfo = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;

    // Check if user is accessing via magic link (share_access token)
    let hasAccess = false;
    if (req.user.share_access && req.user.sensor_id === sensor_id) {
      // Magic link user has access to this specific sensor
      hasAccess = true;
    } else if (req.user.role === UserRole.BUILDER || req.user.role === UserRole.CONTRACTOR) {
      // For builders/contractors, check if sensor belongs to an assigned site
      const sensor = await database.getSensorById(sensor_id);
      if (sensor) {
        const userSites = await database.getUserSites(req.user.username);
        // Check both site_id and site_name since sensors might only have site_name
        hasAccess = userSites.some(s =>
          s.site_id === sensor.site_id ||
          s.site_id === sensor.site_name ||
          s.site_name === sensor.site_id ||
          s.site_name === sensor.site_name
        );
      }
    } else {
      // For regular users, check database assignments
      const userSensors = await database.getUserSensors(req.user.username);
      hasAccess = userSensors.some(s => s.sensor_id === sensor_id);
    }

    // Admin and assignee can access all sensors
    if (!hasAccess && req.user.role !== UserRole.ADMIN && req.user.role !== "assignee") {
      return res.status(403).json({
        detail: "Access denied to this sensor",
      });
    }

    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    res.json({
      success: true,
      message: "Sensor information retrieved successfully",
      data: {
        sensor_info: {
          sensor_id: sensor.sensor_id,
          device_id: sensor.device_id,
          location: sensor.location,
          is_active: sensor.is_active,
          client_name: sensor.client_name,
          site_name: sensor.site_name,
          site_id: sensor.site_id ?? null,
          spoc_name: sensor.spoc_name,
          spoc_contact: sensor.spoc_contact,
          remark: sensor.remark,
          remark_date: sensor.remark_date,
          created_at: sensor.created_at,
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const listSensors = async (req, res, next) => {
  try {
    let sensors;

    if (req.user.role === UserRole.ADMIN) {
      const filters = {
        is_active: req.query.is_active !== undefined ? req.query.is_active === "true" : undefined,
        client_name: req.query.client_name || null,
        search: req.query.search || null,
      };
      sensors = await database.getAllSensors(filters);
    } else {
      sensors = await database.getUserSensors(req.user.username);
    }

    res.json({
      success: true,
      message: "Sensors retrieved successfully",
      data: {
        sensors: sensors,
        total_count: sensors.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createSensor = async (req, res, next) => {
  try {
    const { sensor_id, device_id, location, is_active, client_name, site_name, spoc_name, spoc_contact, remark, remark_date, installation_date } = req.body;

    if (!sensor_id) {
      return res.status(400).json({
        detail: "sensor_id is required",
      });
    }

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
      site_id: req.body.site_id || null,
      site_address: req.body.site_address || null,
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
};

export const updateSensor = async (req, res, next) => {
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
      "site_id",
      "site_address",
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
};

export const deleteSensor = async (req, res, next) => {
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
};

export const updateSensorRemark = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const { remark, remark_date } = req.body;

    // Check if user is admin or assignee
    const userRole = req.user?.role || "";
    if (userRole !== UserRole.ADMIN && userRole !== "assignee") {
      return res.status(403).json({
        detail: "Access denied. Admin or Assignee role required.",
      });
    }

    // Both admin and assignee can add remarks to all sensors
    // No need to check sensor access - assignees can see all sensors like admins

    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    const updates = {
      remark: remark || null,
      remark_date: remark_date || null,
    };

    const updatedSensor = await database.updateSensor(sensor_id, updates);
    if (!updatedSensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    res.json({
      success: true,
      message: "Sensor remark updated successfully",
      data: {
        sensor: updatedSensor
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateSensorCalibration = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const { calibration } = req.body;

    // Check if user is admin or assignee
    const userRole = req.user?.role || "";
    if (userRole !== UserRole.ADMIN && userRole !== "assignee") {
      return res.status(403).json({
        detail: "Access denied. Admin or Assignee role required.",
      });
    }

    // Validate calibration structure
    if (!calibration || typeof calibration !== "object") {
      return res.status(400).json({
        detail: "Invalid calibration data. Expected object with pm25 and pm10 fields.",
      });
    }

    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    // Prepare calibration object with default structure
    const calibrationData = {
      pm25: {
        k0: calibration.pm25?.k0 ?? 0,
        k1: calibration.pm25?.k1 ?? 1,
        variationMin: calibration.pm25?.variationMin ?? 0,
        variationMax: calibration.pm25?.variationMax ?? 0,
      },
      pm10: {
        k0: calibration.pm10?.k0 ?? 0,
        k1: calibration.pm10?.k1 ?? 1,
        variationMin: calibration.pm10?.variationMin ?? 0,
        variationMax: calibration.pm10?.variationMax ?? 0,
      },
    };

    const updates = {
      calibration: calibrationData,
      calibration_updated_at: new Date().toISOString(),
    };

    const updatedSensor = await database.updateSensor(sensor_id, updates);
    if (!updatedSensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    res.json({
      success: true,
      message: "Sensor calibration updated successfully",
      data: {
        sensor: updatedSensor,
        calibration: calibrationData,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSensorCalibration = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;

    // Check if user is admin or assignee
    const userRole = req.user?.role || "";
    if (userRole !== UserRole.ADMIN && userRole !== "assignee") {
      return res.status(403).json({
        detail: "Access denied. Admin or Assignee role required.",
      });
    }

    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    // Return calibration from sensor or default values
    const defaultCalibration = {
      pm25: {
        k0: 0,
        k1: 1,
        variationMin: 0,
        variationMax: 0,
      },
      pm10: {
        k0: 0,
        k1: 1,
        variationMin: 0,
        variationMax: 0,
      },
    };

    const calibration = sensor.calibration || defaultCalibration;

    res.json({
      success: true,
      message: "Sensor calibration retrieved successfully",
      data: {
        sensor_id: sensor.sensor_id,
        calibration: calibration,
        calibration_updated_at: sensor.calibration_updated_at || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAvailableSensors = async (req, res, next) => {
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
};

export const getHistoricalData = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const { start_time, end_time, limit = 10000 } = req.query;

    let hasAccess = false;
    if (req.user.share_access && req.user.sensor_id === sensor_id) {
      hasAccess = true;
    } else if (req.user.role === UserRole.BUILDER || req.user.role === UserRole.CONTRACTOR) {
      const sensor = await database.getSensorById(sensor_id);
      if (sensor) {
        const userSites = await database.getUserSites(req.user.username);
        hasAccess = userSites.some(s =>
          s.site_id === sensor.site_id ||
          s.site_id === sensor.site_name ||
          s.site_name === sensor.site_id ||
          s.site_name === sensor.site_name
        );
      }
    } else {
      const userSensors = await database.getUserSensors(req.user.username);
      hasAccess = userSensors.some(s => s.sensor_id === sensor_id);
    }

    if (!hasAccess && req.user.role !== UserRole.ADMIN && req.user.role !== "assignee") {
      return res.status(403).json({
        detail: "Access denied to this sensor",
      });
    }

    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    if (!start_time || !end_time) {
      return res.status(400).json({
        detail: "start_time and end_time query parameters are required",
      });
    }

    const startDate = new Date(start_time);
    const endDate = new Date(end_time);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        detail: "Invalid date format. Use ISO 8601 format (e.g., YYYY-MM-DDTHH:MM)",
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        detail: "start_time must be before end_time",
      });
    }

    const maxDays = 90;
    const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > maxDays) {
      return res.status(400).json({
        detail: `Date range cannot exceed ${maxDays} days`,
      });
    }

    const readings = await database.getSensorReadings(
      sensor_id,
      startDate,
      endDate,
      parseInt(limit, 10)
    );

    res.json({
      success: true,
      message: "Historical data retrieved successfully",
      data: {
        sensor_id,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        total_records: readings.length,
        readings: readings.map(reading => ({
          timestamp: reading.timestamp,
          sensor_id: reading.sensor_id,
          pm2_5: reading.pm2_5,
          pm10_0: reading.pm10_0,
          pms_2_5: reading.pms_2_5,
          pms_10: reading.pms_10,
          temperature: reading.temperature,
          humidity: reading.humidity,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getLatestReading = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;

    // Check if user is accessing via magic link (share_access token)
    let hasAccess = false;
    if (req.user.share_access && req.user.sensor_id === sensor_id) {
      // Magic link user has access to this specific sensor
      hasAccess = true;
    } else if (req.user.role === UserRole.BUILDER || req.user.role === UserRole.CONTRACTOR) {
      // For builders/contractors, check if sensor belongs to an assigned site
      const sensor = await database.getSensorById(sensor_id);
      if (sensor) {
        const userSites = await database.getUserSites(req.user.username);
        // Check both site_id and site_name since sensors might only have site_name
        hasAccess = userSites.some(s =>
          s.site_id === sensor.site_id ||
          s.site_id === sensor.site_name ||
          s.site_name === sensor.site_id ||
          s.site_name === sensor.site_name
        );
      }
    } else {
      // For regular users, check database assignments
      const userSensors = await database.getUserSensors(req.user.username);
      hasAccess = userSensors.some(s => s.sensor_id === sensor_id);
    }

    if (!hasAccess && req.user.role !== UserRole.ADMIN && req.user.role !== "assignee") {
      return res.status(403).json({
        detail: "Access denied to this sensor",
      });
    }

    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    const settings = getSettings();
    const url = `${settings.FLOROSENSE_BASE_URL}/api/v1/dashboard/sensors/${encodeURIComponent(sensor_id)}/latest/`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-API-Key": settings.FLOROSENSE_API_KEY,
          "Content-Type": "application/json",
          "User-Agent": "DutonDashboard/1.0",
          "Accept": "application/json"
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(response.status).json({
          detail: `FloroSense API error: ${response.status} ${response.statusText}`,
        });
      }

      const data = await response.json();

      try {
        const { fetchCalibrationFromFloroSense } = await import("../utils/florosenseCalibration.js");
        const calibration = await fetchCalibrationFromFloroSense(sensor_id);

        if (calibration) {
          const { applyCalibration } = await import("../utils/calibration.js");

          if (data.pm2_5 !== null && data.pm2_5 !== undefined) {
            data.pm2_5_corrected = applyCalibration(data.pm2_5, calibration);
          }
          if (data.pm10_0 !== null && data.pm10_0 !== undefined) {
            data.pm10_0_corrected = applyCalibration(data.pm10_0, calibration);
          }
          if (data.pms_2_5 !== null && data.pms_2_5 !== undefined) {
            data.pms_2_5_corrected = applyCalibration(data.pms_2_5, calibration);
          }
          if (data.pms_10 !== null && data.pms_10 !== undefined) {
            data.pms_10_corrected = applyCalibration(data.pms_10, calibration);
          }
        }
      } catch (calibrationError) {
        // Continue with raw data on error
      }

      // Store the reading in the database (NEW_DB_URL)
      try {
        await database.storeSensorReading(sensor_id, data);
      } catch (storageError) {
      }

      res.json(data);
    } catch (fetchError) {

      if (fetchError.name === 'AbortError') {
        return res.status(503).json({
          detail: "Request timeout: FloroSense API did not respond within 30 seconds",
        });
      }

      return res.status(503).json({
        detail: `Failed to connect to FloroSense API: ${fetchError.message}`,
      });
    }
  } catch (error) {
    next(error);
  }
};

export const getAllLatestReadings = async (req, res, next) => {
  try {
    const { sensor_ids } = req.query;
    let sensorIdList = null;

    if (sensor_ids) {
      sensorIdList = sensor_ids.split(',').map(id => id.trim()).filter(Boolean);
    }

    // Filter logic removed to allow all users to fetch latest readings for requested sensors (matching admin behavior)
    // if (req.user.role !== UserRole.ADMIN && req.user.role !== "assignee") {
    //   const userSensors = await database.getUserSensors(req.user.username);
    //   const userSensorIds = userSensors.map(s => s.sensor_id);

    //   if (sensorIdList) {
    //     sensorIdList = sensorIdList.filter(id => userSensorIds.includes(id));
    //   } else {
    //     sensorIdList = userSensorIds;
    //   }
    // }

    const readings = await database.getAllLatestSensorReadings(sensorIdList);

    res.json({
      success: true,
      data: readings,
    });
  } catch (error) {
    next(error);
  }
};

export const getFlorosenseHistorical = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const { start_date, end_date, limit = 1000 } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ detail: "start_date and end_date are required" });
    }

    const parsedLimit = Math.max(1, parseInt(limit, 10) || 1000);
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ detail: "Invalid start_date or end_date" });
    }
    // Make end_date inclusive when only a date (no time) was supplied
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(end_date))) {
      endDate.setUTCHours(23, 59, 59, 999);
    }

    // 1) Primary source: our own sensor_readings collection (filled every 10 min by the collector)
    const localReadings = await database.getSensorReadings(sensor_id, startDate, endDate, parsedLimit);
    if (localReadings.length > 0) {
      // getSensorReadings returns newest-first; charts want oldest-first
      return res.json({ success: true, source: "database", data: localReadings.reverse() });
    }

    // 2) Fallback: Florosense historical API (may be unavailable) — short timeout so the UI never hangs
    const florosenseUrl = `https://duton.florosense.cloud/api/florosense/sensors/${encodeURIComponent(sensor_id)}/historical`;
    const params = new URLSearchParams({ start_date, end_date, limit: String(parsedLimit) });

    try {
      const response = await fetch(`${florosenseUrl}?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        console.warn(`[getFlorosenseHistorical] Florosense fallback returned ${response.status} for ${sensor_id}`);
        return res.json({ success: true, source: "florosense", data: [] });
      }

      const data = await response.json();
      return res.json({ success: true, source: "florosense", data: Array.isArray(data) ? data : [] });
    } catch (fallbackError) {
      console.warn(`[getFlorosenseHistorical] Florosense fallback failed for ${sensor_id}:`, fallbackError.message);
      return res.json({ success: true, source: "florosense", data: [] });
    }
  } catch (error) {
    console.error("[getFlorosenseHistorical] Error:", error.message);
    res.status(500).json({ success: false, detail: "Failed to load historical data", data: [] });
  }
};

export const getSensorChartData = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const { time_range = "1m", data_type = "all" } = req.query;

    // Check if user is accessing via magic link (share_access token)
    let hasAccess = false;
    if (req.user.share_access && req.user.sensor_id === sensor_id) {
      // Magic link user has access to this specific sensor
      hasAccess = true;
    } else if (req.user.role === UserRole.BUILDER || req.user.role === UserRole.CONTRACTOR) {
      // For builders/contractors, check if sensor belongs to an assigned site
      const sensor = await database.getSensorById(sensor_id);
      if (sensor) {
        const userSites = await database.getUserSites(req.user.username);
        // Check both site_id and site_name since sensors might only have site_name
        hasAccess = userSites.some(s =>
          s.site_id === sensor.site_id ||
          s.site_id === sensor.site_name ||
          s.site_name === sensor.site_id ||
          s.site_name === sensor.site_name
        );
      }
    } else {
      // For regular users, check database assignments
      const userSensors = await database.getUserSensors(req.user.username);
      hasAccess = userSensors.some(s => s.sensor_id === sensor_id);
    }

    // Admin and assignee can access all sensors
    if (!hasAccess && req.user.role !== UserRole.ADMIN && req.user.role !== "assignee") {
      return res.status(403).json({
        detail: "Access denied to this sensor",
      });
    }

    // Verify sensor exists
    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    // Calculate date range based on time_range parameter
    const endDate = new Date();
    const startDate = new Date();

    // Map time_range to days
    const timeRangeMap = {
      "7d": 7,
      "1m": 30,
      "3m": 90,
      "6m": 180,
      "1y": 365,
    };

    const days = timeRangeMap[time_range] || 30;
    startDate.setDate(endDate.getDate() - days);

    // Format dates as YYYY-MM-DD
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    // Fetch historical data from FloroSense API
    // Endpoint: /api/florosense/sensors/:sensor_id/historical?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&limit=1000
    const florosenseBaseUrl = "https://duton.florosense.cloud/api";
    const historicalUrl = `${florosenseBaseUrl}/florosense/sensors/${encodeURIComponent(sensor_id)}/historical?start_date=${startDateStr}&end_date=${endDateStr}&limit=1000`;

    try {
      const response = await fetch(historicalUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });


      if (!response.ok) {
        return res.json({
          success: true,
          message: "Chart data retrieved successfully",
          data: {
            labels: [],
            datasets: [],
            timestamps: [],
          }
        });
      }

      const historicalData = await response.json();

      let calibration = null;
      try {
        const { fetchCalibrationFromFloroSense } = await import("../utils/florosenseCalibration.js");
        calibration = await fetchCalibrationFromFloroSense(sensor_id);
      } catch (calibrationError) {
        // Continue without calibration on error
      }

      // If no data, return empty structure
      if (!Array.isArray(historicalData) || historicalData.length === 0) {
        return res.json({
          success: true,
          message: "Chart data retrieved successfully",
          data: {
            labels: [],
            datasets: [],
            timestamps: [],
          }
        });
      }

      // Sort by timestamp to ensure chronological order
      const sortedData = [...historicalData].sort((a, b) => {
        const timeA = new Date(a.timestamp || a.time || a.date || 0).getTime();
        const timeB = new Date(b.timestamp || b.time || b.date || 0).getTime();
        return timeA - timeB;
      });

      // Transform the data to match the expected format
      let labels = [];
      let datasets = [];
      let timestamps = [];

      // Extract labels and timestamps
      labels = sortedData.map(point => {
        const time = point.time || point.timestamp || point.date || "";
        if (!time) return "";
        try {
          const date = new Date(time);
          return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch {
          return time;
        }
      });
      timestamps = sortedData.map(point => point.timestamp || point.time || point.date || "");

      let applyCalibration = null;
      if (calibration) {
        const calibrationUtil = await import("../utils/calibration.js");
        applyCalibration = calibrationUtil.applyCalibration;
      }

      const pm25Data = sortedData.map(point => {
        const rawVal = point.pm25 ?? point.pms_2_5 ?? point.pm2_5 ?? null;
        if (rawVal === null || rawVal === undefined) return null;
        const val = Number(rawVal);
        if (calibration && applyCalibration) {
          return applyCalibration(val, calibration);
        }
        return val;
      });
      if (pm25Data.some(val => val !== null && val !== undefined)) {
        datasets.push({
          label: "PM2.5",
          data: pm25Data,
        });
      }

      const pm10Data = sortedData.map(point => {
        const rawVal = point.pm10 ?? point.pms_10 ?? point.pm10_0 ?? null;
        if (rawVal === null || rawVal === undefined) return null;
        const val = Number(rawVal);
        if (calibration && applyCalibration) {
          return applyCalibration(val, calibration);
        }
        return val;
      });
      if (pm10Data.some(val => val !== null && val !== undefined)) {
        datasets.push({
          label: "PM10",
          data: pm10Data,
        });
      }

      // Extract temperature data
      const temperatureData = sortedData.map(point => {
        const val = point.temperature ?? point.ambient_temperature ?? null;
        return val !== null && val !== undefined ? Number(val) : null;
      });
      if (temperatureData.some(val => val !== null && val !== undefined)) {
        datasets.push({
          label: "Temperature",
          data: temperatureData,
        });
      }

      // Extract humidity data
      const humidityData = sortedData.map(point => {
        const val = point.humidity ?? point.relative_humidity ?? null;
        return val !== null && val !== undefined ? Number(val) : null;
      });
      if (humidityData.some(val => val !== null && val !== undefined)) {
        datasets.push({
          label: "Humidity",
          data: humidityData,
        });
      }


      res.json({
        success: true,
        message: "Chart data retrieved successfully",
        data: {
          labels,
          datasets,
          timestamps,
        }
      });
    } catch (fetchError) {
      // Return empty data structure on error
      res.json({
        success: true,
        message: "Chart data retrieved successfully",
        data: {
          labels: [],
          datasets: [],
          timestamps: [],
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

// Document storage configuration
const DOCUMENTS_DIR = path.join(process.cwd(), "data", "sensor_documents");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Ensure documents directory exists
if (!fs.existsSync(DOCUMENTS_DIR)) {
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DOCUMENTS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, XLS, XLSX, JPG, JPEG, PNG are allowed.'));
    }
  }
}).single('file');

export const uploadSensorDocument = (req, res, next) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ detail: err.message });
    } else if (err) {
      return res.status(400).json({ detail: err.message });
    }

    try {
      const { sensor_id } = req.params;
      const { document_type } = req.body;

      const sensor = await database.getSensorById(sensor_id);
      if (!sensor) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({ detail: "Sensor not found" });
      }

      // Upload: Admin (all sensors), Assignee/Technician/Engineer (assigned sensors only)
      const allowedRoles = [UserRole.ADMIN, "assignee", "technician", "engineer"];
      if (!allowedRoles.includes(req.user.role)) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ detail: "Only admin, assignee, technician, or engineer can upload documents" });
      }

      // For non-admin roles, check if they are assigned to this sensor
      if (req.user.role !== UserRole.ADMIN) {
        const userSensors = await database.getUserSensors(req.user.username);
        const hasAccess = userSensors.some(s => s.sensor_id === sensor_id);
        if (!hasAccess) {
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(403).json({ detail: "You are not assigned to this sensor" });
        }
      }

      if (!req.file) {
        return res.status(400).json({ detail: "No file uploaded" });
      }

      const db = database.getDatabase();
      const documentsCollection = db.collection("sensor_documents");

      const newDocument = {
        id: uuidv4(),
        sensor_id: sensor_id,
        filename: req.file.originalname,
        stored_filename: req.file.filename,
        file_path: req.file.path,
        file_size: req.file.size,
        document_type: document_type || null,
        uploaded_by: req.user.username,
        uploaded_at: new Date(),
        content_type: req.file.mimetype,
      };

      await documentsCollection.insertOne(newDocument);

      res.status(201).json({
        success: true,
        message: "Document uploaded successfully",
        data: { document: newDocument }
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(error);
    }
  });
};

export const getSensorDocuments = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;

    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    // View: All authenticated users can view documents for any sensor (no restriction)
    // No access check needed for viewing documents

    const db = database.getDatabase();
    const documentsCollection = db.collection("sensor_documents");

    // All users with access can see all documents for the sensor
    let query = { sensor_id: sensor_id };

    const documents = await documentsCollection.find(query).sort({ uploaded_at: -1 }).toArray();

    const formattedDocs = documents.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      document_type: doc.document_type || null,
      file_size: doc.file_size,
      uploaded_by: doc.uploaded_by,
      uploaded_at: doc.uploaded_at,
      content_type: doc.content_type
    }));

    res.json({
      success: true,
      message: "Documents retrieved successfully",
      data: { documents: formattedDocs }
    });
  } catch (error) {
    next(error);
  }
};

export const downloadSensorDocument = async (req, res, next) => {
  try {
    const { sensor_id, document_id } = req.params;

    const db = database.getDatabase();
    const documentsCollection = db.collection("sensor_documents");
    const document = await documentsCollection.findOne({ id: document_id, sensor_id: sensor_id });

    if (!document) {
      return res.status(404).json({
        detail: "Document not found",
      });
    }

    // Download/View: All authenticated users can download documents from any sensor (no restriction)
    // No access check needed for downloading documents

    if (!fs.existsSync(document.file_path)) {
      return res.status(404).json({
        detail: "File not found on server",
      });
    }

    res.download(document.file_path, document.filename, (err) => {
      if (err) {
        if (!res.headersSent) {
          res.status(500).json({
            detail: "Error downloading file",
          });
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSensorDocument = async (req, res, next) => {
  try {
    const { sensor_id, document_id } = req.params;

    const db = database.getDatabase();
    const documentsCollection = db.collection("sensor_documents");
    const document = await documentsCollection.findOne({ id: document_id, sensor_id: sensor_id });

    if (!document) {
      return res.status(404).json({
        detail: "Document not found",
      });
    }

    // Delete: Admin (all sensors), Assignee/Technician/Engineer (assigned sensors only)
    const allowedRoles = [UserRole.ADMIN, "assignee", "technician", "engineer"];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        detail: "Only admin, assignee, technician, or engineer can delete documents",
      });
    }

    // For non-admin roles, check if they are assigned to this sensor
    if (req.user.role !== UserRole.ADMIN) {
      const userSensors = await database.getUserSensors(req.user.username);
      const hasAccess = userSensors.some(s => s.sensor_id === sensor_id);
      if (!hasAccess) {
        return res.status(403).json({
          detail: "You are not assigned to this sensor",
        });
      }
    }

    if (fs.existsSync(document.file_path)) {
      fs.unlinkSync(document.file_path);
    }

    await documentsCollection.deleteOne({ id: document_id });

    res.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get users by role (Admin only)
export const getUsersByRole = async (req, res, next) => {
  try {
    const { role } = req.params;

    // Validate role
    const validRoles = ["user", "assignee", "engineer", "technician", "client"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        detail: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      });
    }

    const users = await database.getUsersByRole(role);

    res.json({
      success: true,
      message: `Users with role ${role} retrieved successfully`,
      data: { users }
    });
  } catch (error) {
    next(error);
  }
};

// Assign sensor to user (Admin only)
export const assignSensorToUser = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        detail: "Username is required",
      });
    }

    // Verify sensor exists
    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    // Assign sensor to user
    const assignment = await database.assignSensorToUser(username, sensor_id);

    res.json({
      success: true,
      message: `Sensor ${sensor_id} assigned to ${username} successfully`,
      data: { assignment }
    });
  } catch (error) {
    next(error);
  }
};

// Get users assigned to a sensor (Admin only)
// Uses user_sensors collection directly to show all assigned users (ANY ROLE)
export const getUsersForSensor = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;

    const assignments = await database.getUsersForSensor(sensor_id);

    const users = [];
    for (const assignment of assignments) {
      const user = await database.getUserByUsername(assignment.username);
      if (user) {
        users.push({
          username: user.username,
          email: user.email,
          role: user.role,
          full_name: user.full_name || user.username,
          assigned_at: assignment.assigned_at,
        });
      } else {
        users.push({
          username: assignment.username,
          email: null,
          role: null,
          full_name: assignment.username,
          assigned_at: assignment.assigned_at,
        });
      }
    }

    res.json({
      success: true,
      message: "Users assigned to sensor retrieved successfully",
      data: { users }
    });
  } catch (error) {
    console.error(`[getUsersForSensor] Error:`, error);
    next(error);
  }
};

// Unassign sensor from user (Admin only)
export const unassignSensorFromUser = async (req, res, next) => {
  try {
    const { sensor_id, username } = req.params;

    if (!username) {
      return res.status(400).json({
        detail: "Username is required",
      });
    }

    // Verify sensor exists
    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    // Remove sensor assignment from user
    const removed = await database.removeSensorFromUser(username, sensor_id);

    if (!removed) {
      return res.status(404).json({
        detail: "Sensor assignment not found",
      });
    }

    res.json({
      success: true,
      message: `Sensor ${sensor_id} unassigned from ${username} successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// Generate share access link (magic link) for sensor
export const generateShareAccessLink = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const { email, duration_hours = 24, permissions = ["view"] } = req.body;

    // Check if user is authenticated
    if (!req.user && !req.admin) {
      return res.status(401).json({
        detail: "Authentication required",
      });
    }

    const username = req.user?.username || req.admin?.username;
    if (!username) {
      return res.status(401).json({
        detail: "User information not found in token",
      });
    }

    if (!email) {
      return res.status(400).json({
        detail: "Email is required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        detail: "Invalid email format",
      });
    }

    // Duration validation relaxed for permanent access (supports long durations)
    if (duration_hours === undefined || duration_hours === null || duration_hours <= 0) {
      return res.status(400).json({
        detail: "Duration must be a positive number",
      });
    }

    // Verify sensor exists
    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    // Create share access token
    const { token, tokenData } = await database.createShareAccessToken({
      sensor_id: sensor_id,
      email: email,
      created_by: username,
      duration_hours: duration_hours,
      permissions: permissions
    });

    // Generate magic link
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const magicLink = `${baseUrl}/access?t=${token}&s=${sensor_id}`;

    // Send email with magic link
    const sensorName = sensor.name || sensor.sensor_id || sensor_id;
    const emailSent = await sendMagicLinkEmail(
      email,
      sensor_id,
      sensorName,
      magicLink,
      duration_hours
    );

    if (!emailSent) {
      // Return success but with warning about email
      return res.json({
        success: true,
        message: `Token created successfully, but email could not be sent to ${email}. Please check SMTP configuration.`,
        warning: "Email not sent - check SMTP settings",
        data: {
          token_id: tokenData.id,
          email: email,
          expires_at: tokenData.expires_at,
          duration_hours: duration_hours,
          email_sent: false,
          magic_link: magicLink
        }
      });
    }

    res.json({
      success: true,
      message: `Magic link sent successfully to ${email}`,
      data: {
        token_id: tokenData.id,
        email: email,
        expires_at: tokenData.expires_at,
        duration_hours: duration_hours,
        email_sent: true
      }
    });
  } catch (error) {
    next(error);
  }
};

// Validate magic link and create session
export const validateMagicLink = async (req, res, next) => {
  try {
    const { token, sensor_id } = req.body;

    if (!token) {
      return res.status(400).json({
        detail: "Token is required",
      });
    }

    // Get IP address and user agent
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;

    // Validate token
    const tokenData = await database.validateShareAccessToken(token, ipAddress, userAgent);

    if (!tokenData) {
      return res.status(401).json({
        detail: "Invalid, expired, or already used token",
      });
    }

    // Verify sensor_id matches (if provided)
    if (sensor_id && tokenData.sensor_id !== sensor_id) {
      return res.status(403).json({
        detail: "Token does not match sensor",
      });
    }

    // Create a temporary session token (JWT)
    const settings = getSettings();
    const sessionToken = jwt.sign(
      {
        username: tokenData.email,
        email: tokenData.email,
        role: "guest",
        sensor_id: tokenData.sensor_id,
        permissions: tokenData.permissions,
        share_access: true,
        expires_at: tokenData.expires_at
      },
      settings.JWT_SECRET,
      { expiresIn: "4h" } // Short session (4 hours)
    );

    res.json({
      success: true,
      message: "Token validated successfully",
      data: {
        session_token: sessionToken,
        sensor_id: tokenData.sensor_id,
        email: tokenData.email,
        permissions: tokenData.permissions,
        expires_at: tokenData.expires_at
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all share access tokens for a sensor
export const getShareAccessTokens = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;

    // Verify sensor exists
    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    const tokens = await database.getShareAccessTokens(sensor_id);

    // Remove sensitive data (token_hash) from response
    const safeTokens = tokens.map(t => ({
      id: t.id,
      email: t.email,
      created_by: t.created_by,
      created_at: t.created_at,
      expires_at: t.expires_at,
      used: t.used,
      used_at: t.used_at,
      revoked: t.revoked,
      revoked_at: t.revoked_at,
      revoked_by: t.revoked_by,
      permissions: t.permissions
    }));

    res.json({
      success: true,
      message: "Share access tokens retrieved successfully",
      data: { tokens: safeTokens }
    });
  } catch (error) {
    next(error);
  }
};

// Revoke share access token
export const revokeShareAccessToken = async (req, res, next) => {
  try {
    const { sensor_id, token_id } = req.params;

    // Check if user is authenticated
    if (!req.user && !req.admin) {
      return res.status(401).json({
        detail: "Authentication required",
      });
    }

    const username = req.user?.username || req.admin?.username;
    if (!username) {
      return res.status(401).json({
        detail: "User information not found in token",
      });
    }

    // Verify sensor exists
    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    const revoked = await database.revokeShareAccessToken(token_id, username);

    if (!revoked) {
      return res.status(404).json({
        detail: "Token not found or already revoked",
      });
    }

    res.json({
      success: true,
      message: "Share access token revoked successfully"
    });
  } catch (error) {
    next(error);
  }
};


export const proxyDownloadSensorData = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const { start_time, end_time, format } = req.query;

    const settings = getSettings();
    const baseUrl = settings.FLOROSENSE_BASE_URL || "https://duton.florosense.cloud";

    const externalUrl = `${baseUrl}/api/sensors/download/${encodeURIComponent(sensor_id)}?start_time=${encodeURIComponent(start_time)}&end_time=${encodeURIComponent(end_time)}&format=${encodeURIComponent(format)}`;

    const response = await fetch(externalUrl, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'X-API-Key': settings.FLOROSENSE_API_KEY || process.env.NEXT_PUBLIC_FLOROSENSE_API_KEY || ""
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`External proxy download failed: ${response.status} ${errorText}`);
      return res.status(response.status).json({
        detail: `Failed to download file from external API: ${response.statusText}`
      });
    }

    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    } else {
      const ext = format === 'excel' ? 'xlsx' : format;
      res.setHeader('Content-Disposition', `attachment; filename="sensor_data_${sensor_id}.${ext}"`);
    }

    // Modern Node.js fetch (undici) returns a web standard ReadableStream
    // We can iterate over it asynchronously
    if (response.body) {
      for await (const chunk of response.body) {
        res.write(Buffer.from(chunk));
      }
    }
    res.end();

  } catch (error) {
    console.error("Proxy download error:", error);
    next(error);
  }
};

export const getAllSensorsAPI = async (req, res, next) => {
  try {
    const sensors = await database.getAllSensors({});
    res.json({
      success: true,
      message: "All sensors retrieved successfully",
      data: sensors
    });
  } catch (error) {
    next(error);
  }
};

export const getSensorDetailsAdmin = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const sensor = await database.getSensorById(sensor_id);

    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found",
      });
    }

    res.json({
      success: true,
      message: "Sensor details retrieved successfully",
      data: sensor
    });
  } catch (error) {
    next(error);
  }
};

export const getSensorSheetData = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const foundSiteData = await fetchSiteBySensorIdFromGoogleSheet(sensor_id);

    if (foundSiteData) {
      res.json({
        success: true,
        message: "Site data retrieved successfully from Google Sheet",
        data: foundSiteData,
      });
    } else {
      res.status(404).json({
        success: false,
        detail: "Sensor_id not found in the Google Sheet",
      });
    }
  } catch (error) {
    if (error.message === "Failed to fetch data from Google Sheets") {
      return res.status(500).json({ detail: error.message });
    }
    next(error);
  }
};

export const getAllSensorsSheetData = async (req, res, next) => {
  try {
    const allSitesData = await fetchAllSitesFromGoogleSheet();

    res.json({
      success: true,
      message: "All sites data retrieved successfully from Google Sheet",
      data: allSitesData,
      total_count: allSitesData.length,
    });
  } catch (error) {
    if (error.message === "Failed to fetch data from Google Sheets") {
      return res.status(500).json({ detail: error.message });
    }
    next(error);
  }
};

const ANOMALY_CHECK_BATCH_SIZE = 20;

function detectStuckFields(readings) {
  if (!readings || readings.length < 2) return null;

  const fieldsToCheck = ["pm2_5", "pm10_0"];
  const stuckFields = [];

  for (const field of fieldsToCheck) {
    const values = readings
      .map((r) => r[field])
      .filter((val) => val !== null && val !== undefined);

    if (values.length >= 2) {
      const firstValue = values[0];
      const isStuck = values.every((val) => val === firstValue);
      if (isStuck) {
        stuckFields.push({
          field: field,
          value: firstValue,
          count: values.length,
        });
      }
    }
  }

  if (stuckFields.length === 0) return null;

  return {
    stuck_fields: stuckFields,
    readings_count: readings.length,
    last_timestamp: readings[0].timestamp,
    first_timestamp: readings[readings.length - 1].timestamp,
  };
}

async function checkSensorAnomaly(sensor, startDate, endDate) {
  const readings = await database.getSensorReadings(
    sensor.sensor_id,
    startDate,
    endDate,
    10000
  );

  const detection = detectStuckFields(readings);
  if (!detection) return null;

  return {
    sensor_id: sensor.sensor_id,
    device_id: sensor.device_id,
    site_name: sensor.site_name,
    client_name: sensor.client_name,
    location: sensor.location,
    spoc_name: sensor.spoc_name,
    spoc_contact: sensor.spoc_contact,
    ...detection,
  };
}

export const getSensorAnomalies = async (req, res, next) => {
  try {
    let sensors;
    if (req.user.role === UserRole.ADMIN || req.user.role === "assignee") {
      sensors = await database.getAllSensors({ is_active: true });
    } else {
      const userSensors = await database.getUserSensors(req.user.username);
      sensors = userSensors.filter((s) => s.is_active !== false);
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
    const anomalies = [];

    for (let i = 0; i < sensors.length; i += ANOMALY_CHECK_BATCH_SIZE) {
      const batch = sensors.slice(i, i + ANOMALY_CHECK_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((sensor) => checkSensorAnomaly(sensor, startDate, endDate))
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          anomalies.push(result.value);
        } else if (result.status === "rejected") {
          console.error("[getSensorAnomalies] Sensor check failed:", result.reason);
        }
      }
    }

    res.json({
      success: true,
      message: "Sensor anomalies retrieved successfully",
      data: {
        anomalies: anomalies,
        total_count: anomalies.length,
      },
    });
  } catch (error) {
    next(error);
  }
};
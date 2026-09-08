import * as database from "../services/database.js";

export const getCalibration = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;

    if (!sensor_id) {
      return res.status(400).json({
        detail: "sensor_id is required"
      });
    }

    const calibration = await database.getCalibrationBySensorId(sensor_id);

    if (!calibration) {
      return res.status(404).json({
        detail: "Calibration not found for this sensor_id"
      });
    }

    res.status(200).json(calibration);
  } catch (error) {
    next(error);
  }
};

export const updateCalibration = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const calibrationData = req.body;

    if (!sensor_id) {
      return res.status(400).json({
        detail: "sensor_id is required"
      });
    }

    // Check if calibration exists
    const existing = await database.getCalibrationBySensorId(sensor_id);
    if (!existing) {
      return res.status(404).json({
        detail: "Calibration not found for this sensor_id. Use POST to create a new calibration."
      });
    }

    // Validate format (pm25/pm10 structure or legacy format)
    if (calibrationData.pm25 || calibrationData.pm10) {
      // New format validation
      if (calibrationData.pm25) {
        if (typeof calibrationData.pm25.k0 !== 'undefined' && typeof calibrationData.pm25.k0 !== 'number') {
          return res.status(400).json({ detail: "pm25.k0 must be a number" });
        }
        if (typeof calibrationData.pm25.k1 !== 'undefined' && typeof calibrationData.pm25.k1 !== 'number') {
          return res.status(400).json({ detail: "pm25.k1 must be a number" });
        }
        if (typeof calibrationData.pm25.variationMin !== 'undefined' && typeof calibrationData.pm25.variationMin !== 'number') {
          return res.status(400).json({ detail: "pm25.variationMin must be a number" });
        }
        if (typeof calibrationData.pm25.variationMax !== 'undefined' && typeof calibrationData.pm25.variationMax !== 'number') {
          return res.status(400).json({ detail: "pm25.variationMax must be a number" });
        }
      }
      if (calibrationData.pm10) {
        if (typeof calibrationData.pm10.k0 !== 'undefined' && typeof calibrationData.pm10.k0 !== 'number') {
          return res.status(400).json({ detail: "pm10.k0 must be a number" });
        }
        if (typeof calibrationData.pm10.k1 !== 'undefined' && typeof calibrationData.pm10.k1 !== 'number') {
          return res.status(400).json({ detail: "pm10.k1 must be a number" });
        }
        if (typeof calibrationData.pm10.variationMin !== 'undefined' && typeof calibrationData.pm10.variationMin !== 'number') {
          return res.status(400).json({ detail: "pm10.variationMin must be a number" });
        }
        if (typeof calibrationData.pm10.variationMax !== 'undefined' && typeof calibrationData.pm10.variationMax !== 'number') {
          return res.status(400).json({ detail: "pm10.variationMax must be a number" });
        }
      }
    }

    // Update calibration
    const updated = await database.updateCalibration(sensor_id, calibrationData);

    if (!updated) {
      return res.status(404).json({
        detail: "Calibration not found"
      });
    }

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

export const createCalibration = async (req, res, next) => {
  try {
    const { sensor_id } = req.params;
    const calibrationData = req.body;

    if (!sensor_id) {
      return res.status(400).json({
        detail: "sensor_id is required"
      });
    }

    // Validate format (pm25/pm10 structure preferred, but support legacy format)
    if (calibrationData.pm25 || calibrationData.pm10) {
      // New format validation
      if (calibrationData.pm25) {
        if (typeof calibrationData.pm25.k0 !== 'number') {
          return res.status(400).json({ detail: "pm25.k0 must be a number" });
        }
        if (typeof calibrationData.pm25.k1 !== 'number') {
          return res.status(400).json({ detail: "pm25.k1 must be a number" });
        }
        if (typeof calibrationData.pm25.variationMin !== 'number') {
          return res.status(400).json({ detail: "pm25.variationMin must be a number" });
        }
        if (typeof calibrationData.pm25.variationMax !== 'number') {
          return res.status(400).json({ detail: "pm25.variationMax must be a number" });
        }
      }
      if (calibrationData.pm10) {
        if (typeof calibrationData.pm10.k0 !== 'number') {
          return res.status(400).json({ detail: "pm10.k0 must be a number" });
        }
        if (typeof calibrationData.pm10.k1 !== 'number') {
          return res.status(400).json({ detail: "pm10.k1 must be a number" });
        }
        if (typeof calibrationData.pm10.variationMin !== 'number') {
          return res.status(400).json({ detail: "pm10.variationMin must be a number" });
        }
        if (typeof calibrationData.pm10.variationMax !== 'number') {
          return res.status(400).json({ detail: "pm10.variationMax must be a number" });
        }
      }
    }

    // Check if calibration already exists
    const existing = await database.getCalibrationBySensorId(sensor_id);
    if (existing) {
      return res.status(409).json({
        detail: "Calibration already exists for this sensor_id. Use PUT to update."
      });
    }

    // Verify sensor exists
    const sensor = await database.getSensorById(sensor_id);
    if (!sensor) {
      return res.status(404).json({
        detail: "Sensor not found"
      });
    }

    // Create calibration with sensor_id from URL
    const calibrationToCreate = {
      ...calibrationData,
      sensor_id: sensor_id
    };

    const created = await database.createCalibration(calibrationToCreate);

    res.status(201).json(created);
  } catch (error) {
    if (error.message.includes("already exists")) {
      return res.status(409).json({
        detail: error.message
      });
    }
    next(error);
  }
};

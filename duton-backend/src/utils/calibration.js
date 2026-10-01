function randomBetween(min, max) {
  if (min === max) return min;
  if (min > max) {
    [min, max] = [max, min];
  }
  return Math.random() * (max - min) + min;
}

function hasOwnCoefficients(source) {
  if (!source || typeof source !== "object") return false;
  return (
    Object.prototype.hasOwnProperty.call(source, "k0") ||
    Object.prototype.hasOwnProperty.call(source, "k1") ||
    Object.prototype.hasOwnProperty.call(source, "variationMin") ||
    Object.prototype.hasOwnProperty.call(source, "variationMax") ||
    Object.prototype.hasOwnProperty.call(source, "initial_offset_k0") ||
    Object.prototype.hasOwnProperty.call(source, "fine_multiplier_k1") ||
    Object.prototype.hasOwnProperty.call(source, "rh_strength_a") ||
    Object.prototype.hasOwnProperty.call(source, "rh_curvature_b")
  );
}

function resolveCoefficients(calibration, pollutant) {
  const specific = pollutant ? calibration?.[pollutant] : null;
  const source = hasOwnCoefficients(specific) ? specific : calibration;
  return {
    K0: source?.initial_offset_k0 ?? source?.k0 ?? 0,
    K1: source?.fine_multiplier_k1 ?? source?.k1 ?? 1,
    a: source?.rh_strength_a ?? source?.variationMin ?? 0,
    b: source?.rh_curvature_b ?? source?.variationMax ?? 0,
  };
}

export function applyCalibration(pmRaw, calibration, pollutant) {
  if (pmRaw === null || pmRaw === undefined || isNaN(pmRaw)) {
    return pmRaw;
  }

  if (!calibration) {
    return pmRaw;
  }

  const { K0, K1, a, b } = resolveCoefficients(calibration, pollutant);

  const randomOffset = randomBetween(a, b);
  const pmCorrected = K0 + (K1 * pmRaw) + randomOffset;
  const result = Math.max(0, pmCorrected);

  return Math.round(result * 100) / 100;
}

export function applyCalibrationToReading(reading, calibration) {
  if (!reading || !calibration) {
    return reading;
  }

  const calibrated = { ...reading };

  if (calibrated.pm2_5 !== null && calibrated.pm2_5 !== undefined) {
    calibrated.pm2_5_corrected = applyCalibration(calibrated.pm2_5, calibration, "pm25");
  }
  if (calibrated.pms_2_5 !== null && calibrated.pms_2_5 !== undefined) {
    calibrated.pms_2_5_corrected = applyCalibration(calibrated.pms_2_5, calibration, "pm25");
  }

  if (calibrated.pm10_0 !== null && calibrated.pm10_0 !== undefined) {
    calibrated.pm10_0_corrected = applyCalibration(calibrated.pm10_0, calibration, "pm10");
  }
  if (calibrated.pms_10 !== null && calibrated.pms_10 !== undefined) {
    calibrated.pms_10_corrected = applyCalibration(calibrated.pms_10, calibration, "pm10");
  }

  return calibrated;
}

export async function fetchAndApplyCalibration(sensorId, reading) {
  if (!sensorId || !reading) {
    return reading;
  }

  try {
    const database = await import("../services/database.js");
    const calibration = await database.getCalibrationBySensorId(sensorId);

    if (calibration) {
      return applyCalibrationToReading(reading, calibration);
    }

    return reading;
  } catch (error) {
    return reading;
  }
}

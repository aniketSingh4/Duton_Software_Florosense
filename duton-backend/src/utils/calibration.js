function randomBetween(min, max) {
  if (min === max) return min;
  if (min > max) {
    [min, max] = [max, min];
  }
  return Math.random() * (max - min) + min;
}

export function applyCalibration(pmRaw, calibration) {
  if (pmRaw === null || pmRaw === undefined || isNaN(pmRaw)) {
    return pmRaw;
  }

  if (!calibration) {
    return pmRaw;
  }

  const K0 = calibration.initial_offset_k0 ?? 0;
  const K1 = calibration.fine_multiplier_k1 ?? 1;
  const a = calibration.rh_strength_a ?? 0;
  const b = calibration.rh_curvature_b ?? 0;

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
    calibrated.pm2_5_corrected = applyCalibration(calibrated.pm2_5, calibration);
  }
  if (calibrated.pms_2_5 !== null && calibrated.pms_2_5 !== undefined) {
    calibrated.pms_2_5_corrected = applyCalibration(calibrated.pms_2_5, calibration);
  }

  if (calibrated.pm10_0 !== null && calibrated.pm10_0 !== undefined) {
    calibrated.pm10_0_corrected = applyCalibration(calibrated.pm10_0, calibration);
  }
  if (calibrated.pms_10 !== null && calibrated.pms_10 !== undefined) {
    calibrated.pms_10_corrected = applyCalibration(calibrated.pms_10, calibration);
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


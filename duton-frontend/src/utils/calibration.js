const DEFAULT_CALIBRATION = {
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
}

const CALIBRATION_STORAGE_KEY = "duton_pm_calibration"

export const getCalibrationValuesSync = (sensorId = null) => {
  if (typeof window === "undefined") return DEFAULT_CALIBRATION

  try {
    const key = sensorId ? `${CALIBRATION_STORAGE_KEY}_${sensorId}` : CALIBRATION_STORAGE_KEY
    const stored = window.localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        pm25: { ...DEFAULT_CALIBRATION.pm25, ...parsed.pm25 },
        pm10: { ...DEFAULT_CALIBRATION.pm10, ...parsed.pm10 },
      }
    }
  } catch (error) {
    // Silent fail
  }

  return DEFAULT_CALIBRATION
}

export const reloadCalibrationFromDB = async (sensorId) => {
  if (typeof window === "undefined" || !sensorId) return

  try {
    const { fetchSensorCalibration } = await import("./api")
    const dbCalibration = await fetchSensorCalibration(sensorId)
    if (dbCalibration) {
      const key = `${CALIBRATION_STORAGE_KEY}_${sensorId}`
      window.localStorage.setItem(key, JSON.stringify(dbCalibration))
      return {
        pm25: { ...DEFAULT_CALIBRATION.pm25, ...dbCalibration.pm25 },
        pm10: { ...DEFAULT_CALIBRATION.pm10, ...dbCalibration.pm10 },
      }
    }
  } catch (error) {
    // Silent fail
  }
  return null
}

const getVariation = (min, max) => {
  if (min === null || max === null || min === undefined || max === undefined) {
    return 0
  }

  if (min > max) {
    [min, max] = [max, min]
  }

  if (min === max) return min

  const variation = Math.random() * (max - min) + min
  return Math.max(min, Math.min(max, variation))
}

export const applyCalibration = (pmRaw, type = "pm25", sensorId = null) => {
  if (pmRaw === null || pmRaw === undefined) return pmRaw

  const calibration = getCalibrationValuesSync(sensorId)
  const config = calibration[type] || DEFAULT_CALIBRATION.pm25

  const k0 = config.k0 ?? 0
  const k1 = config.k1 ?? 1
  const variationMin = config.variationMin ?? 0
  const variationMax = config.variationMax ?? 0

  const variation = getVariation(variationMin, variationMax)
  const pmCorrected = k0 + k1 * pmRaw + variation

  if (pmCorrected < 0) {
    return 0
  }

  return Math.round(pmCorrected * 100) / 100
}

const DEFAULT_COEFFICIENTS = {
  k0: 0,
  k1: 1,
  variationMin: 0,
  variationMax: 0,
}

const DEFAULT_CALIBRATION = {
  pm25: { ...DEFAULT_COEFFICIENTS },
  pm10: { ...DEFAULT_COEFFICIENTS },
}

const CALIBRATION_STORAGE_KEY = "duton_pm_calibration"

const coefficientsFromSource = (source) => {
  if (!source || typeof source !== "object") {
    return { ...DEFAULT_COEFFICIENTS }
  }

  return {
    k0: source.k0 ?? source.initial_offset_k0 ?? 0,
    k1: source.k1 ?? source.fine_multiplier_k1 ?? 1,
    variationMin: source.variationMin ?? source.rh_strength_a ?? 0,
    variationMax: source.variationMax ?? source.rh_curvature_b ?? 0,
  }
}

const unwrapCalibration = (saved) => {
  if (!saved || typeof saved !== "object") return null

  if (
    saved.pm25 ||
    saved.pm10 ||
    "rh_strength_a" in saved ||
    "initial_offset_k0" in saved ||
    "k0" in saved
  ) {
    return saved
  }

  if (saved.calibration && typeof saved.calibration === "object") {
    return unwrapCalibration(saved.calibration)
  }

  if (saved.data && typeof saved.data === "object") {
    return unwrapCalibration(saved.data)
  }

  return saved
}

export const normalizeCalibration = (saved) => {
  const doc = unwrapCalibration(saved)
  if (!doc) return {
    pm25: { ...DEFAULT_COEFFICIENTS },
    pm10: { ...DEFAULT_COEFFICIENTS },
  }

  if (doc.pm25 || doc.pm10) {
    return {
      pm25: { ...DEFAULT_COEFFICIENTS, ...coefficientsFromSource(doc.pm25) },
      pm10: { ...DEFAULT_COEFFICIENTS, ...coefficientsFromSource(doc.pm10) },
    }
  }

  const shared = coefficientsFromSource(doc)
  return {
    pm25: { ...shared },
    pm10: { ...shared },
  }
}

export const isPollutantCalibrated = (saved, type) => {
  if (!saved) return false
  const config = normalizeCalibration(saved)[type]
  if (!config) return false
  return config.k0 !== 0 || config.k1 !== 1 || config.variationMin !== 0 || config.variationMax !== 0
}

export const getCalibrationValuesSync = (sensorId = null) => {
  if (typeof window === "undefined") return DEFAULT_CALIBRATION

  try {
    const key = sensorId ? `${CALIBRATION_STORAGE_KEY}_${sensorId}` : CALIBRATION_STORAGE_KEY
    const stored = window.localStorage.getItem(key)
    if (stored) {
      return normalizeCalibration(JSON.parse(stored))
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
      return normalizeCalibration(dbCalibration)
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

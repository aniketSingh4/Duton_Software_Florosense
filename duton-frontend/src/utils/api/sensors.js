import { API_BASE_URL, getTicketApiBaseUrl, TICKET_API_BASE_URL, getAuthToken, getAuthHeaders } from "./client.js"

// User Sensors API
export const fetchUserSensors = async () => {
  try {
    const userType = typeof window !== "undefined" ? (window.localStorage.getItem("duton_user_type") || "").trim() : null

    // For admin users, use GET /api/admin/sensors from Postman collection
    // Endpoint: {{base_url}}/api/admin/sensors (Get All Sensors - not just available ones)
    if (userType === "admin") {
      try {
        const headers = getAuthHeaders()
        // Admin endpoint from Postman collection: GET /api/admin/sensors
        // This returns ALL sensors, not just available ones
        const ticketUrl = `${getTicketApiBaseUrl()}/admin/sensors`

        const response = await fetch(ticketUrl, {
          headers,
        })

        let payload = null
        try {
          const text = await response.text()
          payload = text ? JSON.parse(text) : null
        } catch (parseError) {
          throw new Error(`Invalid JSON response from server: ${parseError.message}`)
        }

        if (response.ok) {
          // Handle both array response and object with data property
          let sensors = []
          if (Array.isArray(payload)) {
            sensors = payload
          } else if (Array.isArray(payload?.data)) {
            sensors = payload.data
          } else if (payload?.data && typeof payload.data === 'object') {
            // Sometimes data might be an object, try to extract array from it
            sensors = Object.values(payload.data).filter(Array.isArray).flat() || []
          }

          if (sensors.length === 0) {
            return []
          }

          const transformedSensors = sensors.map((sensor) => ({
            sensor_id: sensor.sensor_id || sensor.device_id || sensor.identifier,
            device_id: sensor.device_id || sensor.sensor_id,
            location: sensor.location || {},
            is_active: sensor.is_active !== false,
            client_name: sensor.client_name || "",
            site_name: sensor.site_name || sensor.name || "",
            remark: sensor.remark || null,
            remark_date: sensor.remark_date || sensor.remarkDate || null,
            installation_date: sensor.installation_date || sensor.installationDate || null,
            spoc_name: sensor.spoc_name || sensor.spocName || "",
            spoc_contact: sensor.spoc_contact || sensor.spocContact || "",
            last_reading: sensor.last_reading || sensor.current_reading || null,
          }))

          return transformedSensors
        } else {
          const errorMsg = payload?.detail || payload?.message || payload?.error || `Failed to fetch sensors from ticket-backend (${response.status})`
          throw new Error(errorMsg)
        }
      } catch (ticketError) {
        if (ticketError.message?.includes("Failed to fetch") || ticketError.name === "TypeError") {
          throw new Error(`Cannot connect to ticket-backend server at ${getTicketApiBaseUrl()}. Please ensure the server is running.`)
        }
        throw new Error(ticketError.message || "Failed to fetch sensors. Please try again.")
      }
    }

    // For assignee users, use the exact same API endpoint as admin
    // Endpoint: GET /api/admin/sensors (Get All Sensors from Postman collection)
    if (userType === "assignee") {
      try {
        const headers = getAuthHeaders()
        // Use the same admin endpoint: GET /api/admin/sensors
        const ticketUrl = `${getTicketApiBaseUrl()}/admin/sensors`

        const response = await fetch(ticketUrl, {
          headers,
        })

        let payload = null
        try {
          const text = await response.text()
          payload = text ? JSON.parse(text) : null
        } catch (parseError) {
          throw new Error(`Invalid JSON response from server: ${parseError.message}`)
        }

        if (response.ok) {
          // Handle both array response and object with data property
          let sensors = []
          if (Array.isArray(payload)) {
            sensors = payload
          } else if (Array.isArray(payload?.data)) {
            sensors = payload.data
          } else if (payload?.data && typeof payload.data === 'object') {
            // Sometimes data might be an object, try to extract array from it
            sensors = Object.values(payload.data).filter(Array.isArray).flat() || []
          }

          if (sensors.length === 0) {
            return []
          }

          const transformedSensors = sensors.map((sensor) => ({
            sensor_id: sensor.sensor_id || sensor.device_id || sensor.identifier,
            device_id: sensor.device_id || sensor.sensor_id,
            location: sensor.location || {},
            is_active: sensor.is_active !== false,
            client_name: sensor.client_name || "",
            site_name: sensor.site_name || sensor.name || "",
            remark: sensor.remark || null,
            remark_date: sensor.remark_date || sensor.remarkDate || null,
            installation_date: sensor.installation_date || sensor.installationDate || null,
            spoc_name: sensor.spoc_name || sensor.spocName || "",
            spoc_contact: sensor.spoc_contact || sensor.spocContact || "",
            last_reading: sensor.last_reading || sensor.current_reading || null,
          }))

          return transformedSensors
        } else {
          const errorMsg = payload?.detail || payload?.message || payload?.error || `Failed to fetch sensors from ticket-backend (${response.status})`
          throw new Error(errorMsg)
        }
      } catch (ticketError) {
        if (ticketError.message?.includes("Failed to fetch") || ticketError.name === "TypeError") {
          throw new Error(`Cannot connect to ticket-backend server at ${getTicketApiBaseUrl()}. Please ensure the server is running.`)
        }
        throw new Error(ticketError.message || "Failed to fetch sensors. Please try again.")
      }
    }

    if (userType === "builder" || userType === "contractor") {
      try {
        const headers = getAuthHeaders()
        // Use the same admin endpoint: GET /api/admin/sensors
        const ticketUrl = `${getTicketApiBaseUrl()}/admin/sensors`
        const response = await fetch(ticketUrl, {
          headers,
        })

        let payload = null
        try {
          const text = await response.text()
          payload = text ? JSON.parse(text) : null
        } catch (parseError) {
          throw new Error(`Invalid JSON response from server: ${parseError.message}`)
        }

        if (response.ok) {
          let sensors = []
          if (Array.isArray(payload)) {
            sensors = payload
          } else if (Array.isArray(payload?.data)) {
            sensors = payload.data
          } else if (payload?.data && typeof payload.data === 'object') {
            sensors = Object.values(payload.data).filter(Array.isArray).flat() || []
          }

          if (sensors.length === 0) {
            return []
          }

          const transformedSensors = sensors.map((sensor) => ({
            sensor_id: sensor.sensor_id || sensor.device_id || sensor.identifier,
            device_id: sensor.device_id || sensor.sensor_id,
            location: sensor.location || {},
            is_active: sensor.is_active !== false,
            client_name: sensor.client_name || "",
            site_name: sensor.site_name || sensor.name || "",
            remark: sensor.remark || null,
            remark_date: sensor.remark_date || sensor.remarkDate || null,
            installation_date: sensor.installation_date || sensor.installationDate || null,
            spoc_name: sensor.spoc_name || sensor.spocName || "",
            spoc_contact: sensor.spoc_contact || sensor.spocContact || "",
            last_reading: sensor.last_reading || sensor.current_reading || null,
          }))

          return transformedSensors
        } else {
          const errorMsg = payload?.detail || payload?.message || payload?.error || `Failed to fetch sensors from ticket-backend (${response.status})`
          throw new Error(errorMsg)
        }
      } catch (ticketError) {
        if (ticketError.message?.includes("Failed to fetch") || ticketError.name === "TypeError") {
          throw new Error(`Cannot connect to ticket-backend server at ${getTicketApiBaseUrl()}. Please ensure the server is running.`)
        }
        throw new Error(ticketError.message || "Failed to fetch sensors. Please try again.")
      }
    }

    const headers = getAuthHeaders()
    const ticketUrl = `${getTicketApiBaseUrl()}/sensors/user-sensors`

    try {
      const response = await fetch(ticketUrl, {
        headers,
      })

      let payload = null
      try {
        const text = await response.text()
        payload = text ? JSON.parse(text) : null
      } catch (parseError) {
        throw new Error(`Invalid JSON response from server: ${parseError.message}`)
      }

      if (response.ok) {
        // Handle both array response and object with data property
        let sensors = []
        if (Array.isArray(payload)) {
          sensors = payload
        } else if (Array.isArray(payload?.data)) {
          sensors = payload.data
        } else if (payload?.data && typeof payload.data === 'object') {
          // Sometimes data might be an object, try to extract array from it
          sensors = Object.values(payload.data).filter(Array.isArray).flat() || []
        }

        if (sensors.length === 0) {
          return []
        }

        const transformedSensors = sensors.map((sensor) => ({
          sensor_id: sensor.sensor_id || sensor.device_id || sensor.identifier,
          device_id: sensor.device_id || sensor.sensor_id,
          location: sensor.location || {},
          is_active: sensor.is_active !== false,
          client_name: sensor.client_name || "",
          site_name: sensor.site_name || sensor.name || "",
          remark: sensor.remark || null,
          remark_date: sensor.remark_date || sensor.remarkDate || null,
          installation_date: sensor.installation_date || sensor.installationDate || null,
          spoc_name: sensor.spoc_name || sensor.spocName || "",
          spoc_contact: sensor.spoc_contact || sensor.spocContact || "",
          last_reading: sensor.last_reading || sensor.current_reading || null,
        }))

        return transformedSensors
      } else {
        const errorMsg = payload?.detail || payload?.message || payload?.error || `Failed to fetch sensors from ticket-backend (${response.status})`
        throw new Error(errorMsg)
      }
    } catch (ticketError) {

      // Fallback to duton-backend for backward compatibility
      const headers = getAuthHeaders()
      const response = await fetch(`${API_BASE_URL}/sensors/user-sensors`, {
        headers,
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || payload?.detail || "Unable to fetch sensor data.")
      }

      return Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.data?.sensors)
          ? payload.data.sensors
          : []
    }
  } catch (error) {
    // Handle credential errors for admin and assignee users gracefully
    if (error.message?.includes("credential") || error.message?.includes("validate") || error.message?.includes("Could not validate")) {
      const userType = typeof window !== "undefined" ? window.localStorage.getItem("duton_user_type") : null
      if (userType === "admin" || userType === "assignee") {
        try {
          const headers = getAuthHeaders()
          // Use /api/admin/sensors for admin, /api/sensors for assignee
          const fallbackUrl = userType === "admin"
            ? `${getTicketApiBaseUrl()}/admin/sensors`
            : `${getTicketApiBaseUrl()}/sensors`
          const response = await fetch(fallbackUrl, {
            headers,
          })
          const payload = await response.json().catch(() => null)

          if (response.ok) {
            const sensors = Array.isArray(payload)
              ? payload
              : (Array.isArray(payload?.data) ? payload.data : [])

            return sensors.map((sensor) => ({
              sensor_id: sensor.sensor_id || sensor.device_id || sensor.identifier,
              device_id: sensor.device_id || sensor.sensor_id,
              location: sensor.location || {},
              is_active: sensor.is_active !== false,
              client_name: sensor.client_name || "",
              site_name: sensor.site_name || sensor.name || "",
            }))
          }
        } catch (fallbackError) {
        }
      }
    }
    throw error
  }
}

export const fetchLatestReading = async (sensorIdentifier) => {
  if (!sensorIdentifier) return null

  try {
    const headers = getAuthHeaders()
    const baseUrl = TICKET_API_BASE_URL
    const response = await fetch(
      `${baseUrl}/sensors/latest/${encodeURIComponent(sensorIdentifier)}`,
      { headers }
    )

    const payload = await response.json().catch(() => null)

    // Handle credential errors for admin and assignee users gracefully
    if ((response.status === 401 || response.status === 403) && (payload?.detail?.includes("credential") || payload?.detail?.includes("validate"))) {
      const userType = typeof window !== "undefined" ? window.localStorage.getItem("duton_user_type") : null
      if (userType === "admin" || userType === "assignee") {
        return null
      }
    }

    if (!response.ok) {
      const message = payload?.detail || payload?.message || "Failed to fetch latest reading."
      throw new Error(message)
    }

    // Return raw API data with original field names
    const rawData = payload?.data || payload || null
    if (!rawData) return null

    return {
      pm2_5: rawData.pm2_5 ?? rawData.pms_2_5 ?? null,
      pm10_0: rawData.pm10_0 ?? rawData.pms_10 ?? null,
      temperature: rawData.ambient_temperature ?? rawData.temperature ?? null,
      humidity: rawData.relative_humidity ?? rawData.humidity ?? null,
      timestamp: rawData.timestamp ?? null,
    }
  } catch (error) {
    // Handle credential errors for admin and assignee users gracefully
    if (error.message?.includes("credential") || error.message?.includes("validate") || error.message?.includes("Could not validate")) {
      const userType = typeof window !== "undefined" ? window.localStorage.getItem("duton_user_type") : null
      if (userType === "admin" || userType === "assignee") {
        return null
      }
    }
    throw error
  }
}

export const fetchAllLatestReadings = async (sensorIds = null) => {
  try {
    const headers = getAuthHeaders()
    const baseUrl = TICKET_API_BASE_URL

    let url = `${baseUrl}/sensors/latest-all`
    if (sensorIds && sensorIds.length > 0) {
      url += `?sensor_ids=${sensorIds.join(',')}`
    }

    const response = await fetch(url, { headers })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const message = payload?.detail || payload?.message || "Failed to fetch latest readings."
      throw new Error(message)
    }

    return payload?.data || {}
  } catch (error) {
    console.error("[fetchAllLatestReadings] Error:", error.message)
    return {}
  }
}

// Chart/Trend Data API
const normalizeDatasetKey = (label = "") => {
  const lower = label.toLowerCase()
  if (lower.includes("2.5") || lower.includes("pm2")) return "pm25"
  if (lower.includes("10") || lower.includes("pm10")) return "pm10"
  if (lower.includes("temp")) return "temperature"
  if (lower.includes("humid")) return "humidity"
  return null
}

export const fetchChartData = async (sensorIdentifier, timeRange = "1m", dataType = "all") => {
  if (!sensorIdentifier) return []

  try {
    // Use ticket-backend API endpoint for ALL users (admin, assignee, and regular users)
    // Endpoint: GET /api/sensors/chart-data/:sensor_id?time_range=1m&data_type=all
    // Backend will fetch from FloroSense historical API
    const headers = getAuthHeaders()
    const baseUrl = TICKET_API_BASE_URL

    const response = await fetch(
      `${baseUrl}/sensors/chart-data/${encodeURIComponent(
        sensorIdentifier
      )}?time_range=${timeRange}&data_type=${dataType}`,
      { headers }
    )

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const errorMsg = payload?.detail || payload?.message || `Failed to fetch chart data (${response.status})`
      // Handle access denied errors gracefully (for assignees accessing sensors they don't have access to)
      if (response.status === 403 && errorMsg.includes("Access denied")) {
        return []
      }
      // Handle credential errors gracefully
      if ((response.status === 401 || response.status === 403) &&
        (errorMsg.includes("credential") || errorMsg.includes("validate") || errorMsg.includes("Could not validate"))) {
        return []
      }
      throw new Error(errorMsg)
    }

    if (!payload?.success) {
      return []
    }

    const chartData = payload?.data || {}

    if (!chartData?.labels?.length) {
      return []
    }

    // Transform to format expected by PMTrendAnalysis
    const datasetMap = {}
    chartData.datasets?.forEach((dataset) => {
      const key = normalizeDatasetKey(dataset.label || "")
      if (!key) return
      datasetMap[key] = dataset.data || []
    })

    // Check if calibration exists for this sensor and is not default
    let shouldApplyCalibration = false
    if (sensorIdentifier) {
      try {
        const calibration = await fetchSensorCalibration(sensorIdentifier)

        // Check if calibration is set (not default values)
        // Default: k0=0, k1=1, variationMin=0, variationMax=0
        if (calibration) {
          const isPm25Calibrated = calibration.pm25 && (
            calibration.pm25.k0 !== 0 ||
            calibration.pm25.k1 !== 1 ||
            calibration.pm25.variationMin !== 0 ||
            calibration.pm25.variationMax !== 0
          )
          const isPm10Calibrated = calibration.pm10 && (
            calibration.pm10.k0 !== 0 ||
            calibration.pm10.k1 !== 1 ||
            calibration.pm10.variationMin !== 0 ||
            calibration.pm10.variationMax !== 0
          )
          shouldApplyCalibration = isPm25Calibrated || isPm10Calibrated
        }
      } catch (error) {
        // If calibration fetch fails (404 or error), no calibration exists - use raw data
        // This is expected behavior, so we don't log it as a warning
        shouldApplyCalibration = false
      }
    }

    // Apply calibration only if it exists and is not default
    const { applyCalibration } = await import("@/utils/calibration")

    return chartData.labels.map((label, index) => {
      const rawPm25 = datasetMap.pm25?.[index] ?? null
      const rawPm10 = datasetMap.pm10?.[index] ?? null

      return {
        time: label,
        timestamp: chartData.timestamps?.[index] || label,
        pm25: shouldApplyCalibration && rawPm25 !== null
          ? applyCalibration(rawPm25, "pm25", sensorIdentifier)
          : rawPm25,
        pm10: shouldApplyCalibration && rawPm10 !== null
          ? applyCalibration(rawPm10, "pm10", sensorIdentifier)
          : rawPm10,
        temperature: datasetMap.temperature?.[index] ?? null,
        humidity: datasetMap.humidity?.[index] ?? null,
      }
    })
  } catch (error) {
    // Handle access denied errors gracefully
    if (error.message?.includes("Access denied")) {
      return []
    }
    // Handle credential errors gracefully
    if (error.message?.includes("credential") || error.message?.includes("validate") || error.message?.includes("Could not validate")) {
      return []
    }
    // Handle network errors
    if (error.message?.includes("Failed to fetch") || error.name === "TypeError") {
      return []
    }
    // Return empty array instead of throwing to prevent UI crashes
    return []
  }
}

export const fetchFlorosenseHistorical = async (sensorIdentifier, startDate, endDate, limit = 1000) => {
  if (!sensorIdentifier) return []

  try {
    const headers = getAuthHeaders()
    const baseUrl = TICKET_API_BASE_URL
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      limit: String(limit),
    })

    const response = await fetch(
      `${baseUrl}/sensors/florosense-historical/${encodeURIComponent(sensorIdentifier)}?${params.toString()}`,
      { headers }
    )

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      console.error("[fetchFlorosenseHistorical] Error:", payload?.detail || response.status)
      return []
    }

    const readings = payload?.data || payload?.readings || payload || []
    if (!Array.isArray(readings)) return []

    return readings.map((reading) => {
      const rawPm25 = reading.pm2_5 ?? reading.pms_2_5 ?? null
      const rawPm10 = reading.pm10_0 ?? reading.pms_10 ?? null
      return {
        time: reading.timestamp || reading.time || reading.date,
        timestamp: reading.timestamp || reading.time || reading.date,
        pm25: rawPm25 !== null ? Math.round(rawPm25) : null,
        pm10: rawPm10 !== null ? Math.round(rawPm10) : null,
        temperature: reading.ambient_temperature ?? reading.temperature ?? null,
        humidity: reading.relative_humidity ?? reading.humidity ?? null,
      }
    })
  } catch (error) {
    console.error("[fetchFlorosenseHistorical] Error:", error.message)
    return []
  }
}

// Historical Data API
export const fetchHistoricalData = async (sensorIdentifier, startDateTime, endDateTime) => {
  if (!sensorIdentifier || !startDateTime || !endDateTime) return []

  try {
    const headers = getAuthHeaders()
    const baseUrl = TICKET_API_BASE_URL

    const params = new URLSearchParams({
      start_time: startDateTime,
      end_time: endDateTime,
      limit: "10000",
    })

    const response = await fetch(
      `${baseUrl}/sensors/historical/${encodeURIComponent(sensorIdentifier)}?${params.toString()}`,
      { headers }
    )

    const payload = await response.json().catch(() => null)

    // Handle credential errors gracefully for all users
    if ((response.status === 401 || response.status === 403) && (payload?.detail?.includes("credential") || payload?.detail?.includes("validate") || payload?.detail?.includes("Could not validate"))) {
      const userType = typeof window !== "undefined" ? window.localStorage.getItem("duton_user_type") : null
      return []
    }

    if (!response.ok) {
      throw new Error(payload?.detail || payload?.message || "Failed to fetch historical data.")
    }

    if (!payload?.success) {
      return []
    }

    const readings = payload?.data?.readings || []

    if (Array.isArray(readings)) {
      return readings
    }

    return []
  } catch (error) {
    // Handle credential errors gracefully for all users
    if (error.message?.includes("credential") || error.message?.includes("validate") || error.message?.includes("Could not validate")) {
      const userType = typeof window !== "undefined" ? window.localStorage.getItem("duton_user_type") : null
      return []
    }
    throw error
  }
}

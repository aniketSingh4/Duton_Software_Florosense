// API Base URL from environment variable (must be set in .env.local)
// This keeps the API URL private and not exposed in source code
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL

if (!API_BASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_BACKEND_URL is not set in environment variables. " +
    "Please create a .env.local file in duton-frontend/ with: NEXT_PUBLIC_BACKEND_URL=https://your-api-url.com/api"
  )
}

// Ticket backend URL - same logic as login-form.jsx
const getTicketApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_TICKET_API_URL && process.env.NEXT_PUBLIC_TICKET_API_URL.trim().length > 0) {
    return process.env.NEXT_PUBLIC_TICKET_API_URL
  }
  // If ticket API URL is not configured, fallback to primary backend URL.
  // This avoids accidental localhost fallbacks in production builds.
  if (process.env.NEXT_PUBLIC_BACKEND_URL && process.env.NEXT_PUBLIC_BACKEND_URL.trim().length > 0) {
    return process.env.NEXT_PUBLIC_BACKEND_URL
  }
  // Default to localhost:8001 for development
  if (typeof window !== "undefined") {
    // If running in browser, use the same protocol and hostname pattern
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    if (isLocalhost) {
      return `http://${window.location.hostname}:8001/api`
    }
  }
  return "http://localhost:8001/api"
}

const TICKET_API_BASE_URL = getTicketApiBaseUrl()

const getAuthToken = () => {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem("duton_access_token")
}

const getAuthHeaders = () => {
  const token = getAuthToken()
  if (!token) {
    throw new Error("Authentication token missing. Please log in again.")
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

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

// Forgot Password API
export const forgotPassword = async (email) => {
  if (!email) {
    throw new Error("Email is required")
  }

  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: email.trim() }),
  })

  let payload = null
  const contentType = response.headers.get("content-type") || ""

  try {
    if (contentType.includes("application/json")) {
      payload = await response.json()
    } else {
      const text = await response.text()
      throw new Error(text || "Unexpected response from server.")
    }
  } catch (parseError) {
    if (!payload) {
      throw new Error("Invalid server response. Please check if the backend is running.")
    }
    throw parseError
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || payload?.detail || "Failed to send OTP")
  }

  return payload
}

// Verify OTP API
export const verifyOTP = async (email, otp) => {
  if (!email || !otp) {
    throw new Error("Email and OTP are required")
  }

  const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
  })

  let payload = null
  const contentType = response.headers.get("content-type") || ""

  try {
    if (contentType.includes("application/json")) {
      payload = await response.json()
    } else {
      const text = await response.text()
      throw new Error(text || "Unexpected response from server.")
    }
  } catch (parseError) {
    if (!payload) {
      throw new Error("Invalid server response. Please check if the backend is running.")
    }
    throw parseError
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || payload?.detail || "Invalid or expired OTP")
  }

  return payload
}

// Reset Password API
export const resetPassword = async (email, otp, newPassword) => {
  if (!email || !otp || !newPassword) {
    throw new Error("Email, OTP, and new password are required")
  }

  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email.trim(),
      otp: otp.trim(),
      new_password: newPassword,
    }),
  })

  let payload = null
  const contentType = response.headers.get("content-type") || ""

  try {
    if (contentType.includes("application/json")) {
      payload = await response.json()
    } else {
      const text = await response.text()
      throw new Error(text || "Unexpected response from server.")
    }
  } catch (parseError) {
    if (!payload) {
      throw new Error("Invalid server response. Please check if the backend is running.")
    }
    throw parseError
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || payload?.detail || "Failed to reset password")
  }

  return payload
}

export const loginApi = `${API_BASE_URL}/auth/login`

// Support Ticket Helpers
const normalizeTicket = (ticket) => {
  // Handle both old format (single image) and new format (array of images)
  let images = []
  if (ticket?.images && Array.isArray(ticket.images)) {
    images = ticket.images.map(img => ({
      data: img.data || img.image_data,
      contentType: img.content_type || img.contentType || "image/jpeg"
    }))
  } else if (ticket?.image_data) {
    // Old format: single image
    images = [{
      data: ticket.image_data,
      contentType: ticket.image_content_type || ticket.imageContentType || "image/jpeg"
    }]
  }

  return {
    id: ticket?.id,
    sensorId: ticket?.sensor_id || ticket?.sensorId || "",
    sensorName: ticket?.sensor_name || ticket?.sensorName || "",
    issueType: ticket?.issue_type || ticket?.issueType || "",
    description: ticket?.description || "",
    priority: ticket?.priority || "Medium",
    status: ticket?.status || "Open",
    assignee: ticket?.assignee || "",
    pendingAssignee: ticket?.pending_assignee || "",
    createdBy: ticket?.created_by || ticket?.createdBy || "",
    fullName: ticket?.full_name || ticket?.fullName || "",
    location: ticket?.location || "",
    raisedBy: ticket?.raised_by || ticket?.raisedBy || "",
    workPercentage: ticket?.work_percentage || ticket?.workPercentage || null,
    images: images,
    // Keep old fields for backward compatibility
    imageData: images.length > 0 ? images[0].data : null,
    imageContentType: images.length > 0 ? images[0].contentType : null,
    imageUrl: ticket?.image_url || ticket?.imageUrl || null,
    createdAt: ticket?.created_at || ticket?.createdAt || "",
    updatedAt: ticket?.updated_at || ticket?.updatedAt || "",
    closedAt: ticket?.closed_at || ticket?.closedAt || null,
    closedBy: ticket?.closed_by || ticket?.closedBy || "",
    replies: Array.isArray(ticket?.replies)
      ? ticket.replies.map((reply) => ({
        id: reply?.id,
        ticketId: reply?.ticket_id || reply?.ticketId,
        author: reply?.author || "User",
        message: reply?.message || "",
        timestamp: reply?.created_at || reply?.createdAt || "",
      }))
      : [],
  }
}

const toSnakePayload = (payload) => {
  const mapped = {}
  if (payload.sensorId !== undefined) mapped.sensor_id = payload.sensorId || null
  if (payload.sensorName !== undefined) mapped.sensor_name = payload.sensorName || null
  if (payload.issueType !== undefined) mapped.issue_type = payload.issueType
  if (payload.description !== undefined) mapped.description = payload.description
  if (payload.priority !== undefined) mapped.priority = payload.priority
  if (payload.status !== undefined) mapped.status = payload.status
  if (payload.assignee !== undefined) mapped.assignee = payload.assignee
  if (payload.createdBy !== undefined) mapped.created_by = payload.createdBy
  if (payload.fullName !== undefined) mapped.full_name = payload.fullName || null
  if (payload.location !== undefined) mapped.location = payload.location || null
  if (payload.raisedBy !== undefined) mapped.raised_by = payload.raisedBy || null
  if (payload.closedBy !== undefined) mapped.closed_by = payload.closedBy || null
  if (payload.workPercentage !== undefined) mapped.work_percentage = payload.workPercentage !== null && payload.workPercentage !== undefined ? Number(payload.workPercentage) : null
  return mapped;
}

export const fetchSupportTickets = async (filters = {}) => {
  const headers = getAuthHeaders()
  const params = new URLSearchParams()
  if (filters.status) params.append("status", filters.status)
  if (filters.priority) params.append("priority", filters.priority)
  if (filters.sensorId) params.append("sensor_id", filters.sensorId)
  if (filters.search) params.append("search", filters.search)

  const url = `${TICKET_API_BASE_URL}/tickets${params.toString() ? `?${params.toString()}` : ""}`
  const response = await fetch(url, { headers })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.detail || payload?.message || "Failed to fetch tickets.")
  }

  return Array.isArray(payload) ? payload.map(normalizeTicket) : []
}

export const createSupportTicket = async (payload) => {
  const token = getAuthToken()
  if (!token) {
    throw new Error("Authentication token missing. Please log in again.")
  }

  let response
  if (payload.image instanceof File) {
    const formData = new FormData()
    const ticketData = toSnakePayload(payload)

    Object.keys(ticketData).forEach((key) => {
      if (key !== 'image' && ticketData[key] !== null && ticketData[key] !== undefined) {
        formData.append(key, String(ticketData[key]))
      }
    })

    formData.append('image', payload.image)

    response = await fetch(`${TICKET_API_BASE_URL}/tickets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
  } else {
    const headers = getAuthHeaders()
    response = await fetch(`${TICKET_API_BASE_URL}/tickets`, {
      method: "POST",
      headers,
      body: JSON.stringify(toSnakePayload(payload)),
    })
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || "Failed to create ticket.")
  }
  return normalizeTicket(data)
}

export const updateSupportTicket = async (ticketId, payload) => {
  const token = getAuthToken()
  if (!token) {
    throw new Error("Authentication token missing. Please log in again.")
  }

  let response
  // Handle multiple images (array of Files)
  if (payload.images && Array.isArray(payload.images) && payload.images.length > 0) {
    const formData = new FormData()
    const ticketData = toSnakePayload(payload)
    Object.keys(ticketData).forEach((key) => {
      if (key !== 'images' && key !== 'image' && ticketData[key] !== null && ticketData[key] !== undefined) {
        formData.append(key, String(ticketData[key]))
      }
    })

    // Append all images
    payload.images.forEach((file) => {
      if (file instanceof File) {
        formData.append('images', file)
      }
    })

    response = await fetch(`${TICKET_API_BASE_URL}/tickets/${ticketId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
  } else if (payload.image instanceof File) {
    // Backward compatibility: single image
    const formData = new FormData()
    const ticketData = toSnakePayload(payload)

    Object.keys(ticketData).forEach((key) => {
      if (key !== 'image' && ticketData[key] !== null && ticketData[key] !== undefined) {
        formData.append(key, String(ticketData[key]))
      }
    })

    formData.append('images', payload.image)

    response = await fetch(`${TICKET_API_BASE_URL}/tickets/${ticketId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
  } else {
    const headers = getAuthHeaders() // Use ticket token for ticket APIs
    response = await fetch(`${TICKET_API_BASE_URL}/tickets/${ticketId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(toSnakePayload(payload)),
    })
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || "Failed to update ticket.")
  }
  return normalizeTicket(data)
}

// Fetch all assignees (admin only)
export const fetchAssignees = async () => {
  try {
    const headers = getAuthHeaders()
    const response = await fetch(`${TICKET_API_BASE_URL}/assignee/list`, {
      method: "GET",
      headers,
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.detail || payload?.message || `Failed to fetch assignees (Status: ${response.status})`)
    }

    const data = await response.json()

    if (!Array.isArray(data)) {
      return []
    }

    return data
  } catch (error) {
    throw error
  }
}

export const createAssignee = async ({ full_name, email, username, password, send_credentials_email }) => {
  const headers = getAuthHeaders()
  const response = await fetch(`${TICKET_API_BASE_URL}/assignee/create`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      full_name,
      email,
      username,
      password,
      send_credentials_email: Boolean(send_credentials_email),
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.message || "Failed to create assignee")
  }

  return payload
}

// Fetch assignee performance stats
export const fetchAssigneePerformance = async (assigneeUsername, timePeriod = "month") => {
  try {
    const headers = getAuthHeaders()
    const url = `${TICKET_API_BASE_URL}/assignee/performance/${encodeURIComponent(assigneeUsername)}?time_period=${timePeriod}`

    const response = await fetch(url, {
      method: "GET",
      headers,
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.detail || payload?.message || `Failed to fetch assignee performance (Status: ${response.status})`)
    }

    const data = await response.json()

    if (data?.success && data?.data) {
      return data.data
    }

    return data
  } catch (error) {
    throw error
  }
}

export const addSupportTicketReply = async (ticketId, payload) => {
  const headers = getAuthHeaders() // Use ticket token for ticket APIs
  const response = await fetch(`${TICKET_API_BASE_URL}/tickets/${ticketId}/replies`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      author: payload.author,
      message: payload.message,
    }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || "Failed to add reply.")
  }
  return {
    id: data?.id,
    ticketId: data?.ticket_id || data?.ticketId,
    sensorId: data?.sensor_id || "",
    author: data?.author || "User",
    message: data?.message || "",
    timestamp: data?.created_at || data?.createdAt || "",
  }
}

// Update sensor remark (admin and assignee only)
export const updateSensorRemark = async (sensorId, remark, remarkDate) => {
  try {
    // Use ticket-backend for admin and assignee users
    // Use PUT /api/sensors/:sensor_id/remark endpoint
    const headers = getAuthHeaders()
    const baseUrl = TICKET_API_BASE_URL

    const response = await fetch(`${baseUrl}/sensors/${encodeURIComponent(sensorId)}/remark`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        remark: remark || null,
        remark_date: remarkDate || null,
      }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || payload?.detail || "Failed to update sensor remark")
    }

    return payload.data
  } catch (error) {
    console.error("[updateSensorRemark] Error:", error)
    throw error
  }
}

export const deleteSupportTicket = async (ticketId) => {
  const headers = getAuthHeaders() // Use ticket token for ticket APIs
  const response = await fetch(`${TICKET_API_BASE_URL}/tickets/${ticketId}`, {
    method: "DELETE",
    headers,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || "Failed to delete ticket.")
  }
  return data
}

export const fetchSensorCalibration = async (sensorId) => {
  if (!sensorId) {
    throw new Error("Sensor ID is required")
  }

  try {
    // Use backend API for calibration
    const baseUrl = typeof window !== "undefined" ? "/calibration-proxy" : (process.env.NEXT_PUBLIC_CALIBRATION_URL || TICKET_API_BASE_URL)
    let headers = getAuthHeaders()

    if (baseUrl === "/calibration-proxy" || process.env.NEXT_PUBLIC_CALIBRATION_URL) {
      headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-API-Key": process.env.NEXT_PUBLIC_FLOROSENSE_API_KEY || ""
      }
    }

    const response = await fetch(
      `${baseUrl}/admin/calibration/sensors/${encodeURIComponent(sensorId)}`,
      {
        method: "GET",
        headers: headers,
      }
    )

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Failed to fetch sensor calibration" }))
      throw new Error(errorData?.detail || errorData?.message || "Failed to fetch sensor calibration")
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

export const saveSensorCalibration = async (sensorId, calibration) => {
  if (!sensorId) {
    throw new Error("Sensor ID is required")
  }

  if (!calibration || typeof calibration !== "object") {
    throw new Error("Calibration data is required")
  }

  try {
    // Use backend API for calibration
    const baseUrl = typeof window !== "undefined" ? "/calibration-proxy" : (process.env.NEXT_PUBLIC_CALIBRATION_URL || TICKET_API_BASE_URL)
    let headers = getAuthHeaders()

    if (baseUrl === "/calibration-proxy" || process.env.NEXT_PUBLIC_CALIBRATION_URL) {
      headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-API-Key": process.env.NEXT_PUBLIC_FLOROSENSE_API_KEY || ""
      }
    }

    const apiUrl = `${baseUrl}/admin/calibration/sensors/${encodeURIComponent(sensorId)}`

    // Check if calibration exists to determine POST vs PUT
    let calibrationExists = false
    try {
      const existingResponse = await fetch(apiUrl, {
        method: "GET",
        headers: headers,
      })
      calibrationExists = existingResponse.ok
    } catch (e) {
      // Silent fail - will try PUT first, then POST if needed
    }

    const method = calibrationExists ? "PUT" : "POST"
    const response = await fetch(apiUrl, {
      method: method,
      headers: headers,
      body: JSON.stringify(calibration),
    })

    if (!response.ok) {
      if (method === "PUT" && response.status === 404) {
        // Try POST if PUT returned 404
        const createResponse = await fetch(apiUrl, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(calibration),
        })

        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => ({ detail: "Failed to save sensor calibration" }))
          throw new Error(errorData?.detail || errorData?.message || `Failed to save sensor calibration: ${createResponse.status} ${createResponse.statusText}`)
        }

        return await createResponse.json()
      }

      const errorData = await response.json().catch(() => ({ detail: "Failed to save sensor calibration" }))
      throw new Error(errorData?.detail || errorData?.message || `Failed to save sensor calibration: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

// Document Management API (using ticket-backend)
export const uploadSensorDocument = async (sensorId, file, documentType = "") => {
  try {
    const headers = getAuthHeaders()
    delete headers["Content-Type"]

    const formData = new FormData()
    formData.append("file", file)
    if (documentType) {
      formData.append("document_type", documentType)
    }

    const response = await fetch(
      `${TICKET_API_BASE_URL}/sensors/${encodeURIComponent(sensorId)}/documents`,
      {
        method: "POST",
        headers: {
          Authorization: headers.Authorization,
        },
        body: formData,
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to upload document")
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error("[uploadSensorDocument] Error:", error)
    throw error
  }
}

export const getSensorDocuments = async (sensorId) => {
  try {
    const headers = getAuthHeaders()
    const response = await fetch(
      `${TICKET_API_BASE_URL}/sensors/${encodeURIComponent(sensorId)}/documents`,
      { headers }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to fetch documents")
    }

    const data = await response.json()
    return data.data?.documents || []
  } catch (error) {
    console.error("[getSensorDocuments] Error:", error)
    throw error
  }
}

export const downloadSensorDocument = async (sensorId, documentId, filename) => {
  try {
    const headers = getAuthHeaders()
    const response = await fetch(
      `${TICKET_API_BASE_URL}/sensors/${encodeURIComponent(sensorId)}/documents/${encodeURIComponent(documentId)}`,
      { headers }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to download document")
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename || "document"
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  } catch (error) {
    console.error("[downloadSensorDocument] Error:", error)
    throw error
  }
}

export const deleteSensorDocument = async (sensorId, documentId) => {
  try {
    const headers = getAuthHeaders()
    const response = await fetch(
      `${TICKET_API_BASE_URL}/sensors/${encodeURIComponent(sensorId)}/documents/${encodeURIComponent(documentId)}`,
      {
        method: "DELETE",
        headers,
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to delete document")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("[deleteSensorDocument] Error:", error)
    throw error
  }
}

export const deleteSensor = async (sensorId) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const headers = getAuthHeaders()
    const response = await fetch(
      `${TICKET_API_BASE_URL}/admin/sensors/${encodeURIComponent(sensorId)}`,
      {
        method: "DELETE",
        headers,
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to delete sensor")
    }

    const data = await response.json()
    return data
  } catch (error) {
    throw error
  }
}

export const updateSensor = async (sensorId, updateData) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const headers = getAuthHeaders()
    const response = await fetch(
      `${TICKET_API_BASE_URL}/admin/sensors/${encodeURIComponent(sensorId)}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify(updateData),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to update sensor")
    }

    const data = await response.json()
    return data
  } catch (error) {
    throw error
  }
}

// Get users by role (Admin only)
export const getUsersByRole = async (role) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sensors/users-by-role/${role}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to get users by role")
    }

    const data = await response.json()
    return data.data?.users || []
  } catch (error) {
    console.error("[getUsersByRole] Error:", error)
    throw error
  }
}

// Get users assigned to a sensor
export const getUsersForSensor = async (sensorId) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sensors/${encodeURIComponent(sensorId)}/assignments`, {
      method: "GET",
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to get assigned users")
    }

    const data = await response.json()
    return data.data?.users || []
  } catch (error) {
    console.error("[getUsersForSensor] Error:", error)
    throw error
  }
}

// Unassign sensor from user
export const unassignSensorFromUser = async (sensorId, username) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sensors/${encodeURIComponent(sensorId)}/assign/${encodeURIComponent(username)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to unassign sensor")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("[unassignSensorFromUser] Error:", error)
    throw error
  }
}

// Assign sensor to user (Admin only)
export const assignSensorToUser = async (sensorId, username) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sensors/${encodeURIComponent(sensorId)}/assign`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to assign sensor")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("[assignSensorToUser] Error:", error)
    throw error
  }
}

// Generate share access link (magic link) for sensor (Admin only)
export const generateShareAccessLink = async (sensorId, email, durationHours = 24, permissions = ["view"]) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sensors/${sensorId}/share-access`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, duration_hours: durationHours, permissions }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to generate share link")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("[generateShareAccessLink] Error:", error)
    throw error
  }
}

// Validate magic link (Public - no auth required)
export const validateMagicLink = async (token, sensorId) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sensors/validate-magic-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, sensor_id: sensorId }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to validate magic link")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("[validateMagicLink] Error:", error)
    throw error
  }
}

// Get sensor information by sensor_id (same API used by normal users)
// Uses GET /api/sensors/info/:sensor_id from Postman collection
export const getSensorInfo = async (sensorId) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const headers = getAuthHeaders()

    const response = await fetch(`${TICKET_API_BASE_URL}/sensors/info/${encodeURIComponent(sensorId)}`, {
      method: "GET",
      headers: headers,
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || errorData.message || "Access denied to this sensor")
      }

      if (response.status === 404) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || errorData.message || "Sensor not found")
      }

      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to get sensor information")
    }

    const data = await response.json()
    // Backend returns { success: true, data: { sensor_info: {...} } }
    // Return the full data object so monitoring dashboard can extract sensor_info
    if (data.data?.sensor_info) {
      return { sensor_info: data.data.sensor_info }
    }
    // Fallback: return data as-is if structure is different
    return data.data || data
  } catch (error) {
    if (error.message?.includes("Failed to fetch") || error.name === "TypeError") {
      throw new Error(`Cannot connect to ticket-backend server. Please ensure the server is running.`)
    }
    throw error
  }
}

// Get share access tokens for a sensor (Admin only)
export const getShareAccessTokens = async (sensorId) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()

    // Check if we have auth token
    const token = typeof window !== "undefined" ? window.localStorage.getItem("duton_access_token") : null
    if (!token) {
      return [] // Return empty array instead of throwing
    }

    const response = await fetch(`${TICKET_API_BASE_URL}/sensors/${sensorId}/share-access`, {
      method: "GET",
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      // If 401/403, user might not have permission - return empty array
      if (response.status === 401 || response.status === 403) {
        return []
      }

      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to get share access tokens")
    }

    const data = await response.json()
    return data.data?.tokens || []
  } catch (error) {
    // Handle network errors gracefully
    if (error.message?.includes("Failed to fetch") || error.name === "TypeError") {
      return [] // Return empty array instead of throwing
    }

    console.error("[getShareAccessTokens] Error:", error)
    return [] // Return empty array on any error to prevent UI breakage
  }
}

// Revoke share access token (Admin only)
export const revokeShareAccessToken = async (sensorId, tokenId) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sensors/${sensorId}/share-access/${tokenId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to revoke share access token")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("[revokeShareAccessToken] Error:", error)
    throw error
  }
}

// =============================================================================
// SITE MANAGEMENT APIs
// =============================================================================

// Get all sites (Admin only)
export const getAllSites = async () => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sites`, {
      method: "GET",
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to get sites")
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error("[getAllSites] Error:", error)
    throw error
  }
}

// Get site by ID
export const getSiteById = async (siteId) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sites/${encodeURIComponent(siteId)}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to get site")
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error("[getSiteById] Error:", error)
    throw error
  }
}

// Create site (Admin only)
export const createSite = async (siteData) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sites`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(siteData),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to create site")
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error("[createSite] Error:", error)
    throw error
  }
}

// Update site (Admin only)
export const updateSite = async (siteId, updates) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sites/${encodeURIComponent(siteId)}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to update site")
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error("[updateSite] Error:", error)
    throw error
  }
}

// Delete site (Admin only)
export const deleteSite = async (siteId) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sites/${encodeURIComponent(siteId)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to delete site")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("[deleteSite] Error:", error)
    throw error
  }
}

// Get sites assigned to user
export const getUserSites = async (username) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sites/user/${encodeURIComponent(username)}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to get user sites")
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error("[getUserSites] Error:", error)
    throw error
  }
}

// Assign sites to user (Admin only)
export const assignSitesToUser = async (username, siteIds) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sites/assign/${encodeURIComponent(username)}`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ site_ids: siteIds }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to assign sites")
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error("[assignSitesToUser] Error:", error)
    throw error
  }
}

// Remove site assignment from user (Admin only)
export const removeSiteFromUser = async (username, siteId) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sites/assign/${encodeURIComponent(username)}/${encodeURIComponent(siteId)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to remove site assignment")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("[removeSiteFromUser] Error:", error)
    throw error
  }
}

// Get sensors for a site
export const getSiteSensors = async (siteId) => {
  try {
    const TICKET_API_BASE_URL = getTicketApiBaseUrl()
    const response = await fetch(`${TICKET_API_BASE_URL}/sites/${encodeURIComponent(siteId)}/sensors`, {
      method: "GET",
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to get site sensors")
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error("[getSiteSensors] Error:", error)
    throw error
  }
}

// Get sensor anomalies (sensors reporting the same reading for the last 24 hours)
export const fetchSensorAnomalies = async () => {
  try {
    const headers = getAuthHeaders()
    const ticketUrl = `${getTicketApiBaseUrl()}/sensors/anomalies`
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
      return payload.data?.anomalies || []
    } else {
      const errorMsg = payload?.detail || payload?.message || payload?.error || `Failed to fetch anomalies (${response.status})`
      throw new Error(errorMsg)
    }
  } catch (error) {
    console.error("[fetchSensorAnomalies] Error:", error)
    throw error
  }
}

// =============================================================================
// AMC / Warranty tracking API
// =============================================================================

const amcRequest = async (path, { method = "GET", body, label = "amc" } = {}) => {
  try {
    const response = await fetch(`${getTicketApiBaseUrl()}/amc${path}`, {
      method,
      headers: getAuthHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.detail || payload.message || `AMC request failed (${response.status})`)
    }
    return payload.data
  } catch (error) {
    console.error(`[${label}] Error:`, error)
    throw error
  }
}

// Admin: clients with AMC flags (paginated, searchable)
export const getAmcClients = async ({ skip = 0, limit = 10, search = "" } = {}) => {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) })
  if (search) params.set("search", search)
  const data = await amcRequest(`/clients?${params}`, { label: "getAmcClients" })
  return {
    clients: data?.clients || [],
    totalCount: data?.total_count ?? 0,
  }
}

// Admin: sensors assigned to a client with AMC status
export const getAmcClientSensors = async (username) =>
  amcRequest(`/clients/${encodeURIComponent(username)}/sensors`, { label: "getAmcClientSensors" })

// Admin: save tracking + dates. sensors: [{ sensor_id, tracked, installation_date, amc_renewal_date }]
export const saveAmcClientSensors = async (username, sensors) =>
  amcRequest(`/clients/${encodeURIComponent(username)}/sensors`, {
    method: "PUT",
    body: { sensors },
    label: "saveAmcClientSensors",
  })

// Admin: toggle OFF for a client (untrack all sensors)
export const disableAmcForClient = async (username) =>
  amcRequest(`/clients/${encodeURIComponent(username)}/disable`, {
    method: "POST",
    label: "disableAmcForClient",
  })

// Client: is the AMC marquee needed for the logged-in user?
export const getMyAmcAlert = async () => amcRequest("/my-alert", { label: "getMyAmcAlert" })

// Admin: expiry monitoring list. type: "warranty" | "amc" | "both"
export const getAmcExpiringList = async (type = "both") =>
  amcRequest(`/expiring?type=${encodeURIComponent(type)}`, { label: "getAmcExpiringList" })

// Admin: audit trail
export const getAmcAuditLogs = async ({ username = "", sensorId = "", skip = 0, limit = 50 } = {}) => {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) })
  if (username) params.set("username", username)
  if (sensorId) params.set("sensor_id", sensorId)
  const data = await amcRequest(`/audit?${params}`, { label: "getAmcAuditLogs" })
  return { logs: data?.logs || [], totalCount: data?.total_count ?? 0 }
}

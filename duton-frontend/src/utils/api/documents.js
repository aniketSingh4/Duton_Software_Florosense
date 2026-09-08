import { API_BASE_URL, getTicketApiBaseUrl, TICKET_API_BASE_URL, getAuthToken, getAuthHeaders } from "./client.js"

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

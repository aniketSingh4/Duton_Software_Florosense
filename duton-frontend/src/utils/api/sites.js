import { API_BASE_URL, getTicketApiBaseUrl, TICKET_API_BASE_URL, getAuthToken, getAuthHeaders } from "./client.js"

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
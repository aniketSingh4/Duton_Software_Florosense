import { API_BASE_URL, getTicketApiBaseUrl, TICKET_API_BASE_URL, getAuthToken, getAuthHeaders } from "./client.js"

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
  return mapped
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

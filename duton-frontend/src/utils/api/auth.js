import { API_BASE_URL, getTicketApiBaseUrl, TICKET_API_BASE_URL, getAuthToken, getAuthHeaders } from "./client.js"

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


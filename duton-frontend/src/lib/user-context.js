const decodeJwtPayload = (token) => {
  if (!token) return null

  try {
    const tokenParts = token.split(".")
    if (tokenParts.length !== 3) return null
    return JSON.parse(atob(tokenParts[1].replace(/-/g, "+").replace(/_/g, "/")))
  } catch (error) {
    return null
  }
}

export const getClientUserContext = () => {
  if (typeof window === "undefined") {
    return {
      username: "",
      role: null,
      isAdmin: false,
      isAssignee: false,
      isBuilder: false,
      isRestricted: false,
    }
  }

  const token = window.localStorage.getItem("duton_access_token")
  const payload = decodeJwtPayload(token)

  const userType = (window.localStorage.getItem("duton_user_type") || "").trim()
  const userRole = (window.localStorage.getItem("duton_user_role") || "").trim()
  const username =
    window.localStorage.getItem("duton_username") ||
    payload?.username ||
    ""

  let role = payload?.role || null
  if (!role) {
    if (userType === "admin" || userType === "assignee") role = userType
    else if (userRole === "builder" || userRole === "contractor") role = userRole
    else if (userType) role = userType
  }

  return {
    username,
    role,
    isAdmin: role === "admin",
    isAssignee: role === "assignee",
    isBuilder: role === "builder" || role === "contractor",
    isRestricted: ["user", "builder", "contractor"].includes(role),
  }
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { ForgotPasswordDialog } from "@/components/auth/forgot-password-dialog"
import { Eye, EyeOff } from "lucide-react"
import { loginApi } from "@/utils/api"

// Ticket backend URL for admin login
// Try to detect the correct URL based on environment
const getTicketApiUrl = () => {
  if (process.env.NEXT_PUBLIC_TICKET_API_URL) {
    return process.env.NEXT_PUBLIC_TICKET_API_URL
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

const TICKET_API_URL = getTicketApiUrl()

export function LoginForm({
  className,
  ...props
}) {
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError("")

    try {
      const trimmedUsername = username.trim()
      const isAdminLogin = trimmedUsername.toLowerCase() === "admin"
      let loginUrl = null
      let userType = null
      let data = null

      // Use the correct endpoints from Postman collection
      if (isAdminLogin) {
        // Admin Login: POST /api/admin/login
        loginUrl = `${TICKET_API_URL}/admin/login`
      } else {
        // Try assignee login first: POST /api/assignee/login
        loginUrl = `${TICKET_API_URL}/assignee/login`
      }

      let response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: trimmedUsername,
          password,
        }),
      })

      let contentType = response.headers.get("content-type") || ""

      try {
        if (contentType.includes("application/json")) {
          data = await response.json()
        } else {
          const text = await response.text()
          throw new Error(text || "Unexpected response from server.")
        }
      } catch (parseError) {
        if (!data) {
          throw new Error("Invalid server response. Please contact support.")
        }
      }

      // If assignee login failed, try regular user login
      if (!response.ok && !isAdminLogin && !data.assignee && !data.token) {
        // Try regular user login: POST /api/users/login
        loginUrl = `${TICKET_API_URL}/users/login`
        response = await fetch(loginUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: trimmedUsername,
            password,
          }),
        })

        contentType = response.headers.get("content-type") || ""

        try {
          if (contentType.includes("application/json")) {
            data = await response.json()
          } else {
            const text = await response.text()
            throw new Error(text || "Unexpected response from server.")
          }
        } catch (parseError) {
          if (!data) {
            throw new Error("Invalid server response. Please contact support.")
          }
        }
      }

      // If user login also failed, try duton-backend
      if (!response.ok && !isAdminLogin && !data.user && !data.assignee && !data.token) {
        // Try duton-backend login
        response = await fetch(loginApi, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: trimmedUsername,
            password,
          }),
        })

        contentType = response.headers.get("content-type") || ""

        try {
          if (contentType.includes("application/json")) {
            data = await response.json()
          } else {
            const text = await response.text()
            throw new Error(text || "Unexpected response from server.")
          }
        } catch (parseError) {
          if (!data) {
            throw new Error("Invalid server response. Please contact support.")
          }
        }

        if (!response.ok) {
          throw new Error(data?.detail || data?.message || "Unable to login. Please try again.")
        }

        // Duton-backend returns: { access_token, refresh_token, token_type, expires_in }
        // Store token first, then fetch user info to get role
        if (typeof window !== "undefined") {
          localStorage.setItem("duton_access_token", data.access_token)
          localStorage.setItem("duton_refresh_token", data.refresh_token)
          localStorage.setItem("duton_token_type", data.token_type ?? "bearer")
          localStorage.setItem("duton_token_expiry", data.expires_in?.toString() ?? "")
          localStorage.setItem("duton_username", trimmedUsername)
        }

        // Fetch user info to get role
        try {
          const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL
          const userInfoResponse = await fetch(`${API_BASE_URL}/auth/me`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${data.access_token}`,
              "Content-Type": "application/json",
            },
          })

          if (userInfoResponse.ok) {
            const userInfoData = await userInfoResponse.json()
            const role = userInfoData?.data?.user?.role || "user"
            
            // Set user type based on role
            if (role === "admin") {
              userType = "admin"
            } else if (role === "assignee") {
              userType = "assignee"
            } else {
              userType = "user"
            }
          } else {
            userType = "user"
          }
        } catch (error) {
          userType = "user"
        }

        // Store user type
        if (typeof window !== "undefined") {
          localStorage.setItem("duton_user_type", userType)
        }
      } else if (!response.ok) {
        throw new Error(data?.detail || data?.message || "Unable to login. Please try again.")
      } else {
        // Success - determine user type from response
        if (isAdminLogin) {
          // Ticket-backend admin returns: { token, admin: {...} }
          userType = "admin"
          if (typeof window !== "undefined") {
            localStorage.setItem("duton_access_token", data.token)
            localStorage.setItem("duton_token_type", "bearer")
            localStorage.setItem("duton_username", trimmedUsername)
            localStorage.setItem("duton_user_type", userType)
          }
        } else if (data.assignee) {
          // Ticket-backend assignee returns: { token, assignee: {...} }
          userType = "assignee"
          if (typeof window !== "undefined") {
            localStorage.setItem("duton_access_token", data.token)
            localStorage.setItem("duton_token_type", "bearer")
            localStorage.setItem("duton_username", trimmedUsername)
            localStorage.setItem("duton_user_type", userType)
          }
        } else if (data.user || (data.token && !isAdminLogin)) {
          // Ticket-backend user returns: { token, user: {...} }
          // Check if user is builder/contractor from user object
          const userRole = data.user?.role || data.role
          if (userRole === "builder" || userRole === "contractor") {
            userType = userRole
          } else {
            userType = "user"
          }
          
          if (typeof window !== "undefined") {
            localStorage.setItem("duton_access_token", data.token)
            localStorage.setItem("duton_token_type", "bearer")
            localStorage.setItem("duton_username", trimmedUsername)
            localStorage.setItem("duton_user_type", userType)
          }
        }
      }

      router.push("/dashboard")
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card className="overflow-hidden p-0">
          <CardContent className="grid p-0 md:grid-cols-2 md:items-stretch">
            <form className="p-6 md:p-8 flex flex-col gap-4" onSubmit={handleSubmit} suppressHydrationWarning>
              <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold">Welcome back</h1>
                  <p className="text-muted-foreground text-balance">
                    Login to your Duton account
                  </p>
                </div>
                <Field>
                  <FieldLabel htmlFor="username">Username</FieldLabel>
                  <Input
                    id="username"
                    type="text"
                    placeholder="admin"
                    required
                    value={username}
                    onChange={(event) => setUsername(event.target.value.replace("@", ""))}
                    disabled={isSubmitting}
                    suppressHydrationWarning
                  />
                </Field>
                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <button
                      type="button"
                      onClick={() => setIsForgotPasswordOpen(true)}
                      className="ml-auto text-sm underline-offset-2 hover:underline text-muted-foreground hover:text-foreground transition-colors"
                      suppressHydrationWarning
                    >
                      Forgot your password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={isSubmitting}
                      suppressHydrationWarning
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-3 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      suppressHydrationWarning
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                {error && (
                  <p className="text-sm text-red-500" role="alert">
                    {error}
                  </p>
                )}
                <Field>
                  <Button type="submit" disabled={isSubmitting} suppressHydrationWarning>
                    {isSubmitting ? "Signing in..." : "Login"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
            <div className="relative hidden md:block overflow-hidden h-full rounded-r-xl bg-white/5 backdrop-blur border-l border-border/40">
              <div className="relative w-full h-full p-8 md:p-12 flex items-center justify-center">
                <Image
                  src="/Duton_Black.png"
                  alt="Duton Logo"
                  fill
                  className="object-contain object-center dark:hidden"
                  sizes="(max-width: 768px) 0vw, 50vw"
                  priority
                />
                <Image
                  src="/Duton_Whiite.png"
                  alt="Duton Logo"
                  fill
                  className="object-contain object-center hidden dark:block"
                  sizes="(max-width: 768px) 0vw, 50vw"
                  priority
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <ForgotPasswordDialog
        open={isForgotPasswordOpen}
        onOpenChange={setIsForgotPasswordOpen}
      />
    </>
  );
}

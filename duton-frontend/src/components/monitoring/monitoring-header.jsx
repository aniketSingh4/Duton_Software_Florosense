"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"

export function MonitoringHeader({ title, spoc, unit }) {
  // Initialize username from localStorage if available
  const [username, setUsername] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("duton_username") || ""
    }
    return ""
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    // Try to get username from API if available
    const fetchUsername = async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL
        const token = window.localStorage.getItem("duton_access_token")
        
        if (token && API_BASE_URL) {
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data?.data?.user?.username) {
              setUsername(data.data.user.username)
              return
            }
          }
        }
      } catch (error) {
        // If API fails, try to get from JWT token
      }

      // Fallback: try to get from JWT token
      try {
        const token = window.localStorage.getItem("duton_access_token")
        if (token) {
          const tokenParts = token.split('.')
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')))
            if (payload.username) {
              setUsername(payload.username)
            }
          }
        }
      } catch (err) {
        // Keep existing username from localStorage
      }
    }

    fetchUsername()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-3xl font-bold">{title}</h1>
        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
          SPOC: {spoc}
        </Badge>
        <Badge variant="outline" className="bg-muted/50">
          {username || "User"} | {unit}
        </Badge>
      </div>
    </div>
  )
}


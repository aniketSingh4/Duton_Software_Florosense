"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, ExternalLink } from "lucide-react"
import { CalibrationSetupDialog } from "@/components/dashboard/calibration-setup-dialog"

export function DiagnosticsSection({ sensorId = "", sensorName = "" }) {
  const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Check if user is admin by checking role from backend or JWT token
  useEffect(() => {
    const checkUserRole = async () => {
      if (typeof window === "undefined") return
      
      let role = null
      
      // First, set immediately from localStorage for faster UI update
      const userType = window.localStorage.getItem("duton_user_type")
      if (userType === "admin") {
        setIsAdmin(true)
      }
      
      // Try to get role from /auth/me endpoint
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
            role = data?.data?.user?.role || null
          }
        }
      } catch (error) {
      }
      
      // If role not found from API, try to decode from JWT token
      if (!role) {
        try {
          const token = window.localStorage.getItem("duton_access_token")
          if (token) {
            const tokenParts = token.split('.')
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')))
              role = payload.role || null
            }
          }
        } catch (error) {
        }
      }
      
      // Fallback to localStorage if still no role
      if (!role) {
        const userType = window.localStorage.getItem("duton_user_type")
        if (userType === "admin") role = "admin"
      }
      
      // Set state based on role - only admin can access calibration
      setIsAdmin(role === "admin")
    }
    
    checkUserRole()
  }, [])

  if (!isAdmin) {
    return null
  }

  return (
    <>
      <Card className="shadow-sm border-border/50 py-4">
        <CardHeader className="pb-2 pt-0 px-4">
          <CardTitle className="text-base font-semibold">Diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <div className="space-y-1.5">
            <button
              onClick={() => setCalibrationDialogOpen(true)}
              className="flex items-center gap-2 text-sm text-primary hover:underline group w-full text-left"
            >
              <Settings className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span>Calibration Setup</span>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </CardContent>
      </Card>

      <CalibrationSetupDialog
        open={calibrationDialogOpen}
        onOpenChange={setCalibrationDialogOpen}
        restrictedSensorId={sensorId}
        restrictedSensorName={sensorName}
      />
    </>
  )
}


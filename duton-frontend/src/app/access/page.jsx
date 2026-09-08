"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { validateMagicLink } from "@/utils/api"
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

function AccessPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState("validating") // validating, success, error
  const [message, setMessage] = useState("")
  const [sensorId, setSensorId] = useState(null)

  useEffect(() => {
    const token = searchParams.get("t")
    const sensor = searchParams.get("s")

    if (!token) {
      setStatus("error")
      setMessage("Invalid access link. Token is missing.")
      return
    }

    if (!sensor) {
      setStatus("error")
      setMessage("Invalid access link. Sensor ID is missing.")
      return
    }

    setSensorId(sensor)

    // Validate token via POST (not GET)
    const validateToken = async () => {
      try {
        const response = await validateMagicLink(token, sensor)
        
        if (response.success && response.data) {
          // Store session token
          if (typeof window !== "undefined") {
            window.localStorage.setItem("duton_access_token", response.data.session_token)
            window.localStorage.setItem("duton_user_type", "guest")
            window.localStorage.setItem("duton_username", response.data.email)
            window.localStorage.setItem("duton_sensor_id", response.data.sensor_id)
          }
          
          setStatus("success")
          setMessage(`Access granted! Redirecting to dashboard...`)
          
          // Redirect to main dashboard page first
          // The dashboard will show the assigned sensor for this user
          setTimeout(() => {
            router.push(`/dashboard`)
          }, 1000)
        } else {
          setStatus("error")
          setMessage("Failed to validate access link.")
        }
      } catch (error) {
        console.error("Token validation error:", error)
        setStatus("error")
        setMessage(error.message || "Invalid, expired, or already used access link. Please contact the administrator for a new link.")
      }
    }

    validateToken()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Accessing Sensor Dashboard</CardTitle>
          <CardDescription>
            Validating your access link...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "validating" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Please wait while we validate your access...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-sm text-center text-foreground font-medium">{message}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Redirecting...</span>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <XCircle className="h-12 w-12 text-destructive" />
              <div className="space-y-2 text-center">
                <p className="text-sm font-medium text-foreground">Access Denied</p>
                <p className="text-xs text-muted-foreground">{message}</p>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>Please contact the administrator for assistance.</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Accessing Sensor Dashboard</CardTitle>
            <CardDescription>
              Validating your access link...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Please wait while we validate your access...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <AccessPageContent />
    </Suspense>
  )
}


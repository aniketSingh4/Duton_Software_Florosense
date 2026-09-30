"use client"

import { useState, useEffect } from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { CalibrationSetupDialog } from "@/components/dashboard/calibration-setup-dialog"
import { Button } from "@/components/ui/button"
import { getClientUserContext } from "@/lib/user-context"
import { Settings, Shield, User } from "lucide-react"
import { VideoBackground } from "@/components/layout/video-background"
import { AmcAlertBanner } from "@/components/dashboard/amc-alert-banner"

function getTimeGreeting(date) {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return "Good Morning"
  if (hour >= 12 && hour < 17) return "Good Afternoon"
  return "Good Night"
}

export default function DashboardPage() {
  const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [username, setUsername] = useState("")
  const [role, setRole] = useState("")
  const [now, setNow] = useState(null)

  // Resolve role from token/localStorage to avoid extra network calls on first paint.
  useEffect(() => {
    const checkUserRole = () => {
      if (typeof window === "undefined") return
      const { username: currentUsername, isAdmin: currentIsAdmin, role: currentRole } = getClientUserContext()
      setUsername(currentUsername)
      setIsAdmin(currentIsAdmin)
      setRole(currentRole || "")
    }
    
    checkUserRole()
  }, [])

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const timerId = window.setInterval(tick, 1000)
    return () => window.clearInterval(timerId)
  }, [])

  const displayName = username || "User"
  const roleLabel = (isAdmin ? "admin" : role || "user").toUpperCase()
  const greeting = now ? getTimeGreeting(now) : "Welcome"
  const clockLabel = now
    ? now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:-- --"
  const dateLabel = now ? now.toLocaleDateString("en-US") : ""

  return (
    <div className="relative min-h-screen overflow-hidden">
      <VideoBackground overlayClassName="bg-background/65 backdrop-blur" preload="none" />

      <div className="relative z-10 flex min-h-screen flex-col">
        {!isAdmin && <AmcAlertBanner />}
        <DashboardHeader />
        <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-[95vw] text-foreground">
          <section className="mb-6 w-full max-w-7xl mx-auto rounded-md border border-border bg-muted px-4 py-3.5 md:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-background px-2 py-0.5 text-[11px] font-medium tracking-wide text-foreground">
                  {isAdmin ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  {roleLabel}
                </span>
                <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                  {greeting},{" "}
                  <span className="text-primary">{displayName}</span>
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Welcome, {displayName}! Choose a sensor location to monitor.
                </p>
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="text-xl font-semibold tabular-nums text-foreground md:text-2xl">{clockLabel}</p>
                <p className="text-xs text-muted-foreground">{dateLabel}</p>
              </div>
            </div>
          </section>
          <DashboardContent />
        </main>
      </div>

      {/* Calibration Setup Button - Right Bottom Corner - Admin Only */}
      {isAdmin && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setCalibrationDialogOpen(true)}
            className="rounded-full h-12 w-12 shadow-lg hover:shadow-xl transition-all"
            size="icon"
            title="Calibration Setup"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Calibration Setup Dialog */}
      <CalibrationSetupDialog
        open={calibrationDialogOpen}
        onOpenChange={setCalibrationDialogOpen}
      />
    </div>
  )
}


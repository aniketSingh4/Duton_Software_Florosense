"use client"

import { useState, useEffect } from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { CalibrationSetupDialog } from "@/components/dashboard/calibration-setup-dialog"
import { Button } from "@/components/ui/button"
import { getClientUserContext } from "@/lib/user-context"
import { Settings } from "lucide-react"
import { VideoBackground } from "@/components/layout/video-background"
import { AmcAlertBanner } from "@/components/dashboard/amc-alert-banner"

export default function DashboardPage() {
  const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [username, setUsername] = useState("")

  // Resolve role from token/localStorage to avoid extra network calls on first paint.
  useEffect(() => {
    const checkUserRole = () => {
      if (typeof window === "undefined") return
      const { username: currentUsername, isAdmin: currentIsAdmin } = getClientUserContext()
      setUsername(currentUsername)
      setIsAdmin(currentIsAdmin)
    }
    
    checkUserRole()
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden">
      <VideoBackground overlayClassName="bg-background/65 backdrop-blur" preload="none" />

      <div className="relative z-10 flex min-h-screen flex-col">
        {!isAdmin && <AmcAlertBanner />}
        <DashboardHeader />
        <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-[95vw] text-foreground">
          <div className="mb-12 text-center">
            <h1 className="text-2xl md:text-3xl font-bold mb-4">Select Sensor Location</h1>
            <p className="text-muted-foreground text-md md:text-lg">
              Welcome, {username || "User"}! Choose a sensor location to monitor:
            </p>
          </div>
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


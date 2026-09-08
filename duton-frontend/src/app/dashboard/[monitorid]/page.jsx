"use client"

import dynamic from "next/dynamic"
import { use } from "react"

const DashboardHeader = dynamic(
  () => import("@/components/dashboard/dashboard-header").then((mod) => mod.DashboardHeader),
  { ssr: false }
)

const MonitoringDashboard = dynamic(
  () =>
    import("@/components/monitoring/monitoring-dashboard").then((mod) => mod.MonitoringDashboard),
  { ssr: false }
)

export default function MonitorPage({ params }) {
  const resolvedParams = use(params)
  const monitorId = resolvedParams?.monitorid

  // Don't render MonitoringDashboard until monitorId is ready
  if (!monitorId) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <DashboardHeader />
        <main className="flex-1 container mx-auto px-4 py-3 max-w-7xl">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-3 max-w-7xl">
        <MonitoringDashboard monitorId={monitorId} />
      </main>
    </div>
  )
}


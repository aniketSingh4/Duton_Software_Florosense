"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertTriangle,
  CheckCircle2,
  Activity,
  MapPin,
  User,
  Phone,
  ShieldAlert,
  RefreshCw,
  Clock,
  AlertCircle
} from "lucide-react"
import { fetchSensorAnomalies } from "@/utils/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function SensorAnomaliesView() {
  const [anomalies, setAnomalies] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 6

  const loadAnomalies = async (silent = false) => {
    setIsLoading(true)
    setError("")
    try {
      const data = await fetchSensorAnomalies()
      setAnomalies(data)
      setCurrentPage(1)
      if (!silent) {
        toast.success(`Loaded ${data.length} potential anomalies`)
      }
    } catch (err) {
      console.error("Failed to load anomalies:", err)
      setError(err.message || "Failed to retrieve anomalies data.")
      toast.error("Failed to retrieve anomalies data.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAnomalies(true)
  }, [])

  const getFriendlyFieldName = (field) => {
    switch (field) {
      case "pm2_5":
        return "PM2.5"
      case "pm10_0":
        return "PM10"
      case "temperature":
        return "Temperature"
      case "humidity":
        return "Humidity"
      default:
        return field
    }
  }

  const formatLocation = (loc) => {
    if (!loc) return "No address details available"
    if (typeof loc === "string") return loc
    if (typeof loc === "object") {
      if (loc.address) return loc.address
      if (loc.latitude && loc.longitude) return `${loc.latitude}, ${loc.longitude}`
      return "No address details available"
    }
    return "No address details available"
  }

  const getFieldUnit = (field) => {
    switch (field) {
      case "pm2_5":
      case "pm10_0":
        return " µg/m³"
      case "temperature":
        return " °C"
      case "humidity":
        return " %"
      default:
        return ""
    }
  }

  const totalPages = Math.max(1, Math.ceil(anomalies.length / PAGE_SIZE))
  const paginatedAnomalies = anomalies.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const showPagination = anomalies.length > PAGE_SIZE
  const rangeStart = anomalies.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, anomalies.length)

  const handlePageChange = (direction) => {
    setCurrentPage((prev) => {
      if (direction === "prev") return Math.max(1, prev - 1)
      if (direction === "next") return Math.min(totalPages, prev + 1)
      return prev
    })
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-card/40 border border-border/40 backdrop-blur-xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />
            Sensor Anomalies (24 Hours)
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Identify sensors showing zero variation/flatline reading behaviors in the past 24 hours.
          </p>
        </div>
        <Button
          onClick={() => loadAnomalies(false)}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="bg-card/40 border-border/30 animate-pulse h-[350px]">
              <CardContent className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Activity className="h-8 w-8 text-muted-foreground/30 animate-bounce" />
                  <span className="text-xs text-muted-foreground/50">Analyzing telemetry logs...</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
            <h3 className="text-base font-semibold text-foreground">Failed to Analyze Telemetry</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">{error}</p>
            <Button onClick={() => loadAnomalies(false)} size="sm" variant="outline" className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : anomalies.length === 0 ? (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping opacity-75" />
              <div className="relative p-4 rounded-full bg-green-500/10 border border-green-500/30">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-foreground">All Systems Operational</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-lg">
              No stuck sensor readings or flatline anomalies have been detected in the last 24 hours. Telemetry variation indices are within normal bounds.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedAnomalies.map((anomaly) => (
              <Card
                key={anomaly.sensor_id}
                className={cn(
                  "group flex flex-col h-auto overflow-hidden",
                  "bg-card/60 border-border/40 shadow-sm backdrop-blur-xs",
                  "hover:shadow-xl hover:border-red-500/30",
                  "transition-all duration-300 ease-in-out",
                  "hover:-translate-y-1"
                )}
              >
                {/* Card Header with red gradient highlights */}
                <div className="relative bg-linear-to-r from-red-500/10 via-background/10 to-transparent border-b border-border/30">
                  <CardHeader className="px-5 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 rounded-lg bg-red-500/15 group-hover:bg-red-500/25 transition-colors">
                            <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
                          </div>
                          <CardTitle className="text-base font-bold text-foreground leading-tight">
                            {anomaly.site_name || "Unknown Site"}
                          </CardTitle>
                        </div>
                        <CardDescription className="flex items-start gap-2 text-xs leading-relaxed mt-2">
                          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-500/65" />
                          <span className="text-muted-foreground/90">{formatLocation(anomaly.location)}</span>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </div>

                {/* Card Body */}
                <CardContent className="flex-1 px-5 py-4 space-y-4">
                  {/* ID section */}
                  <div className="flex items-center justify-between text-xs border-b border-border/20 pb-2.5">
                    <div className="flex flex-col">
                      <span className="font-semibold text-muted-foreground">Sensor ID</span>
                      <span className="font-mono text-foreground mt-0.5">{anomaly.sensor_id}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-semibold text-muted-foreground">Device ID</span>
                      <span className="font-mono text-foreground mt-0.5">{anomaly.device_id || "N/A"}</span>
                    </div>
                  </div>

                  {/* Stuck Fields Warning List */}
                  <div className="space-y-2.5">
                    <span className="text-xs font-bold text-red-500 flex items-center gap-1.5">
                      Stuck Metrics Detected:
                    </span>
                    <div className="space-y-2">
                      {anomaly.stuck_fields.map((stuck) => (
                        <div
                          key={stuck.field}
                          className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/15"
                        >
                          <span className="text-xs font-medium text-foreground">
                            {getFriendlyFieldName(stuck.field)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold font-mono text-red-500">
                              {stuck.value !== null && stuck.value !== undefined ? stuck.value : "null"}
                              {getFieldUnit(stuck.field)}
                            </span>
                            <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-sm font-semibold">
                              {stuck.count} readings
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Contact and Metadata */}
                  <div className="pt-2 border-t border-border/20 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <User className="h-3.5 w-3.5 text-muted-foreground/75 shrink-0" />
                      <div>
                        <span className="text-muted-foreground/75 font-medium">SPOC:</span>{" "}
                        <span className="text-foreground">{anomaly.spoc_name || <span className="text-muted-foreground/50 italic">None</span>}</span>
                      </div>
                    </div>
                    {anomaly.spoc_contact && (
                      <div className="flex items-center gap-2 text-xs">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground/75 shrink-0" />
                        <div>
                          <span className="text-muted-foreground/75 font-medium">Contact:</span>{" "}
                          <span className="text-foreground font-mono">{anomaly.spoc_contact}</span>
                        </div>
                      </div>
                    )}
                    {anomaly.client_name && (
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/75 shrink-0" />
                        <div>
                          <span className="text-muted-foreground/75 font-medium">Client:</span>{" "}
                          <span className="text-foreground">{anomaly.client_name}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* Card Footer */}
                <div className="px-5 py-3.5 bg-muted/20 border-t border-border/20 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    Last: {anomaly.last_timestamp ? new Date(anomaly.last_timestamp).toLocaleTimeString() : "N/A"}
                  </span>
                  <span className="flex items-center gap-1">
                    First: {anomaly.first_timestamp ? new Date(anomaly.first_timestamp).toLocaleTimeString() : "N/A"}
                  </span>
                </div>
              </Card>
            ))}
          </div>

          {showPagination && (
            <div className="w-full max-w-7xl mx-auto mt-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border rounded-lg px-4 py-3 bg-muted/20">
                <p className="text-sm text-muted-foreground text-center sm:text-left">
                  Showing {rangeStart}-{rangeEnd} of {anomalies.length}
                </p>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange("prev")}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange("next")}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

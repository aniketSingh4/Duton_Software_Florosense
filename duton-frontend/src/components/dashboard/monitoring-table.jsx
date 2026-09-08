"use client"

import { useMemo, useState, useEffect } from "react"
import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn, formatDate, formatDateTime } from "@/lib/utils"
import { fetchAllLatestReadings } from "@/utils/api"
import { Calendar, FileText, Pencil, Save, Trash2, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STATUS_COLORS = {
  Active: "text-emerald-500",
  Delay: "text-orange-500",
  Inactive: "text-muted-foreground",
  Online: "text-emerald-500",
  Offline: "text-red-500",
}

function HoverReveal({ text, children, tooltipMaxWidth = "max-w-[320px]", multiline = false }) {
  if (!text) return children

  return (
    <div className="relative inline-block max-w-full group">
      {children}
      <div
        className={`pointer-events-none invisible absolute left-0 top-full z-50 mt-1 w-max ${tooltipMaxWidth} rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity duration-75 group-hover:visible group-hover:opacity-100 ${
          multiline ? "whitespace-normal break-words leading-relaxed" : "whitespace-nowrap"
        }`}
      >
        {text}
      </div>
    </div>
  )
}

export function MonitoringTable({
  data,
  pageSize = 5,
  showFooter = true,
  onStatusChange,
  onUpdate,
  onDelete,
  onRemarkUpdate,
}) {
  const [page, setPage] = useState(1)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAssignee, setIsAssignee] = useState(false)
  const [latestReadings, setLatestReadings] = useState({})
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false)
  const [selectedRemark, setSelectedRemark] = useState({ sensorId: "", sensorName: "", remark: "", remarkDate: "" })
  const [isEditingRemark, setIsEditingRemark] = useState(false)
  const [editedRemark, setEditedRemark] = useState("")
  const [editedRemarkDate, setEditedRemarkDate] = useState("")

  // Check if user is admin or assignee by checking role from backend or JWT token
  useEffect(() => {
    const checkUserRole = async () => {
      if (typeof window === "undefined") return
      
      let role = null
      
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
        else if (userType === "assignee") role = "assignee"
      }
      
      // Set states based on role
      setIsAdmin(role === "admin")
      setIsAssignee(role === "assignee")
    }
    
    checkUserRole()
  }, [])

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))

  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [page, data, pageSize])

  useEffect(() => {
    let cancelled = false

    const loadLatestReadings = async () => {
      if (!Array.isArray(data) || data.length === 0) return

      const ids = data
        .map((row) => row?.identifier || row?.id)
        .filter(Boolean)

      if (ids.length === 0) return

      try {
        const readings = await fetchAllLatestReadings(ids)
        if (!cancelled && readings) {
          setLatestReadings((prev) => ({ ...prev, ...readings }))
        }
      } catch (e) {}
    }

    loadLatestReadings()
    const intervalId = setInterval(loadLatestReadings, 30_000)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [data])

  // Calculate if sensor is offline based on last data timestamp (15 minutes threshold)
  const calculateSensorStatus = (row) => {
    // Check if sensor has current data (PM values indicate active sensor)
    const hasCurrentData = (row.pm25 !== null && row.pm25 !== undefined && row.pm25 !== "XXX") || 
                          (row.pm10 !== null && row.pm10 !== undefined && row.pm10 !== "XXX") ||
                          (row.temperature !== null && row.temperature !== undefined && row.temperature !== "XXX") ||
                          (row.humidity !== null && row.humidity !== undefined && row.humidity !== "XXX")
    
    const lastUpdate = row.lastUpdated || row.lastUpdate || row.timestamp || null
    
    // If no timestamp but has current data, assume it's recent (online)
    if (!lastUpdate) {
      if (hasCurrentData) {
        return {
          isOnline: true,
          offlineSince: null,
        }
      }
      const now = new Date()
      const estimatedOfflineTime = new Date(now.getTime() - 30 * 60 * 1000)
      return {
        isOnline: false,
        offlineSince: estimatedOfflineTime,
      }
    }
    
    // Validate the timestamp
    const lastUpdateTime = new Date(lastUpdate)
    if (isNaN(lastUpdateTime.getTime())) {
      // Invalid timestamp - if has data, assume online
      if (hasCurrentData) {
        return {
          isOnline: true,
          offlineSince: null,
        }
      }
      const now = new Date()
      const estimatedOfflineTime = new Date(now.getTime() - 30 * 60 * 1000)
      return {
        isOnline: false,
        offlineSince: estimatedOfflineTime,
      }
    }
    
    const now = new Date()
    const minutesSinceLastUpdate = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60)
    
    // If sensor has current data, consider it online even if timestamp is slightly old
    // This handles cases where data exists but timestamp might be delayed
    if (hasCurrentData && minutesSinceLastUpdate <= 30) {
      return {
        isOnline: true,
        offlineSince: null,
      }
    }
    
    // Sensor is offline if no data for 15 minutes (or old timestamp without current data)
    if (minutesSinceLastUpdate > 30) {
      const offlineSince = new Date(lastUpdateTime.getTime() + 30 * 60 * 1000)
      return {
        isOnline: false,
        offlineSince: offlineSince,
      }
    }
    
    return {
      isOnline: true,
      offlineSince: null,
    }
  }

  // Discord Webhook Notification for delayed sensors
  useEffect(() => {
    if (!data) return
    
    data.forEach((row) => {
      const sensorId = row?.identifier || row?.id || null
      if (!sensorId) return

      const latest = latestReadings[sensorId]
      const rowWithLatest = latest ? {
        ...row,
        pm25: latest.pm2_5 ?? row.pm25,
        pm10: latest.pm10_0 ?? row.pm10,
        temperature: latest.temperature ?? row.temperature,
        humidity: latest.humidity ?? row.humidity,
        lastUpdated: latest.timestamp ?? latest.lastUpdate ?? row.lastUpdated ?? row.lastUpdate ?? row.timestamp,
      } : row

      const { isOnline, offlineSince } = calculateSensorStatus(rowWithLatest)
      
      if (!isOnline && offlineSince) {
        const storageKey = `discord_alert_${sensorId}`
        const currentOfflineTime = new Date(offlineSince).getTime().toString()
        const lastAlertTimeStr = localStorage.getItem(storageKey)
        
        if (lastAlertTimeStr !== currentOfflineTime) {
          localStorage.setItem(storageKey, currentOfflineTime)
          
          const siteName = rowWithLatest.site_name || rowWithLatest.siteId || rowWithLatest.site_id || "Unknown Site"
          const deviceId = rowWithLatest.device_id || rowWithLatest.sensor_id || ""
          const projectDisplay = deviceId ? `${siteName} (${deviceId})` : siteName

          const webhookUrl = "https://discord.com/api/webhooks/1488848825161482335/WNOFmdgSvhAyvi1CsQEAPcbiIZClHBWW0yc8yvjV8Qup9s9LqJ3F9dyjQ-7FvM0lxkxH"
          const embedPayload = {
            username: "Duton Alerts",
            embeds: [
              {
                title: "⚠️ Sensor Delay Alert",
                description: "The API is down or data has not been updated for over **30 minutes**.",
                color: 16347926, // Tailwind #f97316 (orange-500)
                fields: [
                  {
                    name: "Project",
                    value: projectDisplay || "Unknown",
                    inline: true
                  },
                  {
                    name: "Sensor ID",
                    value: sensorId || "Unknown",
                    inline: true
                  },
                  {
                    name: "Status",
                    value: "Delayed",
                    inline: true
                  },
                  {
                    name: "Delay Since",
                    value: formatDateTime(offlineSince) || "Unknown",
                    inline: false
                  }
                ],
                footer: {
                  text: "Duton Monitoring System",
                },
                timestamp: new Date().toISOString()
              }
            ]
          }
          
          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(embedPayload),
          }).catch(console.error)
        }
      } else if (isOnline) {
        const storageKey = `discord_alert_${sensorId}`
        localStorage.removeItem(storageKey)
      }

      // --- Sensor Value Threshold Alert Logic ---
      const checkValue = (val) => {
        if (val === null || val === undefined || val === "XXX" || Number.isNaN(Number(val))) return false;
        const num = Number(val);
        return num > 1000 || num < 10;
      };

      const hasAbnormalPm25 = checkValue(rowWithLatest.pm25);
      const hasAbnormalPm10 = checkValue(rowWithLatest.pm10);
      const hasAbnormalTemp = checkValue(rowWithLatest.temperature);
      const hasAbnormalHumid = checkValue(rowWithLatest.humidity);

      if (hasAbnormalPm25 || hasAbnormalPm10 || hasAbnormalTemp || hasAbnormalHumid) {
        const valueAlertStorageKey = `discord_value_alert_${sensorId}`;
        const lastValueAlertStr = localStorage.getItem(valueAlertStorageKey);

        if (lastValueAlertStr !== "true") {
          localStorage.setItem(valueAlertStorageKey, "true");
          
          const abnormalities = [];
          if (hasAbnormalPm25) abnormalities.push(`PM2.5: **${rowWithLatest.pm25}**`);
          if (hasAbnormalPm10) abnormalities.push(`PM10: **${rowWithLatest.pm10}**`);
          if (hasAbnormalTemp) abnormalities.push(`Temperature: **${rowWithLatest.temperature}**`);
          if (hasAbnormalHumid) abnormalities.push(`Humidity: **${rowWithLatest.humidity}**`);

          const siteName = rowWithLatest.site_name || rowWithLatest.siteId || rowWithLatest.site_id || "Unknown Site"
          const deviceId = rowWithLatest.device_id || rowWithLatest.sensor_id || ""
          const projectDisplay = deviceId ? `${siteName} (${deviceId})` : siteName

          const webhookUrl = "https://discord.com/api/webhooks/1488865758820696238/gZrpNERgwp4kYoIz3govxVvoUheoiomyBx0K0eCeC7s8CiNcWuX_cwgQz0B7UlYwMOU4"
          
          const embedPayload = {
            username: "Duton Quality Alerts",
            embeds: [
              {
                title: "🔴 Sensor Value Alert",
                description: "One or more sensor readings are exhibiting extreme values (Above 1000 or Below 10).",
                color: 15548997, // Red color hex
                fields: [
                  {
                    name: "Project",
                    value: projectDisplay || "Unknown",
                    inline: true
                  },
                  {
                    name: "Sensor ID",
                    value: sensorId || "Unknown",
                    inline: true
                  },
                  {
                    name: "Abnormal Readings",
                    value: abnormalities.join("\n"),
                    inline: false
                  }
                ],
                footer: {
                  text: "Duton Monitoring System",
                },
                timestamp: new Date().toISOString()
              }
            ]
          }

          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(embedPayload),
          }).catch(console.error)
        }
      } else {
        const valueAlertStorageKey = `discord_value_alert_${sensorId}`;
        localStorage.removeItem(valueAlertStorageKey);
      }
    })
  }, [data, latestReadings])


  return (
    <Card className="border-border/60 shadow-sm overflow-hidden w-full max-w-full">
      <div className="w-full overflow-x-auto">
        <Table className="w-full table-fixed min-w-full">
        <TableHeader className="bg-muted/10">
          <TableRow>
            <TableHead className="w-[12%]">Project name</TableHead>
            {(isAdmin || isAssignee) && <TableHead className="w-[10%]">Sensor ID</TableHead>}
            <TableHead className="w-[8%]">PM2.5 (UNIT)</TableHead>
            <TableHead className="w-[8%]">PM10 (UNIT)</TableHead>
            <TableHead className="w-[8%]">Temp (UNIT)</TableHead>
            <TableHead className="w-[8%] pr-4">Humidity (UNIT)</TableHead>
            {isAdmin && (
              <>
                <TableHead className="w-[10%] pl-4">Installation Date</TableHead>
                <TableHead className="w-[20%]">Remark</TableHead>
              </>
            )}
            <TableHead className="w-[16%]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageData.map((row) => {
            const sensorId = row?.identifier || row?.id || null
            const latest = sensorId ? latestReadings[sensorId] : null
            
            // Merge row data with latest readings for status calculation
            const rowWithLatest = latest ? {
              ...row,
              pm25: latest.pm2_5 ?? row.pm25,
              pm10: latest.pm10_0 ?? row.pm10,
              temperature: latest.temperature ?? row.temperature,
              humidity: latest.humidity ?? row.humidity,
              lastUpdated: latest.timestamp ?? latest.lastUpdate ?? row.lastUpdated ?? row.lastUpdate ?? row.timestamp,
            } : row
            
            // Calculate sensor status based on last data timestamp (15 minutes threshold)
            const { isOnline, offlineSince } = calculateSensorStatus(rowWithLatest)
            const statusDisplay = isOnline ? "Online" : "Delay"
            const statusColor = isOnline ? STATUS_COLORS.Online : STATUS_COLORS.Delay
            const delayText = offlineSince ? `Delay since ${formatDateTime(offlineSince)}` : ""
            const isMissing = (v) => v === null || v === undefined || v === "XXX"

            // Use API data first, fallback to row data
            const fmt2 = (v) => {
              if (v == null) return null
              const n = typeof v === "number" ? v : Number(v)
              return Number.isFinite(n) ? n.toFixed(2) : null
            }
            const pm25Display = fmt2(latest?.pm2_5 ?? (!isMissing(row?.pm25) ? row.pm25 : null))
            const pm10Display = fmt2(latest?.pm10_0 ?? (!isMissing(row?.pm10) ? row.pm10 : null))
            const tempDisplay = fmt2(latest?.temperature ?? (!isMissing(row?.temperature) ? row.temperature : null))
            const humidityDisplay = fmt2(latest?.humidity ?? (!isMissing(row?.humidity) ? row.humidity : null))
            const siteName = row.site_name || row.siteId || row.site_id || "Unknown Site"
            const deviceId = row.device_id || row.sensor_id || ""
            const projectDisplay = deviceId ? `${siteName} (${deviceId})` : siteName
            const sensorIdentifier = row.identifier || row.id || "N/A"
            
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <HoverReveal text={projectDisplay}>
                    <a
                      className="block truncate text-primary hover:underline font-medium"
                      href={`/dashboard/${row.id}`}
                    >
                      {projectDisplay}
                    </a>
                  </HoverReveal>
                </TableCell>
                {(isAdmin || isAssignee) && (
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    <HoverReveal text={sensorIdentifier}>
                      <span className="block truncate">
                        {sensorIdentifier}
                      </span>
                    </HoverReveal>
                  </TableCell>
                )}
                <TableCell className="font-mono text-sm">
                  {pm25Display ?? "XXX"}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {pm10Display ?? "XXX"}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {tempDisplay ?? "XXX"}
                </TableCell>
                <TableCell className="font-mono text-sm pr-4">
                  {humidityDisplay ?? "XXX"}
                </TableCell>
                {isAdmin && (
                  <>
                    <TableCell className="text-sm pl-4">
                      {row.installationDate ? (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span>{formatDate(row.installationDate)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-[250px]">
                      {row.remark ? (
                        <div className="flex items-start gap-1.5">
                          <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
                          <div className="flex-1 min-w-0">
                            {row.remarkDate && (
                              <div className="text-[10px] text-muted-foreground/50 mb-0.5">
                                {formatDate(row.remarkDate)}
                              </div>
                            )}
                            <HoverReveal text={row.remark} multiline tooltipMaxWidth="max-w-[360px]">
                              <button
                                onClick={() => {
                                  setSelectedRemark({ sensorId: row.id, sensorName: row.name, remark: row.remark, remarkDate: row.remarkDate })
                                  setRemarkDialogOpen(true)
                                }}
                                className="block truncate text-left hover:underline cursor-pointer w-full"
                              >
                                {row.remark}
                              </button>
                            </HoverReveal>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </TableCell>
                  </>
                )}
                <TableCell>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-sm font-medium", statusColor)}>
                        {statusDisplay}
                      </span>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0"
                            onClick={() => onUpdate?.(row)}
                            aria-label={`Edit ${row.name || row.id}`}
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (!onDelete) return
                              if (window.confirm(`Are you sure you want to delete sensor "${row.name}"?`)) {
                                onDelete(row)
                              }
                            }}
                            aria-label={`Delete ${row.name || row.id}`}
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {offlineSince && (
                      <HoverReveal text={delayText} tooltipMaxWidth="max-w-[280px]">
                        <span className="block max-w-[170px] truncate text-xs text-muted-foreground/70">
                          {delayText}
                        </span>
                      </HoverReveal>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      </div>
      {showFooter && (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}-
            {Math.min(page * pageSize, data.length)} of {data.length}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Remark Dialog */}
      <Dialog open={remarkDialogOpen} onOpenChange={setRemarkDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="font-semibold">Remark - {selectedRemark.sensorName}</DialogTitle>
              {isAdmin && !isEditingRemark && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingRemark(true)}
                  className="h-6 w-6 p-0"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <DialogDescription>
              {!isEditingRemark && selectedRemark.remarkDate && (
                <span>Updated on {formatDate(selectedRemark.remarkDate)}</span>
              )}
              {!isEditingRemark && !selectedRemark.remarkDate && "Full remark text for this sensor"}
              {isEditingRemark && "Edit remark and date"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isEditingRemark ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="remark-date">Remark Date</Label>
                  <Input
                    id="remark-date"
                    type="date"
                    value={editedRemarkDate}
                    onChange={(e) => setEditedRemarkDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remark-text">Remark</Label>
                  <Textarea
                    id="remark-text"
                    value={editedRemark}
                    onChange={(e) => setEditedRemark(e.target.value)}
                    rows={5}
                    placeholder="Enter remark..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditedRemark(selectedRemark.remark || "")
                      setEditedRemarkDate(selectedRemark.remarkDate || "")
                      setIsEditingRemark(false)
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      // Find the sensor in data and update it
                      const sensorToUpdate = data.find(s => s.id === selectedRemark.sensorId)
                      if (sensorToUpdate) {
                        const updatedSensor = {
                          ...sensorToUpdate,
                          remark: editedRemark,
                          remarkDate: editedRemarkDate || new Date().toISOString().split("T")[0]
                        }
                        // Use onRemarkUpdate if available, otherwise onUpdate
                        if (onRemarkUpdate) {
                          onRemarkUpdate(updatedSensor)
                        } else if (onUpdate) {
                          onUpdate(updatedSensor)
                        }
                      } else {
                        console.error("Sensor not found in data:", selectedRemark.sensorId)
                      }
                      setSelectedRemark({
                        ...selectedRemark,
                        remark: editedRemark,
                        remarkDate: editedRemarkDate || new Date().toISOString().split("T")[0]
                      })
                      setIsEditingRemark(false)
                    }}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap wrap-break-word">
                {selectedRemark.remark || "No remarks available"}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}


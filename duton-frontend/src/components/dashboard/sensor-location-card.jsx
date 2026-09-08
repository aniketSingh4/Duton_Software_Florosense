"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin, Activity, ExternalLink, MoreVertical, Pencil, Trash2, Calendar, FileText, Save, X, UserPlus, Mail, Link2, Clock, Trash, Copy, Check } from "lucide-react"
import dynamic from "next/dynamic"
import { cn, formatDate, formatDateTime } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { getUsersByRole, assignSensorToUser, getUsersForSensor, unassignSensorFromUser, generateShareAccessLink, getShareAccessTokens, revokeShareAccessToken } from "@/utils/api"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Dynamically import the map to avoid SSR issues with Leaflet
const SensorMap = dynamic(
  () => import("./sensor-map").then((mod) => mod.SensorMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[180px] rounded-xl bg-linear-to-br from-muted/50 to-muted animate-pulse flex items-center justify-center border border-border/50 overflow-hidden">
        <div className="flex flex-col items-center gap-2">
          <MapPin className="h-8 w-8 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground/70">Loading map...</span>
        </div>
      </div>
    ),
  }
)

export function SensorLocationCard({
  sensor,
  onUpdate,
  onDelete,
  onRemarkUpdate,
  offlineTimestamp,
  isAdmin = false,
  isAssignee = false,
}) {
  const router = useRouter()
  const [showMap, setShowMap] = useState(false)
  const mapContainerRef = useRef(null)
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false)
  const [isEditingRemark, setIsEditingRemark] = useState(false)
  const [editedRemark, setEditedRemark] = useState("")
  const [editedRemarkDate, setEditedRemarkDate] = useState("")
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState("")
  const [selectedUser, setSelectedUser] = useState("")
  const [usersByRole, setUsersByRole] = useState([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignedUsers, setAssignedUsers] = useState([])
  const [isLoadingAssignedUsers, setIsLoadingAssignedUsers] = useState(false)

  // Helper function to get the correct sensor ID - prioritize sensor_id, then name, then identifier, then id
  // sensor.name often matches the database sensor_id, so it's important to check it
  const getSensorId = useCallback(() => {
    return sensor.sensor_id || sensor.name || sensor.identifier || sensor.id || sensor.sensorId
  }, [sensor.sensor_id, sensor.name, sensor.identifier, sensor.id, sensor.sensorId])
  const [shareEmail, setShareEmail] = useState("")
  const [shareDuration, setShareDuration] = useState(87600)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [activeTokens, setActiveTokens] = useState([])
  const [isLoadingTokens, setIsLoadingTokens] = useState(false)
  const [showShareSection, setShowShareSection] = useState(false)
  const [generatedLink, setGeneratedLink] = useState("")
  const [linkCopied, setLinkCopied] = useState(false)

  // Auto-load maps when cards become visible, while avoiding upfront load for all cards.
  useEffect(() => {
    if (showMap) return
    if (typeof window === "undefined") return

    const element = mapContainerRef.current
    if (!element) return

    if (!("IntersectionObserver" in window)) {
      setShowMap(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          setShowMap(true)
          observer.disconnect()
        }
      },
      { rootMargin: "250px 0px", threshold: 0.1 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [showMap])

  useEffect(() => {
    if (remarkDialogOpen) {
      // Use setTimeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        setEditedRemark(sensor.remark || "")
        setEditedRemarkDate(sensor.remarkDate || new Date().toISOString().split("T")[0])
        // If remark is not set and user is admin/assignee, start in edit mode
        if (!sensor.remark && (isAdmin || isAssignee)) {
          setIsEditingRemark(true)
        } else {
          setIsEditingRemark(false)
        }
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [remarkDialogOpen, sensor.remark, sensor.remarkDate, isAdmin, isAssignee])

  const handleSaveRemark = () => {
    const updatedSensor = {
      ...sensor,
      remark: editedRemark,
      remarkDate: editedRemarkDate || new Date().toISOString().split("T")[0],
    }
    if (onRemarkUpdate) {
      onRemarkUpdate(updatedSensor)
    } else if (onUpdate) {
      onUpdate(updatedSensor)
    }
    setIsEditingRemark(false)
  }

  const handleCancelEdit = () => {
    setEditedRemark(sensor.remark || "")
    setEditedRemarkDate(sensor.remarkDate || "")
    setIsEditingRemark(false)
  }

  const handleMonitor = () => {
    router.push(`/dashboard/${sensor.id}`)
  }

  const handleUpdate = (e) => {
    e.stopPropagation()
    if (onUpdate) {
      onUpdate(sensor)
    }
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    if (onDelete && window.confirm(`Are you sure you want to delete sensor "${sensor.name}"?`)) {
      onDelete(sensor)
    }
  }

  const handleAssign = (e) => {
    e.stopPropagation()
    setAssignDialogOpen(true)
    setSelectedRole("")
    setSelectedUser("")
    setUsersByRole([])
    setShareEmail("")
    setShareDuration(87600)
    setShowShareSection(false)
    setGeneratedLink("")
    loadActiveTokens()
  }

  const handleCopyLink = async () => {
    if (generatedLink) {
      try {
        await navigator.clipboard.writeText(generatedLink)
        setLinkCopied(true)
        toast.success("Link copied to clipboard")
        setTimeout(() => setLinkCopied(false), 2000)
      } catch (error) {
        toast.error("Failed to copy link")
      }
    }
  }

  const loadActiveTokens = async () => {
    const sensorId = getSensorId()
    if (!sensorId) {
      setActiveTokens([])
      return
    }

    setIsLoadingTokens(true)
    try {
      const tokens = await getShareAccessTokens(sensorId)
      setActiveTokens(Array.isArray(tokens) ? tokens : [])
    } catch (error) {
      console.error("Failed to load active tokens:", error)
      // Don't show error toast - this is a background operation
      // Just set empty array so UI doesn't break
      setActiveTokens([])
    } finally {
      setIsLoadingTokens(false)
    }
  }

  const handleGenerateShareLink = async () => {
    if (!shareEmail) {
      toast.error("Please enter an email address")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(shareEmail)) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsGeneratingLink(true)
    try {
      const sensorId = getSensorId()
      if (!sensorId) {
        toast.error("Sensor ID not found")
        return
      }
      const response = await generateShareAccessLink(sensorId, shareEmail, shareDuration, ["view", "upload_documents"])

      // Check if email was actually sent
      const emailSent = response?.data?.email_sent
      const magicLink = response?.data?.magic_link
      const warning = response?.warning

      // Store the generated link to display in UI
      if (magicLink) {
        setGeneratedLink(magicLink)
      }

      if (emailSent === false || warning) {
        // Email failed to send, but token was created
        toast.warning(
          `Token created, but email could not be sent to ${shareEmail}. Check SMTP settings.`,
          { duration: 5000 }
        )
      } else if (emailSent === true) {
        toast.success(`Magic link sent successfully to ${shareEmail}`)
      } else {
        // Fallback - assume success if email_sent is not explicitly false
        toast.success(`Magic link sent to ${shareEmail}`)
      }

      setShareEmail("")
      loadActiveTokens()
    } catch (error) {
      console.error("Failed to generate share link:", error)
      toast.error(error.message || "Failed to generate share link")
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const handleRevokeToken = async (tokenId) => {
    if (!confirm("Are you sure you want to revoke this access link?")) {
      return
    }

    try {
      const sensorId = getSensorId()
      if (!sensorId) {
        toast.error("Sensor ID not found")
        return
      }
      await revokeShareAccessToken(sensorId, tokenId)
      toast.success("Access link revoked successfully")
      loadActiveTokens()
    } catch (error) {
      console.error("Failed to revoke token:", error)
      toast.error(error.message || "Failed to revoke access link")
    }
  }

  // Load assigned users when dialog opens
  useEffect(() => {
    const loadAssignedUsers = async () => {
      if (!assignDialogOpen) return

      setIsLoadingAssignedUsers(true)
      try {
        const sensorId = getSensorId()
        if (!sensorId) {
          setAssignedUsers([])
          return
        }
        const users = await getUsersForSensor(sensorId)
        setAssignedUsers(users || [])
      } catch (error) {
        console.error("Failed to load assigned users:", error)
        // Don't show error toast, just log it and set empty array
        setAssignedUsers([])
      } finally {
        setIsLoadingAssignedUsers(false)
      }
    }

    loadAssignedUsers()
  }, [assignDialogOpen, getSensorId])

  const handleUnassignSensor = async (username) => {
    if (!confirm(`Are you sure you want to unassign ${username} from this sensor?`)) {
      return
    }

    try {
      const sensorId = getSensorId()
      if (!sensorId) {
        toast.error("Sensor ID not found")
        return
      }
      await unassignSensorFromUser(sensorId, username)
      toast.success(`Sensor unassigned from ${username} successfully`)
      // Reload assigned users
      const users = await getUsersForSensor(sensorId)
      setAssignedUsers(users || [])
    } catch (error) {
      console.error("Failed to unassign sensor:", error)
      toast.error(error.message || "Failed to unassign sensor")
    }
  }

  const handleRoleChange = async (role) => {
    setSelectedRole(role)
    setSelectedUser("")
    setUsersByRole([])

    if (role) {
      setIsLoadingUsers(true)
      try {
        const users = await getUsersByRole(role)
        setUsersByRole(users)
      } catch (error) {
        console.error("Failed to load users:", error)
        toast.error("Failed to load users")
      } finally {
        setIsLoadingUsers(false)
      }
    }
  }

  const handleAssignSensor = async () => {
    if (!selectedRole || !selectedUser) {
      toast.error("Please select both role and user")
      return
    }

    setIsAssigning(true)
    try {
      const sensorId = getSensorId()
      if (!sensorId) {
        toast.error("Sensor ID not found")
        return
      }
      await assignSensorToUser(sensorId, selectedUser)
      toast.success(`Sensor assigned to ${selectedUser} successfully`)
      // Reload assigned users after assignment
      const users = await getUsersForSensor(sensorId)
      setAssignedUsers(users || [])
      setSelectedRole("")
      setSelectedUser("")
      setUsersByRole([])
    } catch (error) {
      console.error("Failed to assign sensor:", error)
      toast.error(error.message || "Failed to assign sensor")
    } finally {
      setIsAssigning(false)
    }
  }

  // Ensure lat/lng are provided, fallback to default if not
  const latitude = sensor.latitude ?? 28.6139
  const longitude = sensor.longitude ?? 77.2090
  const hasCurrentData =
    (sensor.pm25 !== null && sensor.pm25 !== undefined && sensor.pm25 !== "XXX") ||
    (sensor.pm10 !== null && sensor.pm10 !== undefined && sensor.pm10 !== "XXX") ||
    (sensor.temperature !== null && sensor.temperature !== undefined && sensor.temperature !== "XXX") ||
    (sensor.humidity !== null && sensor.humidity !== undefined && sensor.humidity !== "XXX")
  const lastUpdate = sensor.lastUpdated || sensor.lastUpdate || sensor.timestamp || null
  const lastUpdateTime = lastUpdate ? new Date(lastUpdate) : null
  const isDelayStatus =
    lastUpdateTime && !isNaN(lastUpdateTime.getTime())
      ? (Date.now() - lastUpdateTime.getTime()) / (1000 * 60) > 30
      : !hasCurrentData

  return (
    <Card className={cn(
      "group flex flex-col h-auto overflow-hidden",
      "bg-card/60 border-border/40 shadow-sm backdrop-blur-sm",
      "hover:shadow-xl hover:border-primary/20",
      "transition-all duration-300 ease-in-out",
      "hover:-translate-y-1",
      "py-0"
    )}>
      {/* Header with gradient background */}
      <div className="relative bg-linear-to-r from-primary/15 via-background/10 to-transparent border-b border-border/30">
        <CardHeader className="px-5 pt-4 pb-3 relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-primary/15 group-hover:bg-primary/25 transition-colors">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-base font-bold text-foreground leading-tight">
                  {(() => {
                    const siteName = sensor.site_name || sensor.siteId || sensor.site_id || "Unknown Site"
                    const deviceId = sensor.device_id || sensor.sensor_id || ""
                    return deviceId ? `${siteName} (${deviceId})` : siteName
                  })()}
                </CardTitle>
              </div>
              <CardDescription className="flex items-start gap-2 text-xs leading-relaxed mt-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/70" />
                <span className="text-muted-foreground/90">{sensor.location}</span>
              </CardDescription>
            </div>
          </div>
          {/* Update/Delete Menu - Only visible to admin users */}
          {isAdmin && (
            <div className="absolute top-2 right-2 z-20">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 bg-background/95 backdrop-blur-sm hover:bg-muted text-foreground shadow-sm hover:shadow-md transition-all"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    aria-label="More options"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 z-100">
                  <DropdownMenuItem onClick={handleUpdate} className="cursor-pointer">
                    <Pencil className="mr-2 h-4 w-4" />
                    Update
                  </DropdownMenuItem>
                  {/* <DropdownMenuItem onClick={handleAssign} className="cursor-pointer">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign
                  </DropdownMenuItem> */}
                  <DropdownMenuItem
                    onClick={handleDelete}
                    variant="destructive"
                    className="cursor-pointer"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </CardHeader>
      </div>

      {/* Map Section */}
      <CardContent className="flex-1 px-5">
        <div
          ref={mapContainerRef}
          className="mb-4 rounded-xl overflow-hidden border border-border/30 shadow-inner bg-muted/20 backdrop-blur"
        >
          {showMap ? (
            <SensorMap
              latitude={latitude}
              longitude={longitude}
              sensorName={sensor.name}
              height="180px"
            />
          ) : (
            <button
              type="button"
              className="h-[180px] w-full bg-muted/30 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setShowMap(true)}
            >
              Load map
            </button>
          )}
        </div>

        {/* Sensor ID and Status */}
        <div className="flex items-center justify-between mb-2">
          {/* Sensor ID - Only visible for admin and assignee */}
          {(isAdmin || isAssignee) ? (
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="font-semibold text-foreground">Sensor ID:</span>
              <span className="font-mono">{sensor.identifier || sensor.id || "N/A"}</span>
            </div>
          ) : sensor.identifier ? (
            <a
              href="#"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 hover:underline transition-colors group/link"
              onClick={(e) => {
                e.preventDefault()
                // TODO: Handle identifier click
              }}
            >
              <span>{sensor.identifier}</span>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
            </a>
          ) : null}

          {/* Status Indicator */}
          {(() => {
            const isDelayed = isDelayStatus
            const isOnline = !isDelayed && (sensor.status === "Active" || sensor.status === "Online")
            const offlineSince = isDelayed
              ? (sensor.lastUpdated
                ? new Date(new Date(sensor.lastUpdated).getTime() + 30 * 60 * 1000)
                : offlineTimestamp
                  ? new Date(offlineTimestamp)
                  : null)
              : !isOnline && offlineTimestamp
                ? new Date(offlineTimestamp)
                : null

            return (
              <div className="flex flex-col items-end gap-0.5">
                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                  isDelayed
                    ? "bg-orange-500/10 text-orange-500"
                    : isOnline
                    ? "bg-primary/10 text-primary"
                    : "bg-red-500/10 text-red-500"
                )}>
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isDelayed
                      ? "bg-orange-500"
                      : isOnline
                        ? "bg-primary animate-pulse"
                        : "bg-red-500"
                  )} />
                  {isDelayed ? "Delay" : isOnline ? "Active" : "Offline"}
                </div>
                {offlineSince && (
                  <span className="text-[10px] text-muted-foreground/70 text-right">
                    Since {formatDateTime(offlineSince)}
                  </span>
                )}
              </div>
            )
          })()}
        </div>

        {/* Admin and Assignee: Installation Date and Remark */}
        {(isAdmin || isAssignee) && (
          <div className="space-y-1.5 border-t border-border/30 pt-2">
            <div className="flex items-start gap-2 text-xs">
              <Calendar className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/70" />
              <div>
                <span className="text-muted-foreground/70 font-medium">Installed:</span>{" "}
                <span className="text-foreground">
                  {sensor.installationDate
                    ? formatDate(sensor.installationDate)
                    : <span className="text-muted-foreground/50 italic">Not set</span>
                  }
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <FileText className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/70" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-muted-foreground/70 font-medium">Remark:</span>
                  {sensor.remarkDate ? (
                    <span className="text-muted-foreground/50 text-[10px]">
                      ({formatDate(sensor.remarkDate)})
                    </span>
                  ) : null}
                </div>
                {sensor.remark ? (
                  <button
                    onClick={() => setRemarkDialogOpen(true)}
                    className="text-foreground wrap-break-word line-clamp-2 text-left hover:underline cursor-pointer"
                    title="Click to view full remark"
                  >
                    {sensor.remark}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground/50 italic">No remarks</span>
                    {(isAdmin || isAssignee) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditingRemark(true)
                          setRemarkDialogOpen(true)
                        }}
                        className="h-5 w-5 p-0 hover:bg-primary/10"
                        title="Add remark"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Assign Sensor Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Assign Sensor - {sensor.name}</DialogTitle>
            <DialogDescription>
              Assign this sensor to a user, assignee, or engineer
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Currently Assigned Users */}
            <div className="space-y-2">
              <Label>Currently Assigned</Label>
              {isLoadingAssignedUsers ? (
                <div className="text-sm text-muted-foreground py-2">Loading assigned users...</div>
              ) : assignedUsers.length > 0 ? (
                <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
                  {assignedUsers.map((user) => (
                    <div
                      key={user.username}
                      className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                    >
                      <div>
                        <span className="font-medium">{user.full_name || user.username}</span>
                        <span className="text-muted-foreground ml-2">({user.role})</span>
                        {user.email && (
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleUnassignSensor(user.username)}
                        title="Unassign"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-2 border rounded-md p-2 bg-muted/30">
                  No users assigned to this sensor
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="assign-role">Select Role</Label>
              <select
                id="assign-role"
                value={selectedRole}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a role</option>
                <option value="user">User</option>
                <option value="assignee">Assignee</option>
                <option value="engineer">Engineer</option>
                <option value="technician">Technician</option>
              </select>
            </div>

            {selectedRole && (
              <div className="space-y-2">
                <Label htmlFor="assign-user">Select {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}</Label>
                {isLoadingUsers ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="text-sm text-muted-foreground">Loading users...</div>
                  </div>
                ) : usersByRole.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">
                    No {selectedRole}s found
                  </div>
                ) : (
                  <select
                    id="assign-user"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select a {selectedRole}</option>
                    {usersByRole.map((user) => (
                      <option key={user.username} value={user.username}>
                        {user.username} {user.email ? `(${user.email})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <Separator className="my-4" />

            {/* Share Access Link Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Generate Share Link (Permanent Access)</Label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowShareSection(!showShareSection)}
                  className="h-7 text-xs"
                >
                  {showShareSection ? "Hide" : "Show"}
                </Button>
              </div>

              {showShareSection && (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <div className="space-y-2">
                    <Label htmlFor="share-email">Email Address</Label>
                    <Input
                      id="share-email"
                      type="email"
                      placeholder="user@example.com"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                    />
                  </div>

                  {/* Duration hidden for permanent access */}
                  <div className="hidden">
                    <Label htmlFor="share-duration">Access Duration</Label>
                    <select
                      id="share-duration"
                      value={shareDuration}
                      onChange={(e) => setShareDuration(Number(e.target.value))}
                    >
                      <option value={87600}>Permanent</option>
                    </select>
                  </div>

                  <Button
                    size="sm"
                    onClick={handleGenerateShareLink}
                    disabled={!shareEmail || isGeneratingLink}
                    className="w-full"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {isGeneratingLink ? "Sending..." : "Generate & Send Link"}
                  </Button>

                  {/* Generated Link Display */}
                  {generatedLink && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs font-semibold">Generated Access Link</Label>
                      <div className="flex items-start gap-2 p-2 bg-background rounded border">
                        <a
                          href={generatedLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-xs text-primary hover:underline break-all"
                        >
                          {generatedLink}
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopyLink}
                          className="h-7 w-7 p-0 shrink-0 mt-0.5"
                          title="Copy link"
                        >
                          {linkCopied ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Click the link above to open it in a new tab, or copy it to share manually.
                      </p>
                    </div>
                  )}

                  {/* Active Tokens List */}
                  {isLoadingTokens ? (
                    <div className="text-xs text-muted-foreground py-2">Loading active links...</div>
                  ) : activeTokens.length > 0 ? (
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs font-semibold">Active Access Links</Label>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {activeTokens
                          .filter(t => !t.used && !t.revoked && new Date(t.expires_at) > new Date())
                          .map((token) => (
                            <div key={token.id} className="flex items-center justify-between gap-2 p-2 bg-background rounded border text-xs">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{token.email}</div>
                                <div className="text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Expires: {new Date(token.expires_at).toLocaleString()}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokeToken(token.id)}
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAssignDialogOpen(false)
                  setSelectedRole("")
                  setSelectedUser("")
                  setUsersByRole([])
                  setShareEmail("")
                  setShowShareSection(false)
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAssignSensor}
                disabled={!selectedRole || !selectedUser || isAssigning}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {isAssigning ? "Assigning..." : "Assign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remark Dialog */}
      <Dialog open={remarkDialogOpen} onOpenChange={setRemarkDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="font-semibold">Remark - {sensor.name}</DialogTitle>
              {(isAdmin || isAssignee) && !isEditingRemark && (
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
              {!isEditingRemark && sensor.remarkDate && (
                <span>Updated on {formatDate(sensor.remarkDate)}</span>
              )}
              {!isEditingRemark && !sensor.remarkDate && "Full remark text for this sensor"}
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
                    onClick={handleCancelEdit}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveRemark}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap wrap-break-word">
                {sensor.remark || "No remarks available"}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer with Button */}
      <CardFooter className="px-5 pb-4 pt-0">
        <Button
          className="w-full h-9 font-semibold shadow-sm hover:shadow-md transition-all duration-200 bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={handleMonitor}
        >
          Monitor This Location
        </Button>
      </CardFooter>
    </Card>
  )
}


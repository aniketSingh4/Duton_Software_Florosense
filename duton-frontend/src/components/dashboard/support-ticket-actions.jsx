"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { FileDown, LifeBuoy, ListChecks } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PRIORITY_LEVELS, ISSUE_TYPES } from "@/lib/support-tickets"
import { cn } from "@/lib/utils"
import { getClientUserContext } from "@/lib/user-context"
import { emitTicketRefresh } from "@/hooks/use-support-tickets"
import { useTicketSensors } from "@/hooks/use-ticket-sensors"
import { createSupportTicket, fetchSupportTickets, getUserSites } from "@/utils/api"

const initialFormState = {
  sensorId: "",
  sensorName: "",
  issueType: "",
  description: "",
  priority: "",
  fullName: "",
  location: "",
  raisedBy: "",
  image: null,
}

export function SupportTicketActions({
  showTicketCenterLink = true,
  ticketCenterHref = "/dashboard/tickets",
  hideRaiseTicket = false,
}) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const { sensors } = useTicketSensors({ enabled: createDialogOpen })
  const [createForm, setCreateForm] = useState(initialFormState)
  const [sensorSearch, setSensorSearch] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submissionToast, setSubmissionToast] = useState("")
  const [toastVariant, setToastVariant] = useState("success")
  const [imagePreview, setImagePreview] = useState(null)
  const [currentUser, setCurrentUser] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAssignee, setIsAssignee] = useState(false)
  const [isBuilder, setIsBuilder] = useState(false)
  const [assignedSites, setAssignedSites] = useState([])
  const uploadInputRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState("")

  const sensorOptions = useMemo(() => {
    let filteredSensors = sensors

    // Filter by assigned sites for builder/contractor users
    if (isBuilder && assignedSites.length > 0) {
      const assignedSiteNames = assignedSites.map(site => site.site_name).filter(Boolean)
      if (assignedSiteNames.length > 0) {
        filteredSensors = filteredSensors.filter((sensor) => 
          assignedSiteNames.includes(sensor.site_name)
        )
      }
    }

    return filteredSensors.map((sensor) => {
      const label = sensor.identifier || sensor.name || sensor.sensor_id || sensor.device_id
      const value = sensor.sensor_id || sensor.sensorId || sensor.identifier || sensor.device_id || sensor.name
      return {
        label: label || value || "Sensor",
        value: value || "",
      }
    })
  }, [sensors, isBuilder, assignedSites])

  const filteredSensorOptions = useMemo(() => {
    const query = sensorSearch.trim().toLowerCase()
    if (!query) return sensorOptions

    const queryNumbers = query.match(/\d+/g) || []
    const hasNumericQuery = queryNumbers.length > 0
    const numericQuery = queryNumbers.join("")

    const scored = sensorOptions
      .map((sensor) => {
        const label = (sensor.label || "").toLowerCase()
        const value = (sensor.value || "").toLowerCase()
        const text = `${label} ${value}`
        const sensorNumbers = text.match(/\d+/g) || []

        const matchesText = text.includes(query)
        const exactStartsWith = label.startsWith(query) || value.startsWith(query)

        let numericRank = 99
        if (hasNumericQuery) {
          const hasExactNumber = sensorNumbers.some((n) => n === numericQuery)
          const hasPrefixNumber = sensorNumbers.some((n) => n.startsWith(numericQuery))
          const hasContainsNumber = sensorNumbers.some((n) => n.includes(numericQuery))

          if (hasExactNumber) numericRank = 0
          else if (hasPrefixNumber) numericRank = 1
          else if (hasContainsNumber) numericRank = 2
        }

        const include =
          matchesText ||
          (hasNumericQuery && numericRank !== 99)

        if (!include) return null

        return {
          sensor,
          exactStartsWith: exactStartsWith ? 0 : 1,
          numericRank,
          label,
          value,
        }
      })
      .filter(Boolean)

    scored.sort((a, b) => {
      if (a.exactStartsWith !== b.exactStartsWith) {
        return a.exactStartsWith - b.exactStartsWith
      }
      if (a.numericRank !== b.numericRank) {
        return a.numericRank - b.numericRank
      }
      return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" })
    })

    return scored.map((entry) => entry.sensor)
  }, [sensorOptions, sensorSearch])

  const visibleSensorOptions = useMemo(() => {
    if (sensorSearch.trim()) return filteredSensorOptions
    if (!createForm.sensorId) return filteredSensorOptions
    if (filteredSensorOptions.some((sensor) => sensor.value === createForm.sensorId)) {
      return filteredSensorOptions
    }
    const selectedSensor = sensorOptions.find((sensor) => sensor.value === createForm.sensorId)
    return selectedSensor ? [selectedSensor, ...filteredSensorOptions] : filteredSensorOptions
  }, [createForm.sensorId, filteredSensorOptions, sensorOptions, sensorSearch])

  const selectedSensorLabel = useMemo(() => {
    const selected = sensorOptions.find((sensor) => sensor.value === createForm.sensorId)
    return selected?.label || ""
  }, [sensorOptions, createForm.sensorId])

  const getSensorAutofillValues = (sensorValue) => {
    const sensor = sensors.find((s) => {
      const value = s.sensor_id || s.sensorId || s.identifier || s.device_id || s.name
      return value === sensorValue
    })
    if (!sensor) return { fullName: "", location: "" }

    const fullName =
      sensor.site_name
      ""

    const location =
      (typeof sensor.location === "string" ? sensor.location : sensor.location?.address || sensor.location?.address_line) ||
      sensor.site_name ||
      ""

    return { fullName, location }
  }

  useEffect(() => {
    if (!createForm.sensorId && sensorOptions.length > 0) {
      setCreateForm((prev) => ({
        ...prev,
        sensorId: sensorOptions[0].value,
        sensorName: sensorOptions[0].label,
      }))
    }
  }, [sensorOptions, createForm.sensorId])

  useEffect(() => {
    if (!submissionToast) return
    const timer = setTimeout(() => setSubmissionToast(""), 4000)
    return () => clearTimeout(timer)
  }, [submissionToast])

  // Resolve user role from token/localStorage to avoid extra network calls.
  useEffect(() => {
    const checkUserRole = () => {
      if (typeof window === "undefined") return
      const userContext = getClientUserContext()
      setCurrentUser(userContext.username)
      setIsAdmin(userContext.isAdmin)
      setIsAssignee(userContext.isAssignee)
      setIsBuilder(userContext.isBuilder)
    }
    
    checkUserRole()
  }, [])

  // Fetch assigned sites for builder/contractor users
  useEffect(() => {
    if (!isBuilder) return

    const fetchSites = async () => {
      try {
        const username = typeof window !== "undefined" ? window.localStorage.getItem("duton_username") : null
        if (!username) return

        const sites = await getUserSites(username)
        setAssignedSites(sites || [])
      } catch (error) {
        console.error("[SupportTicketActions] Error fetching assigned sites:", error)
      }
    }

    fetchSites()
  }, [isBuilder])

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return
    const video = videoRef.current
    video.srcObject = streamRef.current

    const handleLoaded = () => {
      video.play().catch(() => {})
    }

    if (video.readyState >= 2) handleLoaded()
    else video.addEventListener("loadedmetadata", handleLoaded)

    return () => {
      video.pause()
      video.srcObject = null
    }
  }, [cameraOpen])

  const showToast = (message, variant = "success") => {
    setToastVariant(variant)
    setSubmissionToast(message)
  }

  const handleCreateTicket = async (event) => {
    event.preventDefault()
    if (!createForm.sensorId) {
      showToast("Please select a sensor before submitting a ticket.", "error")
      return
    }

    if (!createForm.issueType || !createForm.description.trim()) return

    const ownerIdentifier = (currentUser || "").trim() || createForm.fullName.trim()
    const sensorIdentifier = createForm.sensorId

    setSubmitting(true)
    try {
      const tickets = await fetchSupportTickets()
      const activeStatuses = ["Open", "In Progress"]
      const userTickets = tickets.filter((ticket) => {
        const ticketOwner = (ticket.createdBy || ticket.fullName || "").trim()
        return ticketOwner && ticketOwner.toLowerCase() === ownerIdentifier.toLowerCase()
      })
      const activeTickets = userTickets.filter((ticket) => activeStatuses.includes(ticket.status))

      if (!isAdmin) {
        if (activeTickets.length >= 4) {
          showToast("You already have the maximum number of active tickets (4).", "error")
          return
        }

        const hasSensorTicket = activeTickets.some((ticket) => {
          const ticketSensor = ticket.sensorId || ticket.sensorName || ""
          return ticketSensor === sensorIdentifier
        })

        if (hasSensorTicket) {
          showToast("You already have an active ticket for this sensor.", "error")
          return
        }
      }

      await createSupportTicket({
        sensorId: createForm.sensorId,
        sensorName: createForm.sensorName,
        issueType: createForm.issueType,
        description: createForm.description.trim(),
        priority: createForm.priority || null, // No priority assigned by users, only admins can set it
        fullName: createForm.fullName.trim(),
        location: createForm.location.trim(),
        raisedBy: createForm.raisedBy.trim(),
        image: createForm.image,
        createdBy: currentUser || undefined,
      })

      setCreateForm(initialFormState)
      setImagePreview(null)
      setCameraOpen(false)
      setCreateDialogOpen(false)
      showToast("Ticket submitted successfully.")
      emitTicketRefresh()
    } catch (error) {
      showToast(error?.message || "Unable to submit ticket right now.", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const inputLikeClass =
    "border-input h-10 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-all"

  const handleSelectedImage = (file) => {
    setCreateForm((prev) => ({ ...prev, image: file }))
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (file) handleSelectedImage(file)
    event.target.value = ""
  }

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraOpen(false)
  }

  const startCamera = async (constraints) => {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    streamRef.current = stream
    setCameraError("")
    setCameraOpen(true)
  }

  const handleOpenCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not supported in this browser.")
      return
    }
    try {
      await startCamera({ video: { facingMode: { ideal: "environment" } }, audio: false })
    } catch (error) {
      try {
        await startCamera({ video: true, audio: false })
      } catch (fallbackErr) {
        setCameraError("Unable to access camera. Please allow permissions.")
      }
    }
  }

  const handleCapturePhoto = () => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext("2d")
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `ticket-photo-${Date.now()}.jpg`, { type: "image/jpeg" })
        handleSelectedImage(file)
        stopCameraStream()
      },
      "image/jpeg",
      0.9
    )
  }

  const toastColorClass =
    toastVariant === "error"
      ? "border-red-300 bg-white text-red-700"
      : "border-emerald-300 bg-white text-emerald-700"

  return (
    <>
      {(isAdmin || isAssignee || !hideRaiseTicket) && (
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="whitespace-nowrap">
              <LifeBuoy className="size-4" />
              Raise Ticket
            </Button>
          </DialogTrigger>

        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create support ticket</DialogTitle>
            <DialogDescription>Share a short summary of the issue.</DialogDescription>
          </DialogHeader>

          {/* SUPPORT PPT DOWNLOAD BOX */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <p className="max-w-[380px]">Need help? Download the support guideline PPT.</p>
            <Button size="sm" variant="secondary" className="gap-2" asChild>
              <a href="/support-ticket-guidelines.pptx" download="support-ticket-guidelines.pptx">
                <FileDown className="h-4 w-4" />
                Download PPT
              </a>
            </Button>
          </div>

          {/* CONTENT SCROLL AREA */}
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            {/* CAMERA (NOW INSIDE DIALOG!) */}
            {cameraOpen && (
              <div className="mt-4 rounded-lg border p-3 bg-muted/30">
                <div className="rounded-lg border bg-black/40">
                  <video
                    ref={videoRef}
                    className="h-48 w-full rounded-lg object-cover"
                    playsInline
                    autoPlay
                    muted
                  />
                </div>

                {cameraError && (
                  <p className="text-sm text-destructive mt-1">{cameraError}</p>
                )}

                <div className="flex gap-2 mt-3">
                  <Button className="flex-1" onClick={handleCapturePhoto}>
                    Capture photo
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={stopCameraStream}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* MAIN FORM */}
            <form id="ticket-form" className="space-y-4 mt-4" onSubmit={handleCreateTicket}>
              <div className="space-y-2 ml-2">
                <Label>Sensor</Label>
                <Select
                  value={createForm.sensorId}
                  onValueChange={(value) => {
                    const selected = sensorOptions.find((o) => o.value === value)
                    const autofill = getSensorAutofillValues(value)
                    setCreateForm({
                      ...createForm,
                      sensorId: value,
                      sensorName: selected?.label || "",
                      fullName: autofill.fullName,
                      location: autofill.location,
                    })
                    setSensorSearch("")
                  }}
                >
                  <SelectTrigger className={inputLikeClass}>
                    <span className="truncate text-left">
                      {selectedSensorLabel || "Select sensor"}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <div className="sticky top-0 z-10 border-b bg-popover p-2">
                      <input
                        type="text"
                        placeholder="Search sensor..."
                        value={sensorSearch}
                        onChange={(e) => setSensorSearch(e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    {visibleSensorOptions.length === 0 && (
                      <div className="px-2 py-2 text-sm text-muted-foreground">
                        No matching sensors found
                      </div>
                    )}
                    {visibleSensorOptions.map((sensor) => (
                      <SelectItem key={sensor.value} value={sensor.value}>
                        {sensor.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="hidden"
                  required
                  value={createForm.sensorId}
                  onChange={() => {}}
                />
              </div>

              <div className="space-y-2 ml-2">
                <Label>Full Name</Label>
                <input
                  required
                  placeholder="Enter your full name"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  className={inputLikeClass}
                />
              </div>

              <div className="space-y-2 ml-2">
                <Label>Location</Label>
                <input
                  required
                  placeholder="Enter location/site"
                  value={createForm.location}
                  onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                  className={inputLikeClass}
                />
              </div>

              <div className="space-y-2 ml-2">
                <Label>Raised By</Label>
                <input
                  required
                  placeholder="Enter who raised the ticket"
                  value={createForm.raisedBy}
                  onChange={(e) => setCreateForm({ ...createForm, raisedBy: e.target.value })}
                  className={inputLikeClass}
                />
              </div>

              <div className="space-y-2 ml-2">
                <Label>Issue type</Label>
                <select
                  required
                  value={createForm.issueType}
                  onChange={(e) => setCreateForm({ ...createForm, issueType: e.target.value })}
                  className={inputLikeClass}
                >
                  <option value="">Select issue</option>
                  {ISSUE_TYPES.map((issue) => (
                    <option key={issue} value={issue}>
                      {issue}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 ml-2">
                <Label>Description</Label>
                <Textarea
                  required
                  placeholder="Describe the issue"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>

              {/* UPLOAD / CAMERA OPTIONS */}
              <div className="space-y-2 ml-2">
                <Label>Upload Image (Optional)</Label>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button 
                    type="button"
                    variant="outline" 
                    className="flex-1" 
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    Upload from device
                  </Button>

                  <Button 
                    type="button"
                    variant="outline" 
                    className="flex-1" 
                    onClick={handleOpenCamera}
                  >
                    Click photo
                  </Button>
                </div>

                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {imagePreview && (
                  <div className="mt-2">
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      width={200}
                      height={130}
                      unoptimized
                      className="max-h-32 rounded-md border object-contain"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setImagePreview(null)
                        setCreateForm((prev) => ({ ...prev, image: null }))
                      }}
                    >
                      Remove Image
                    </Button>
                  </div>
                )}
              </div>
            </form>
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t">
            <Button type="submit" form="ticket-form" disabled={submitting}>
              Submit ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* Ticket Center Button */}
      {showTicketCenterLink && (
        <Button asChild variant="secondary" size="sm" className="whitespace-nowrap">
          <Link href={ticketCenterHref}>
            <ListChecks className="size-4" />
            Ticket Center
          </Link>
        </Button>
      )}

      {/* Toast */}
      {submissionToast && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50">
          <div
            className={cn(
              "min-w-[320px] max-w-lg animate-pop rounded-lg border px-6 py-3 text-base font-medium shadow-2xl",
              toastColorClass
            )}
          >
            {submissionToast}
          </div>
        </div>
      )}
    </>
  )
}

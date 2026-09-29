"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ChevronDown, ListChecks, SendHorizonal, UserRoundPlus, Upload, X, Download } from "lucide-react"

import { SupportTicketActions } from "@/components/dashboard/support-ticket-actions"
import { TicketEditDialog } from "@/components/dashboard/ticket-edit-dialog"
import { AssigneePerformanceModal } from "@/components/dashboard/assignee-performance-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PRIORITY_LEVELS, STATUS_FLOW } from "@/lib/support-tickets"
import { useSupportTickets } from "@/hooks/use-support-tickets"
import { useTicketSensors } from "@/hooks/use-ticket-sensors"
import { addSupportTicketReply, updateSupportTicket, deleteSupportTicket, fetchAssignees, getUserSites, createAssignee, updateAssignee, deleteAssignee } from "@/utils/api"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MoreVertical, Pencil, Trash2, BarChart3 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { cn, formatDateTime } from "@/lib/utils"
import ExcelJS from "exceljs"

const inputLikeClass =
  "border-input h-10 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"

export default function TicketCenterPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const { sensors } = useTicketSensors({ enabled: isAuthenticated })
  const [filters, setFilters] = useState({
    status: "all",
    priority: "all",
    sensor: "all",
    search: "",
    assignee: "all", // New filter for assignee
    resolutionTime: "all", // Filter for resolution time delay
  })
  const [searchInput, setSearchInput] = useState("")
  const searchTimeoutRef = useRef(null)
  const updateQueueRef = useRef(Promise.resolve())
  const [selectedAssignee, setSelectedAssignee] = useState("all")
  const [assignmentDrafts, setAssignmentDrafts] = useState({})
  const [replyDrafts, setReplyDrafts] = useState({})
  const [openTicketKey, setOpenTicketKey] = useState(null)

  // Calculate work percentage based on ticket status
  const calculateWorkPercentage = (status) => {
    const statusMap = {
      "Open": 0,
      "In Progress": 50,
      "Resolved": 90,
      "Closed": 100,
    }
    return statusMap[status] ?? 0
  }
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [assignees, setAssignees] = useState([])
  const [loadingAssignees, setLoadingAssignees] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAssignee, setIsAssignee] = useState(false)
  const [isRestricted, setIsRestricted] = useState(false)
  const [isBuilder, setIsBuilder] = useState(false)
  const [assignedSites, setAssignedSites] = useState([])
  const [assigneeUsername, setAssigneeUsername] = useState("")
  const [centerTab, setCenterTab] = useState("tickets")
  const [createAssigneeDialogOpen, setCreateAssigneeDialogOpen] = useState(false)
  const [creatingAssignee, setCreatingAssignee] = useState(false)
  const [editingAssignee, setEditingAssignee] = useState(null)
  const [editAssigneeForm, setEditAssigneeForm] = useState({
    fullName: "",
    email: "",
    password: "",
    isActive: true,
  })
  const [savingAssignee, setSavingAssignee] = useState(false)
  const [deleteAssigneeTarget, setDeleteAssigneeTarget] = useState(null)
  const [deletingAssignee, setDeletingAssignee] = useState(false)
  const [newAssignee, setNewAssignee] = useState({
    fullName: "",
    email: "",
    username: "",
    password: "",
    sendCredentialsEmail: true,
  })
  const [imageFiles, setImageFiles] = useState({}) // { ticketId: [File, File, ...] }
  const [imagePreviews, setImagePreviews] = useState({}) // { ticketId: [preview1, preview2, ...] }
  const [uploadingImage, setUploadingImage] = useState({})
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false)
  const [customDateDialogOpen, setCustomDateDialogOpen] = useState(false)
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [closeTicketDialog, setCloseTicketDialog] = useState(null) // { ticketId, ticketLabel, closedBy }
  const [closingTicket, setClosingTicket] = useState(false)

  // Check if current user is admin, assignee, or restricted role by checking role from backend or JWT token
  useEffect(() => {
    const checkUserRole = async () => {
      if (typeof window === "undefined") return

      let role = null
      const username = window.localStorage.getItem("duton_username") || ""
      setAssigneeUsername(username)

      // First, set immediately from localStorage for faster UI update
      const userType = window.localStorage.getItem("duton_user_type")
      if (userType === "admin") {
        setIsAdmin(true)
        setIsAssignee(false)
        setIsRestricted(false)
      } else if (userType === "assignee") {
        setIsAdmin(false)
        setIsAssignee(true)
        setIsRestricted(false)
      } else if (["user", "builder", "contractor"].includes(userType)) {
        setIsAdmin(false)
        setIsAssignee(false)
        setIsRestricted(true)
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
        const userRole = window.localStorage.getItem("duton_user_role")
        if (userType === "admin") role = "admin"
        else if (userType === "assignee") role = "assignee"
        else if (userRole === "builder" || userRole === "contractor") role = userRole
        else if (userType === "user" && (userRole === "builder" || userRole === "contractor")) role = userRole
        else role = userType
      }

      // Set states based on role
      setIsAdmin(role === "admin")
      setIsAssignee(role === "assignee")
      setIsRestricted(["user", "builder", "contractor"].includes(role))
      setIsBuilder(role === "builder" || role === "contractor")
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
        console.error("[TicketCenter] Error fetching assigned sites:", error)
      }
    }

    fetchSites()
  }, [isBuilder])

  // Fetch assignees for admin users from database
  useEffect(() => {
    if (!isAdmin || !isAuthenticated) {
      return
    }

    const loadAssignees = async () => {
      setLoadingAssignees(true)
      try {
        const data = await fetchAssignees()

        if (Array.isArray(data)) {
          setAssignees(data)
        } else {
          setAssignees([])
        }
      } catch (error) {
        console.error("Failed to load assignees from database:", error)
        toast.error("Failed to load assignees from database: " + error.message)
        setAssignees([])
      } finally {
        setLoadingAssignees(false)
      }
    }

    loadAssignees()
  }, [isAdmin, isAuthenticated])

  useEffect(() => {
    if (typeof window === "undefined") return
    const token = window.localStorage.getItem("duton_access_token")
    if (!token) {
      setIsAuthenticated(false)
      router.push("/login")
    } else {
      setIsAuthenticated(true)
    }
    setAuthChecked(true)
  }, [router])
  const apiFilters = useMemo(() => {
    return {
      status: filters.status !== "all" ? filters.status : undefined,
      priority: filters.priority !== "all" ? filters.priority : undefined,
      sensorId: filters.sensor !== "all" ? filters.sensor : undefined,
      search: filters.search?.trim() ? filters.search.trim() : undefined,
    }
  }, [filters])

  const { tickets: allTickets, loading, error, refetch } = useSupportTickets(apiFilters, {
    enabled: isAuthenticated,
  })

  // Helper function to calculate resolution time in hours
  const calculateResolutionTimeHours = (ticket) => {
    const created = ticket.createdAt || ticket.created_at
    if (!created) return null

    const createdDate = new Date(created)
    const closedDate = ticket.closedAt || ticket.closed_at ? new Date(ticket.closedAt || ticket.closed_at) : new Date()
    const diffMs = closedDate.getTime() - createdDate.getTime()
    return diffMs / (1000 * 60 * 60) // Convert to hours
  }

  // Filter tickets for assignees - they should see tickets assigned to them OR tickets they created
  // Also filter by selected assignee for admin users
  // Also filter by resolution time delay
  const tickets = useMemo(() => {
    let filtered = allTickets

    // Filter for assignee users (they see tickets assigned to them OR tickets they created)
    if (isAssignee && assigneeUsername) {
      filtered = filtered.filter((ticket) => {
        const ticketAssignee = ticket.assignee || ""
        const ticketCreatedBy = ticket.createdBy || ticket.created_by || ticket.fullName || ticket.full_name || ""
        const isAssignedToMe = ticketAssignee.toLowerCase() === assigneeUsername.toLowerCase()
        const isCreatedByMe = ticketCreatedBy.toLowerCase() === assigneeUsername.toLowerCase()
        return isAssignedToMe || isCreatedByMe
      })
    }

    // Filter for restricted users (user, builder, contractor) - they only see tickets they created
    if (isRestricted && assigneeUsername) {
      filtered = filtered.filter((ticket) => {
        const ticketCreatedBy = ticket.createdBy || ticket.created_by || ticket.fullName || ticket.full_name || ""
        return ticketCreatedBy.toLowerCase() === assigneeUsername.toLowerCase()
      })
    }

    // Filter by selected assignee for admin users
    if (isAdmin && selectedAssignee !== "all") {
      filtered = filtered.filter((ticket) => {
        const ticketAssignee = ticket.assignee || ""
        return ticketAssignee.toLowerCase() === selectedAssignee.toLowerCase()
      })
    }

    // Filter by resolution time delay
    if (filters.resolutionTime !== "all") {
      filtered = filtered.filter((ticket) => {
        const resolutionHours = calculateResolutionTimeHours(ticket)
        if (resolutionHours === null) return false

        switch (filters.resolutionTime) {
          case "more_than_1_day":
            return resolutionHours > 24
          case "more_than_3_days":
            return resolutionHours > 72
          case "more_than_1_week":
            return resolutionHours > 168
          case "more_than_2_weeks":
            return resolutionHours > 336
          case "more_than_1_month":
            return resolutionHours > 720
          default:
            return true
        }
      })
    }

    return filtered
  }, [allTickets, isAssignee, assigneeUsername, isAdmin, selectedAssignee, filters.resolutionTime, isRestricted])

  // Helper function to format resolution time for Excel
  const formatResolutionTimeForExcel = (ticket) => {
    const created = ticket.createdAt || ticket.created_at
    if (!created) return "N/A"

    const createdDate = new Date(created)
    const closedDate = ticket.closedAt || ticket.closed_at ? new Date(ticket.closedAt || ticket.closed_at) : new Date()
    const diffMs = closedDate.getTime() - createdDate.getTime()

    if (isNaN(diffMs) || diffMs < 0) return "N/A"

    const diffSeconds = Math.floor(diffMs / 1000)
    const days = Math.floor(diffSeconds / (3600 * 24))
    const hours = Math.floor((diffSeconds % (3600 * 24)) / 3600)
    const minutes = Math.floor((diffSeconds % 3600) / 60)

    let timeString = []
    if (days > 0) timeString.push(`${days} day${days > 1 ? "s" : ""}`)
    if (hours > 0) timeString.push(`${hours} hour${hours > 1 ? "s" : ""}`)
    if (minutes > 0) timeString.push(`${minutes} minute${minutes > 1 ? "s" : ""}`)

    if (timeString.length === 0) return "Less than a minute"
    return timeString.join(" ") + (ticket.status !== "Closed" ? " (pending)" : "")
  }

  const filterTicketsByExportDateRange = (ticketList, dateRange) => {
    if (!dateRange || dateRange === "all") return ticketList

    const now = new Date()
    const startDate = new Date()

    switch (dateRange) {
      case "today":
        startDate.setHours(0, 0, 0, 0)
        break
      case "week":
        startDate.setDate(now.getDate() - 7)
        break
      case "month":
        startDate.setMonth(now.getMonth() - 1)
        break
      default:
        return ticketList
    }

    return ticketList.filter((ticket) => {
      const created = ticket.createdAt || ticket.created_at
      if (!created) return false
      const createdDate = new Date(created)
      return createdDate >= startDate && createdDate <= now
    })
  }

  // Export tickets to Excel
  const handleExportToExcel = async (dateRange = "all", customStart = null, customEnd = null) => {
    let ticketsToExport
    if (dateRange === "custom" && customStart && customEnd) {
      ticketsToExport = tickets.filter((ticket) => {
        const created = ticket.createdAt || ticket.created_at
        if (!created) return false
        const createdDate = new Date(created)
        return createdDate >= customStart && createdDate <= customEnd
      })
    } else {
      ticketsToExport = filterTicketsByExportDateRange(tickets, dateRange)
    }

    if (!ticketsToExport || ticketsToExport.length === 0) {
      toast.error("No tickets to export")
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet("Tickets")

      // Define columns
      worksheet.columns = [
        { header: "Ticket ID", key: "ticketId", width: 15 },
        { header: "Title", key: "title", width: 30 },
        { header: "Description", key: "description", width: 40 },
        { header: "Status", key: "status", width: 12 },
        { header: "Priority", key: "priority", width: 12 },
        { header: "Sensor", key: "sensor", width: 20 },
        { header: "Assignee", key: "assignee", width: 20 },
        { header: "Raised By", key: "raisedBy", width: 20 },
        { header: "Location", key: "location", width: 25 },
        { header: "Created Date", key: "created", width: 20 },
        { header: "Closed Date", key: "closed", width: 20 },
        { header: "Closed By", key: "closedBy", width: 20 },
        { header: "Updated Date", key: "updated", width: 20 },
        { header: "Resolution Time", key: "resolution", width: 25 },
        { header: "Work Progress", key: "progress", width: 15 },
        { header: "Replies Count", key: "replies", width: 15 },
      ]

      // Format header row
      worksheet.getRow(1).font = { bold: true }

      // Add data rows
      ticketsToExport.forEach((ticket) => {
        const created = ticket.createdAt || ticket.created_at
        const closed = ticket.closedAt || ticket.closed_at
        const updated = ticket.updatedAt || ticket.updated_at

        worksheet.addRow({
          ticketId: ticket.id || ticket.ticketId || "N/A",
          // FIX 1: Look for the camelCase 'issueType' first!
          title: ticket.issueType || ticket.issue_type || ticket.title || "N/A",
          description: ticket.description || "N/A",
          status: ticket.status || "N/A",
          priority: ticket.priority || "N/A",
          sensor: ticket.sensorName || ticket.sensorId || "Not linked",
          // FIX 2: Look for camelCase 'pendingAssignee'
          assignee: ticket.assignee || ticket.pendingAssignee || "Unassigned",
          raisedBy: ticket.raisedBy || "",
          location: ticket.location || "N/A",
          created: created ? formatDateTime(new Date(created)) : "N/A",
          closed: closed ? formatDateTime(new Date(closed)) : "N/A",
          closedBy: ticket.closedBy || ticket.closed_by || "N/A",
          updated: updated ? formatDateTime(new Date(updated)) : "N/A",
          resolution: formatResolutionTimeForExcel(ticket),
          progress: ticket.status ? `${calculateWorkPercentage(ticket.status)}%` : "0%",
          replies: ticket.replies?.length || 0,
        })
      })

      // Generate filename with current date and filters
      const now = new Date()
      const dateStr = now.toISOString().split("T")[0]
      let filename = `tickets_export_${dateStr}`

      // Add filter info to filename
      const filterParts = []
      if (filters.status !== "all") filterParts.push(`status_${filters.status}`)
      if (filters.priority !== "all") filterParts.push(`priority_${filters.priority}`)
      if (filters.sensor !== "all") {
        const sensorName = sensors.find(s => {
          const sensorValue = s.sensor_id || s.sensorId || s.identifier || s.device_id || s.name
          return sensorValue === filters.sensor
        })?.name || filters.sensor
        filterParts.push(`sensor_${sensorName.replace(/\s+/g, "_")}`)
      }
      if (selectedAssignee !== "all") filterParts.push(`assignee_${selectedAssignee.replace(/\s+/g, "_")}`)
      if (filters.resolutionTime !== "all") filterParts.push(`resolution_${filters.resolutionTime.replace(/\s+/g, "_")}`)
      if (dateRange === "today") filterParts.push("today")
      if (dateRange === "week") filterParts.push("last_7_days")
      if (dateRange === "month") filterParts.push("last_month")
      if (dateRange === "custom" && customStart && customEnd) {
        const startStr = customStart.toISOString().split("T")[0]
        const endStr = customEnd.toISOString().split("T")[0]
        filterParts.push(`custom_${startStr}_to_${endStr}`)
      }

      if (filterParts.length > 0) {
        filename += `_${filterParts.join("_")}`
      }

      // Trigger download
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${filename}.xlsx`
      link.click()

      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(`Exported ${ticketsToExport.length} ticket(s) to Excel`)
    } catch (error) {
      console.error("Error exporting to Excel:", error)
      toast.error("Failed to export tickets to Excel")
    }
  }

  // Calculate assignee statistics (admin only)
  const assigneeStats = useMemo(() => {
    if (!isAdmin || selectedAssignee === "all") {
      return null
    }

    const assigneeTickets = allTickets.filter((ticket) => {
      const ticketAssignee = ticket.assignee || ""
      return ticketAssignee.toLowerCase() === selectedAssignee.toLowerCase()
    })

    const totalTasks = assigneeTickets.length
    const completedTasks = assigneeTickets.filter((ticket) => ticket.status === "Closed").length
    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    return {
      totalTasks,
      completedTasks,
      completionPercentage,
    }
  }, [allTickets, selectedAssignee, isAdmin])

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
      const value = sensor.sensor_id || sensor.sensorId || sensor.identifier || sensor.device_id || sensor.name
      return {
        label: value || "Sensor",
        value: value,
      }
    })
  }, [sensors, isBuilder, assignedSites])

  const handleUpdateTicket = async (ticketId, payload) => {
    const task = updateQueueRef.current
      .catch(() => { })
      .then(async () => {
        await updateSupportTicket(ticketId, payload)
        refetch()
      })

    updateQueueRef.current = task.catch(() => { })

    try {
      await task
      return true
    } catch (err) {
      console.error("Failed to update ticket", err)
      alert(err?.message || "Unable to update ticket right now.")
      return false
    }
  }

  // Closing a ticket requires capturing who closed it, so route the "Closed"
  // status through a confirmation dialog instead of updating immediately.
  const handleStatusChange = (ticket, nextStatus, ticketLabel) => {
    if (nextStatus === "Closed" && ticket.status !== "Closed") {
      setCloseTicketDialog({
        ticketId: ticket.id,
        ticketLabel,
        closedBy: ticket.closedBy || assigneeUsername || "",
      })
      return
    }
    handleUpdateTicket(ticket.id, { status: nextStatus })
  }

  const handleConfirmCloseTicket = async () => {
    if (!closeTicketDialog) return

    const closedBy = closeTicketDialog.closedBy.trim()
    if (!closedBy) {
      toast.error("Please enter who is closing this ticket")
      return
    }

    setClosingTicket(true)
    try {
      const succeeded = await handleUpdateTicket(closeTicketDialog.ticketId, {
        status: "Closed",
        closedBy,
      })
      if (!succeeded) return
      setCloseTicketDialog(null)
      toast.success(`Ticket closed by ${closedBy}`, { position: "bottom-right" })
    } finally {
      setClosingTicket(false)
    }
  }

  const handleImageSelect = (ticketId, files) => {
    if (!files || files.length === 0) return

    const validFiles = []
    const fileArray = Array.from(files)

    fileArray.forEach((file) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`)
        return
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`)
        return
      }

      validFiles.push(file)
    })

    if (validFiles.length === 0) return

    // Add files to state
    setImageFiles((prev) => ({
      ...prev,
      [ticketId]: [...(prev[ticketId] || []), ...validFiles]
    }))

    // Create previews for all valid files
    const previewPromises = validFiles.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          resolve(reader.result)
        }
        reader.readAsDataURL(file)
      })
    })

    Promise.all(previewPromises).then((previews) => {
      setImagePreviews((prev) => ({
        ...prev,
        [ticketId]: [...(prev[ticketId] || []), ...previews]
      }))
    })
  }

  const handleImageUpload = async (ticketId) => {
    const files = imageFiles[ticketId]
    if (!files || files.length === 0) return

    setUploadingImage((prev) => ({ ...prev, [ticketId]: true }))
    try {
      await handleUpdateTicket(ticketId, { images: files })
      toast.success(`${files.length} image(s) uploaded successfully`, {
        position: "bottom-right",
      })
      // Clear previews immediately after successful upload
      setImageFiles((prev) => {
        const newState = { ...prev }
        delete newState[ticketId]
        return newState
      })
      setImagePreviews((prev) => {
        const newState = { ...prev }
        delete newState[ticketId]
        return newState
      })
      // Refetch will be called by handleUpdateTicket, which will update the ticket list with new images
    } catch (err) {
      console.error("Failed to upload images", err)
      toast.error(err?.message || "Unable to upload images right now.", {
        position: "bottom-right",
      })
    } finally {
      setUploadingImage((prev) => {
        const newState = { ...prev }
        delete newState[ticketId]
        return newState
      })
    }
  }

  const handleRemoveImagePreview = (ticketId, index) => {
    setImageFiles((prev) => {
      const newState = { ...prev }
      if (newState[ticketId]) {
        newState[ticketId] = newState[ticketId].filter((_, i) => i !== index)
        if (newState[ticketId].length === 0) {
          delete newState[ticketId]
        }
      }
      return newState
    })
    setImagePreviews((prev) => {
      const newState = { ...prev }
      if (newState[ticketId]) {
        newState[ticketId] = newState[ticketId].filter((_, i) => i !== index)
        if (newState[ticketId].length === 0) {
          delete newState[ticketId]
        }
      }
      return newState
    })
  }


  const handleReply = async (ticketId) => {
    const draft = replyDrafts[ticketId]
    if (!draft?.trim()) return
    try {
      await addSupportTicketReply(ticketId, {
        author: "You",
        message: draft.trim(),
      })
      setReplyDrafts((prev) => ({ ...prev, [ticketId]: "" }))
      refetch()
    } catch (err) {
      console.error("Failed to add reply", err)
      alert(err?.message || "Unable to add reply right now.")
    }
  }

  const handleEdit = (ticket) => {
    setSelectedTicket(ticket)
    setEditDialogOpen(true)
  }

  const handleDelete = async (ticket) => {
    if (!window.confirm(`Are you sure you want to delete ticket "${ticket.issueType}"? This action cannot be undone.`)) {
      return
    }
    try {
      await deleteSupportTicket(ticket.id)
      toast.success("Ticket deleted successfully")
      refetch()
    } catch (err) {
      console.error("Failed to delete ticket", err)
      toast.error(err?.message || "Unable to delete ticket right now.")
    }
  }

  const handleSaveEdit = async (updatedTicket) => {
    if (updatedTicket.status === "Closed" && !updatedTicket.closedBy?.trim()) {
      toast.error("Please enter who is closing this ticket")
      return
    }

    try {
      // Keys must stay camelCase - updateSupportTicket maps them to snake_case.
      await handleUpdateTicket(updatedTicket.id, {
        issueType: updatedTicket.issueType,
        description: updatedTicket.description,
        priority: updatedTicket.priority,
        status: updatedTicket.status,
        sensorId: updatedTicket.sensorId,
        fullName: updatedTicket.fullName,
        location: updatedTicket.location,
        assignee: updatedTicket.assignee,
        closedBy: updatedTicket.status === "Closed" ? updatedTicket.closedBy.trim() : "",
      })
      toast.success("Ticket updated successfully")
      setEditDialogOpen(false)
      setSelectedTicket(null)
      refetch()
    } catch (err) {
      console.error("Failed to update ticket", err)
      toast.error(err?.message || "Unable to update ticket right now.")
    }
  }

  const handleCreateAssignee = async () => {
    if (!newAssignee.fullName.trim() || !newAssignee.email.trim() || !newAssignee.username.trim() || !newAssignee.password) {
      toast.error("Please fill name, email, username, and password")
      return
    }

    try {
      setCreatingAssignee(true)
      const response = await createAssignee({
        full_name: newAssignee.fullName.trim(),
        email: newAssignee.email.trim(),
        username: newAssignee.username.trim(),
        password: newAssignee.password,
        send_credentials_email: newAssignee.sendCredentialsEmail,
      })

      const refreshedAssignees = await fetchAssignees()
      setAssignees(Array.isArray(refreshedAssignees) ? refreshedAssignees : [])

      toast.success(
        response?.email_sent
          ? "Assignee created and credentials email sent"
          : "Assignee created successfully"
      )

      setCreateAssigneeDialogOpen(false)
      setNewAssignee({
        fullName: "",
        email: "",
        username: "",
        password: "",
        sendCredentialsEmail: true,
      })
    } catch (error) {
      toast.error(error?.message || "Failed to create assignee")
    } finally {
      setCreatingAssignee(false)
    }
  }

  const openEditAssignee = (assignee) => {
    setEditingAssignee(assignee)
    setEditAssigneeForm({
      fullName: assignee.full_name || "",
      email: assignee.email || "",
      password: "",
      isActive: assignee.is_active !== false,
    })
  }

  const handleSaveAssignee = async () => {
    if (!editingAssignee?.username) return
    if (!editAssigneeForm.fullName.trim() || !editAssigneeForm.email.trim()) {
      toast.error("Please fill name and email")
      return
    }
    if (editAssigneeForm.password && editAssigneeForm.password.length < 6) {
      toast.error("Password must be at least 6 characters long")
      return
    }

    try {
      setSavingAssignee(true)
      await updateAssignee(editingAssignee.username, {
        full_name: editAssigneeForm.fullName.trim(),
        email: editAssigneeForm.email.trim(),
        password: editAssigneeForm.password,
        is_active: editAssigneeForm.isActive,
      })
      const refreshedAssignees = await fetchAssignees()
      setAssignees(Array.isArray(refreshedAssignees) ? refreshedAssignees : [])
      toast.success("Assignee updated successfully")
      setEditingAssignee(null)
    } catch (error) {
      toast.error(error?.message || "Failed to update assignee")
    } finally {
      setSavingAssignee(false)
    }
  }

  const handleDeleteAssignee = async () => {
    if (!deleteAssigneeTarget?.username) return
    try {
      setDeletingAssignee(true)
      await deleteAssignee(deleteAssigneeTarget.username)
      const refreshedAssignees = await fetchAssignees()
      setAssignees(Array.isArray(refreshedAssignees) ? refreshedAssignees : [])
      toast.success("Assignee deleted successfully")
      setDeleteAssigneeTarget(null)
    } catch (error) {
      toast.error(error?.message || "Failed to delete assignee")
    } finally {
      setDeletingAssignee(false)
    }
  }

  const renderTicketStatusBadge = (status) => {
    const statusStyles = {
      Open: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200",
      "In Progress": "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100",
      Resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100",
      Closed: "bg-slate-200 text-slate-800 dark:bg-slate-600/30 dark:text-slate-200",
    }
    return (
      <Badge className={statusStyles[status] || ""}>
        {status}
      </Badge>
    )
  }

  const renderPriorityBadge = (priority) => {
    const priorityStyles = {
      Low: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-100",
      Medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100",
      High: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-100",
      Critical: "bg-red-600 text-white dark:bg-red-500 dark:text-white",
    }
    return (
      <Badge className={priorityStyles[priority] || ""}>
        {priority}
      </Badge>
    )
  }
  const getPriorityBorderColor = (priority) => {
    const priorityBorderColors = {
      Low: "rgb(148 163 184)", // Gray/slate
      Medium: "rgb(251 191 36)", // Amber/yellow
      High: "rgb(239 68 68)", // Red
      Critical: "rgb(220 38 38)", // Bold red
    }
    return priorityBorderColors[priority] || "hsl(var(--border))"
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Checking your access…
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Redirecting to login…
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <ListChecks className="size-4" />
            Support
          </p>
          <h1 className="text-3xl font-semibold mt-1">Ticket Center</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Track issues raised by field teams, assign owners, and collaborate until every ticket moves from Open to Closed.
          </p>
        </div>
        <SupportTicketActions showTicketCenterLink={false} hideRaiseTicket={isAssignee} />
      </div>

      {isAdmin && (
        <Tabs value={centerTab} onValueChange={setCenterTab}>
          <TabsList>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="assignees">All Assignees</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Performance Modal Button and Export Button - Top Right, above card section */}
      {isAdmin && centerTab === "tickets" && (
        <div className="flex justify-end gap-3 mb-5 -mt-15">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export to Excel
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => handleExportToExcel("today")} className="cursor-pointer">
                Today
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportToExcel("week")} className="cursor-pointer">
                Last 7 Days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportToExcel("month")} className="cursor-pointer">
                Last Month
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setCustomStartDate("")
                setCustomEndDate("")
                setCustomDateDialogOpen(true)
              }} className="cursor-pointer">
                Custom Range
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportToExcel("all")} className="cursor-pointer">
                All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            onClick={() => setPerformanceModalOpen(true)}
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Assignee Performance
          </Button>
        </div>
      )}

      {isAdmin && centerTab === "assignees" && (
        <div className="rounded-lg border bg-card shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">All Assignees</h2>
              <p className="text-sm text-muted-foreground">Add, edit, or remove assignee accounts.</p>
            </div>
            <Button
              variant="outline"
              onClick={() => setCreateAssigneeDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <UserRoundPlus className="h-4 w-4" />
              Add Assignee
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingAssignees && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">Loading assignees...</TableCell>
                </TableRow>
              )}
              {!loadingAssignees && assignees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">No assignees found</TableCell>
                </TableRow>
              )}
              {!loadingAssignees && assignees.map((assignee) => (
                <TableRow key={assignee.id || assignee.username}>
                  <TableCell>{assignee.full_name || "-"}</TableCell>
                  <TableCell>{assignee.email || "-"}</TableCell>
                  <TableCell>{assignee.username}</TableCell>
                  <TableCell>{assignee.is_active === false ? "Inactive" : "Active"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEditAssignee(assignee)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setDeleteAssigneeTarget(assignee)}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(!isAdmin || centerTab === "tickets") && (
      <div className="rounded-lg border bg-card shadow-sm p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Status</Label>
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className={inputLikeClass}
            >
              <option value="all">All</option>
              {STATUS_FLOW.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div className="space-y-1">
              <Label className="text-sm font-medium">Priority</Label>
              <select
                value={filters.priority}
                onChange={(event) => setFilters((prev) => ({ ...prev, priority: event.target.value }))}
                className={inputLikeClass}
              >
                <option value="all">All</option>
                {PRIORITY_LEVELS.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Sensor</Label>
            <select
              value={filters.sensor}
              onChange={(event) => setFilters((prev) => ({ ...prev, sensor: event.target.value }))}
              className={inputLikeClass}
            >
              <option value="all">All</option>
              {sensorOptions.map((sensor) => (
                <option key={sensor.value} value={sensor.value}>
                  {sensor.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Resolution Time</Label>
            <select
              value={filters.resolutionTime}
              onChange={(event) => setFilters((prev) => ({ ...prev, resolutionTime: event.target.value }))}
              className={inputLikeClass}
            >
              <option value="all">All Tickets</option>
              <option value="more_than_1_day">More than 1 day</option>
              <option value="more_than_3_days">More than 3 days</option>
              <option value="more_than_1_week">More than 1 week</option>
              <option value="more_than_2_weeks">More than 2 weeks</option>
              <option value="more_than_1_month">More than 1 month</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Search</Label>
            <Input
              placeholder="Search description, issue, assignee"
              value={searchInput}
              onChange={(event) => {
                const val = event.target.value
                setSearchInput(val)
                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
                searchTimeoutRef.current = setTimeout(() => {
                  setFilters((prev) => ({ ...prev, search: val }))
                }, 400)
              }}
              className="h-10"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error.message || "Unable to load tickets right now."}
          </div>
        )}

        {loading && (
          <div className="text-sm text-muted-foreground px-2">Loading tickets…</div>
        )}

        <div className="space-y-3">
          {tickets.length === 0 && !loading && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No tickets match your filters yet. Create a new ticket or adjust the filters.
            </div>
          )}

          {tickets.map((ticket, ticketIndex) => {
            const ticketKey = `${ticket.id || "ticket"}-${ticketIndex}`
            const ticketLabel = ticket.id ? ticket.id.slice(0, 8) : `TEMP-${ticketIndex + 1}`
            const isOpen = openTicketKey === ticketKey
            const displayAssignee = ticket.pendingAssignee || ticket.assignee || ""
            // Get all images from ticket
            const ticketImages = ticket.images && Array.isArray(ticket.images) && ticket.images.length > 0
              ? ticket.images.map(img => `data:${img.contentType || "image/jpeg"};base64,${img.data}`)
              : ticket.imageData
                ? [`data:${ticket.imageContentType || "image/jpeg"};base64,${ticket.imageData}`]
                : ticket.imageUrl ? [ticket.imageUrl] : []
            const borderColor = isAdmin ? getPriorityBorderColor(ticket.priority) : undefined
            return (
              <div
                key={ticketKey}
                className="rounded-lg border bg-background/60 p-4 shadow-xs space-y-4"
                style={borderColor ? { borderColor } : undefined}
              >
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setOpenTicketKey(isOpen ? null : ticketKey)}
                    className="flex flex-1 items-center justify-between gap-4 text-left"
                    aria-expanded={isOpen}
                    aria-controls={`${ticketKey}-content`}
                  >
                    <div>
                      <p className="text-xs text-muted-foreground">Ticket {ticketLabel}</p>
                      <p className="text-base font-semibold">{ticket.issueType}</p>
                      <p className="text-sm text-muted-foreground">
                        {ticket.sensorName || ticket.sensorId || "Sensor not linked"}
                      </p>
                      {((isAdmin && displayAssignee) || (isAssignee && displayAssignee && displayAssignee.toLowerCase() === assigneeUsername.toLowerCase())) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Work Progress: <span className="font-medium text-foreground">{calculateWorkPercentage(ticket.status)}%</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {isAdmin && ticket.priority && renderPriorityBadge(ticket.priority)}
                      {renderTicketStatusBadge(ticket.status)}
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform duration-200",
                          isOpen ? "rotate-180" : "rotate-0"
                        )}
                      />
                    </div>
                  </button>
                  {/* Edit/Delete Menu - Only visible to admin */}
                  {isAdmin && (
                    <div className="shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-muted/80"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="More options"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleEdit(ticket)} className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(ticket)}
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
                </div>

                <div
                  id={`${ticketKey}-content`}
                  className={cn("space-y-4", isOpen ? "block" : "hidden")}
                >
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {ticket.description}
                  </p>

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="space-y-1 text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">Sensor:</span>{" "}
                        {ticket.sensorName || ticket.sensorId || "Not linked"}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Full Name:</span>{" "}
                        {ticket.fullName || "Not provided"}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Location:</span>{" "}
                        {ticket.location || "Not provided"}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Raised By:</span>{" "}
                        {ticket.raisedBy || "Not provided"}
                      </p>
                      <p><span className="font-medium text-foreground">Assignee:</span> {displayAssignee || "Unassigned"}</p>
                      {((isAdmin && displayAssignee) || (isAssignee && displayAssignee && displayAssignee.toLowerCase() === assigneeUsername.toLowerCase())) && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Work Progress:</span> {calculateWorkPercentage(ticket.status)}%
                        </p>
                      )}
                    </div>
                    <div className="space-y-2 text-muted-foreground">
                      <div>
                        <p>
                          <span className="font-medium text-foreground">Created:</span>{" "}
                          {ticket.createdAt || ticket.created_at
                            ? formatDateTime(new Date(ticket.createdAt || ticket.created_at))
                            : "N/A"}
                        </p>
                        {ticket.closedAt || ticket.closed_at ? (
                          <p>
                            <span className="font-medium text-foreground">Closed:</span>{" "}
                            {formatDateTime(new Date(ticket.closedAt || ticket.closed_at))}
                          </p>
                        ) : null}
                        {ticket.closedBy || ticket.closed_by ? (
                          <p>
                            <span className="font-medium text-foreground">Closed By:</span>{" "}
                            {ticket.closedBy || ticket.closed_by}
                          </p>
                        ) : null}
                        <p>
                          <span className="font-medium text-foreground">Updated:</span>{" "}
                          {ticket.updatedAt || ticket.updated_at
                            ? formatDateTime(new Date(ticket.updatedAt || ticket.updated_at))
                            : "N/A"}
                        </p>
                        {/* Calculate and display delay/resolution time */}
                        {ticket.createdAt || ticket.created_at ? (
                          <p className="pt-2 border-t">
                            <span className="font-medium text-foreground">Resolution Time: </span>
                            {(() => {
                              const created = new Date(ticket.createdAt || ticket.created_at)
                              const closed = ticket.closedAt || ticket.closed_at ? new Date(ticket.closedAt || ticket.closed_at) : new Date()
                              const diffMs = closed.getTime() - created.getTime()
                              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
                              const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
                              const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

                              if (ticket.closedAt || ticket.closed_at) {
                                // Ticket is closed - show total resolution time
                                if (diffDays > 0) {
                                  return `${diffDays} day${diffDays > 1 ? 's' : ''} ${diffHours} hour${diffHours !== 1 ? 's' : ''}`
                                } else if (diffHours > 0) {
                                  return `${diffHours} hour${diffHours > 1 ? 's' : ''} ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`
                                } else {
                                  return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`
                                }
                              } else {
                                // Ticket is still open - show time since creation
                                if (diffDays > 0) {
                                  return `${diffDays} day${diffDays > 1 ? 's' : ''} ${diffHours} hour${diffHours !== 1 ? 's' : ''} (pending)`
                                } else if (diffHours > 0) {
                                  return `${diffHours} hour${diffHours > 1 ? 's' : ''} ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} (pending)`
                                } else {
                                  return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} (pending)`
                                }
                              }
                            })()}
                          </p>
                        ) : null}
                      </div>
                      <div className="pt-3 border-t">
                        <p className="font-medium text-foreground mb-2">Attachments:</p>
                        {(ticketImages.length > 0 || (imagePreviews[ticket.id] && imagePreviews[ticket.id].length > 0)) ? (
                          <div className="space-y-3">
                            {/* Display all uploaded images */}
                            {ticketImages.length > 0 && (
                              <div className="flex flex-wrap gap-3">
                                {ticketImages.map((imgSrc, imgIndex) => (
                                  <div key={imgIndex} className="relative rounded-md border border-input overflow-hidden bg-muted/20">
                                    <img
                                      src={imgSrc}
                                      alt={`Ticket attachment ${imgIndex + 1}`}
                                      className="max-h-40 max-w-xs object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={(e) => {
                                        const newWindow = window.open()
                                        if (newWindow) {
                                          newWindow.document.write(
                                            `<img src="${e.target.src}" style="max-width:100%;height:auto;" />`
                                          )
                                        }
                                      }}
                                      onError={(e) => {
                                        e.target.style.display = "none"
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="absolute bottom-2 right-2"
                                      onClick={() => {
                                        const link = document.createElement("a")
                                        link.href = imgSrc
                                        link.download = `ticket-${ticketLabel}-attachment-${imgIndex + 1}`
                                        document.body.appendChild(link)
                                        link.click()
                                        document.body.removeChild(link)
                                      }}
                                    >
                                      Download
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Display preview images */}
                            {imagePreviews[ticket.id] && imagePreviews[ticket.id].length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">New images to upload:</p>
                                <div className="flex flex-wrap gap-3">
                                  {imagePreviews[ticket.id].map((preview, previewIndex) => (
                                    <div key={previewIndex} className="relative rounded-md border border-input overflow-hidden bg-muted/20 inline-block">
                                      <Image
                                        src={preview}
                                        alt={`Preview ${previewIndex + 1}`}
                                        width={200}
                                        height={130}
                                        unoptimized
                                        className="max-h-32 object-contain"
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute top-1 right-1 h-6 w-6 p-0 bg-background/80 hover:bg-background"
                                        onClick={() => handleRemoveImagePreview(ticket.id, previewIndex)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleImageUpload(ticket.id)}
                                  disabled={uploadingImage[ticket.id]}
                                  className="flex items-center gap-2"
                                >
                                  {uploadingImage[ticket.id] ? "Uploading..." : `Upload ${imagePreviews[ticket.id].length} Image(s)`}
                                </Button>
                              </div>
                            )}

                            {/* Image Upload Section for Admin and Assignee - Always show when images exist */}
                            {(isAdmin || isAssignee) && (
                              <div className="mt-3 pt-3 border-t">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    id={`image-upload-${ticket.id}`}
                                    onChange={(e) => {
                                      const files = e.target.files
                                      if (files && files.length > 0) {
                                        handleImageSelect(ticket.id, files)
                                      }
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      document.getElementById(`image-upload-${ticket.id}`)?.click()
                                    }}
                                    className="flex items-center gap-2"
                                  >
                                    <Upload className="h-4 w-4" />
                                    Add More Images
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs italic text-muted-foreground/80">No attachments uploaded</p>
                            {/* Image Upload Section for Admin and Assignee */}
                            {(isAdmin || isAssignee) && (
                              <div className="flex items-center gap-2">
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  id={`image-upload-${ticket.id}`}
                                  onChange={(e) => {
                                    const files = e.target.files
                                    if (files && files.length > 0) {
                                      handleImageSelect(ticket.id, files)
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    document.getElementById(`image-upload-${ticket.id}`)?.click()
                                  }}
                                  className="flex items-center gap-2"
                                >
                                  <Upload className="h-4 w-4" />
                                  Select Images
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {/* Status dropdown - Show for admin always, for assignee only if ticket is assigned to them */}
                    {(isAdmin || (isAssignee && displayAssignee && displayAssignee.toLowerCase() === assigneeUsername.toLowerCase())) && (
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Status</Label>
                        <select
                          value={ticket.status}
                          onChange={(event) => handleStatusChange(ticket, event.target.value, ticketLabel)}
                          className={inputLikeClass}
                        >
                          {STATUS_FLOW.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {isAdmin && (
                      <div className="space-y-1 md:col-span-2 min-w-0">
                        <Label className="text-sm font-medium flex items-center gap-1">
                          <UserRoundPlus className="size-4 shrink-0" />
                          Assign owner
                        </Label>
                        <select
                          value={assignmentDrafts[ticket.id] || displayAssignee || ""}
                          onChange={(event) => {
                            const selectedValue = event.target.value
                            setAssignmentDrafts((prev) => ({
                              ...prev,
                              [ticket.id]: selectedValue,
                            }))
                            // Auto-assign when selection changes
                            if (selectedValue) {
                              // Find the assignee's full name for the toast
                              const selectedAssignee = assignees.find(a => a.username === selectedValue)
                              const displayName = selectedAssignee?.full_name || selectedAssignee?.username || selectedValue
                              handleUpdateTicket(ticket.id, { assignee: selectedValue })
                              toast.success(`Ticket assigned to ${displayName}`, {
                                position: "bottom-right",
                              })
                            } else {
                              handleUpdateTicket(ticket.id, { assignee: "" })
                              toast.success("Ticket unassigned", {
                                position: "bottom-right",
                              })
                            }
                          }}
                          className="border-input h-8 w-full max-w-[350px] rounded-md border bg-background px-2 py-1 text-xs shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                          disabled={loadingAssignees}
                        >
                          <option value="">Unassigned</option>
                          {loadingAssignees && (
                            <option disabled>Loading assignees...</option>
                          )}
                          {!loadingAssignees && assignees.length === 0 && (
                            <option disabled>No assignees found</option>
                          )}
                          {!loadingAssignees && assignees.map((assignee) => {
                            const displayName = assignee.full_name || assignee.username || "Unknown"
                            const displayEmail = assignee.email || "No email"
                            // Truncate long names to prevent overflow
                            const truncatedName = displayName.length > 15 ? displayName.substring(0, 15) + "..." : displayName
                            const truncatedEmail = displayEmail.length > 20 ? displayEmail.substring(0, 20) + "..." : displayEmail
                            return (
                              <option key={assignee.id || assignee.username} value={assignee.username}>
                                {truncatedName} ({truncatedEmail})
                              </option>
                            )
                          })}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <SendHorizonal className="size-4" />
                      Reply
                    </Label>
                    <Textarea
                      placeholder="Share updates or request more information"
                      value={replyDrafts[ticket.id] || ""}
                      onChange={(event) =>
                        setReplyDrafts((prev) => ({ ...prev, [ticket.id]: event.target.value }))
                      }
                    />
                    <div className="flex justify-end">
                      <Button type="button" size="sm" onClick={() => handleReply(ticket.id)}>
                        Send reply
                      </Button>
                    </div>
                  </div>

                  {(ticket.replies?.length ?? 0) > 0 && (
                    <div className="rounded-md bg-muted/40 p-3 space-y-2">
                      {ticket.replies.map((reply, replyIndex) => {
                        const replyKey = `${reply.id || "reply"}-${ticketKey}-${replyIndex}`
                        return (
                          <div key={replyKey} className="rounded border border-muted-foreground/10 p-2 text-sm">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{reply.author}</span>
                              <span>{formatDateTime(reply.timestamp)}</span>
                            </div>
                            <p className="mt-1 text-foreground">{reply.message}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      )}

      <TicketEditDialog
        ticket={selectedTicket}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSaveEdit}
      />

      {/* Assignee Performance Modal */}
      {isAdmin && (
        <AssigneePerformanceModal
          open={performanceModalOpen}
          onOpenChange={setPerformanceModalOpen}
        />
      )}

      {isAdmin && (
        <Dialog open={createAssigneeDialogOpen} onOpenChange={setCreateAssigneeDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Assignee</DialogTitle>
              <DialogDescription>
                Create a new assignee account with login credentials.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="assignee-full-name">Name</Label>
                <Input
                  id="assignee-full-name"
                  value={newAssignee.fullName}
                  onChange={(event) =>
                    setNewAssignee((prev) => ({ ...prev, fullName: event.target.value }))
                  }
                  placeholder="Enter full name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="assignee-email">Email</Label>
                <Input
                  id="assignee-email"
                  type="email"
                  value={newAssignee.email}
                  onChange={(event) =>
                    setNewAssignee((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="Enter email"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="assignee-username">Username</Label>
                <Input
                  id="assignee-username"
                  value={newAssignee.username}
                  onChange={(event) =>
                    setNewAssignee((prev) => ({ ...prev, username: event.target.value }))
                  }
                  placeholder="Enter username"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="assignee-password">Password</Label>
                <Input
                  id="assignee-password"
                  type="password"
                  value={newAssignee.password}
                  onChange={(event) =>
                    setNewAssignee((prev) => ({ ...prev, password: event.target.value }))
                  }
                  placeholder="Enter password"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newAssignee.sendCredentialsEmail}
                  onChange={(event) =>
                    setNewAssignee((prev) => ({
                      ...prev,
                      sendCredentialsEmail: event.target.checked,
                    }))
                  }
                />
                Send email with username and password
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateAssigneeDialogOpen(false)}
                disabled={creatingAssignee}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateAssignee}
                disabled={creatingAssignee}
              >
                {creatingAssignee ? "Creating..." : "Create Assignee"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isAdmin && (
        <Dialog open={Boolean(editingAssignee)} onOpenChange={(open) => { if (!open && !savingAssignee) setEditingAssignee(null) }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Assignee</DialogTitle>
              <DialogDescription>
                Update assignee details. Username cannot be changed.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-assignee-username">Username</Label>
                <Input id="edit-assignee-username" value={editingAssignee?.username || ""} disabled readOnly className="bg-muted cursor-not-allowed" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-assignee-name">Name</Label>
                <Input
                  id="edit-assignee-name"
                  value={editAssigneeForm.fullName}
                  onChange={(event) => setEditAssigneeForm((prev) => ({ ...prev, fullName: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-assignee-email">Email</Label>
                <Input
                  id="edit-assignee-email"
                  type="email"
                  value={editAssigneeForm.email}
                  onChange={(event) => setEditAssigneeForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-assignee-password">New password</Label>
                <Input
                  id="edit-assignee-password"
                  type="password"
                  value={editAssigneeForm.password}
                  onChange={(event) => setEditAssigneeForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Leave blank to keep the current password"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editAssigneeForm.isActive}
                  onChange={(event) => setEditAssigneeForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                Active
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingAssignee(null)} disabled={savingAssignee}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveAssignee} disabled={savingAssignee}>
                {savingAssignee ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isAdmin && (
        <Dialog open={Boolean(deleteAssigneeTarget)} onOpenChange={(open) => { if (!open && !deletingAssignee) setDeleteAssigneeTarget(null) }}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Delete Assignee</DialogTitle>
              <DialogDescription>
                Delete {deleteAssigneeTarget?.full_name || deleteAssigneeTarget?.username}? Existing tickets keep their assignee name.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteAssigneeTarget(null)} disabled={deletingAssignee}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={handleDeleteAssignee} disabled={deletingAssignee}>
                {deletingAssignee ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Close Ticket Dialog - captures who closed the ticket */}
      <Dialog
        open={Boolean(closeTicketDialog)}
        onOpenChange={(open) => {
          if (!open && !closingTicket) setCloseTicketDialog(null)
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Close Ticket</DialogTitle>
            <DialogDescription>
              {closeTicketDialog?.ticketLabel
                ? `Enter who is closing ticket ${closeTicketDialog.ticketLabel}.`
                : "Enter who is closing this ticket."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-2">
            <Label htmlFor="closed-by">Closed By</Label>
            <Input
              id="closed-by"
              value={closeTicketDialog?.closedBy || ""}
              onChange={(event) =>
                setCloseTicketDialog((prev) =>
                  prev ? { ...prev, closedBy: event.target.value } : prev
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  handleConfirmCloseTicket()
                }
              }}
              placeholder="Enter name of the person closing this ticket"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCloseTicketDialog(null)}
              disabled={closingTicket}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirmCloseTicket} disabled={closingTicket}>
              {closingTicket ? "Closing..." : "Close Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Date Range Export Dialog */}
      <Dialog open={customDateDialogOpen} onOpenChange={setCustomDateDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Custom Date Range Export</DialogTitle>
            <DialogDescription>
              Select the start and end dates to filter and export tickets to Excel.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="custom-start-date">Start Date</Label>
              <Input
                id="custom-start-date"
                type="date"
                value={customStartDate}
                onChange={(event) => setCustomStartDate(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="custom-end-date">End Date</Label>
              <Input
                id="custom-end-date"
                type="date"
                value={customEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCustomDateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!customStartDate || !customEndDate) {
                  toast.error("Please select both start and end dates")
                  return
                }
                const [sYear, sMonth, sDay] = customStartDate.split("-").map(Number)
                const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0)

                const [eYear, eMonth, eDay] = customEndDate.split("-").map(Number)
                const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999)

                if (start > end) {
                  toast.error("Start date cannot be after end date")
                  return
                }
                handleExportToExcel("custom", start, end)
                setCustomDateDialogOpen(false)
              }}
            >
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

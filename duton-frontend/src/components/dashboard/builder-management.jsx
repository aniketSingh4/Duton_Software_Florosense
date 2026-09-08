"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Pencil, Trash2, Loader2, Building2, X, Copy, Check, Mail, Search, Bell, BellOff } from "lucide-react"
import { toast } from "sonner"
import { getAllSites, getUserSites, assignSitesToUser, removeSiteFromUser, fetchUserSensors } from "@/utils/api"

const TICKET_API_BASE_URL = process.env.NEXT_PUBLIC_TICKET_API_URL || "http://localhost:8001/api"

const getTicketAuthHeaders = () => {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("duton_access_token") : null
  if (!token) {
    throw new Error("Authentication token missing. Please log in again.")
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

const PAGE_SIZE = 10

// Get paginated users with builder/contractor role
const getBuilders = async ({ skip = 0, limit = PAGE_SIZE, search = "" } = {}) => {
  try {
    const params = new URLSearchParams({
      roles: "builder,contractor",
      skip: String(skip),
      limit: String(limit),
    })
    if (search) {
      params.set("search", search)
    }
    const response = await fetch(`${TICKET_API_BASE_URL}/users/list?${params}`, {
      method: "GET",
      headers: getTicketAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to get builders")
    }

    const data = await response.json()
    const payload = data.data || data
    return {
      users: payload.users || [],
      totalCount: payload.total_count ?? payload.users?.length ?? 0,
    }
  } catch (error) {
    console.error("[getBuilders] Error:", error)
    throw error
  }
}

// Create builder user
const createBuilder = async (userData) => {
  try {
    const response = await fetch(`${TICKET_API_BASE_URL}/users`, {
      method: "POST",
      headers: getTicketAuthHeaders(),
      body: JSON.stringify({
        ...userData,
        role: userData.role || "builder",
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to create builder")
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error("[createBuilder] Error:", error)
    throw error
  }
}

// Update a client's alert notification settings
const updateAlertSettings = async (username, payload) => {
  try {
    const response = await fetch(`${TICKET_API_BASE_URL}/alerts/settings/${encodeURIComponent(username)}`, {
      method: "PATCH",
      headers: getTicketAuthHeaders(),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to update alert settings")
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error("[updateAlertSettings] Error:", error)
    throw error
  }
}

// Enable/disable alert notifications for every client at once
const bulkUpdateAlertSettings = async (enabled) => {
  try {
    const response = await fetch(`${TICKET_API_BASE_URL}/alerts/settings/bulk`, {
      method: "PATCH",
      headers: getTicketAuthHeaders(),
      body: JSON.stringify({ alert_notifications_enabled: enabled }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to update alert settings")
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error("[bulkUpdateAlertSettings] Error:", error)
    throw error
  }
}

// Delete builder user
const deleteBuilder = async (userId) => {
  try {
    const response = await fetch(`${TICKET_API_BASE_URL}/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: getTicketAuthHeaders(),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || "Failed to delete builder")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("[deleteBuilder] Error:", error)
    throw error
  }
}

export function BuilderManagement() {
  const [builders, setBuilders] = useState([])
  const [sites, setSites] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [alertDialogOpen, setAlertDialogOpen] = useState(false)
  const [alertForm, setAlertForm] = useState({ enabled: true, extraEmails: "", ccEmails: "" })
  const [savingAlertSettings, setSavingAlertSettings] = useState(false)
  const [bulkAlertDialogOpen, setBulkAlertDialogOpen] = useState(false)
  const [bulkDisablingAlerts, setBulkDisablingAlerts] = useState(false)
  const [selectedBuilder, setSelectedBuilder] = useState(null)
  const [builderSites, setBuilderSites] = useState([])
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "builder",
    client_name: "",
  })
  const [createdCredentials, setCreatedCredentials] = useState(null)
  const [usernameCopied, setUsernameCopied] = useState(false)
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)
  const [allSensors, setAllSensors] = useState([])
  const [siteSearch, setSiteSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [clientSearch, setClientSearch] = useState("")
  const [clientSearchInput, setClientSearchInput] = useState("")
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const searchTimeoutRef = useRef(null)
  const clientSearchTimeoutRef = useRef(null)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount)

  useEffect(() => {
    loadSitesAndSensors()
  }, [])

  useEffect(() => {
    loadBuilders(page)
  }, [page, clientSearch])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const loadSitesAndSensors = async () => {
    try {
      const [sitesData, sensorsData] = await Promise.all([
        getAllSites(),
        fetchUserSensors().catch(() => []),
      ])
      setSites(sitesData || [])
      setAllSensors(sensorsData || [])
    } catch (error) {
      toast.error(error.message || "Failed to load sites")
    }
  }

  const loadBuilders = async (pageToLoad = page) => {
    setIsLoading(true)
    try {
      const skip = (pageToLoad - 1) * PAGE_SIZE
      const { users, totalCount: count } = await getBuilders({ skip, limit: PAGE_SIZE, search: clientSearch })
      setBuilders(users || [])
      setTotalCount(count || 0)
    } catch (error) {
      toast.error(error.message || "Failed to load clients")
    } finally {
      setIsLoading(false)
    }
  }

  const loadData = async () => {
    await Promise.all([loadBuilders(page), loadSitesAndSensors()])
  }

  const handlePageChange = (direction) => {
    setPage((prev) => {
      if (direction === "prev") return Math.max(1, prev - 1)
      return Math.min(totalPages, prev + 1)
    })
  }

  const handleClientSearchChange = (value) => {
    setClientSearchInput(value)
    if (clientSearchTimeoutRef.current) clearTimeout(clientSearchTimeoutRef.current)
    clientSearchTimeoutRef.current = setTimeout(() => {
      setPage(1)
      setClientSearch(value)
    }, 400)
  }

  const handleOpenDialog = (builder = null) => {
    // Reset credentials state when opening dialog
    setCreatedCredentials(null)
    setUsernameCopied(false)
    setPasswordCopied(false)
    setEmailCopied(false)

    if (builder) {
      setSelectedBuilder(builder)
      setFormData({
        username: builder.username || "",
        email: builder.email || "",
        password: "",
        role: builder.role || "builder",
        client_name: builder.client_name || "",
      })
    } else {
      setSelectedBuilder(null)
      setFormData({
        username: "",
        email: "",
        password: "",
        role: "builder",
        client_name: "",
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setSelectedBuilder(null)
    setFormData({
      username: "",
      email: "",
      password: "",
      role: "builder",
      client_name: "",
    })
    setCreatedCredentials(null)
    setUsernameCopied(false)
    setPasswordCopied(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.username || !formData.email || !formData.password) {
      toast.error("Username, email, and password are required")
      return
    }

    // Store the password before sending (backend will hash it)
    const plainPassword = formData.password

    try {
      await createBuilder(formData)
      // Store credentials to display
      setCreatedCredentials({
        username: formData.username,
        password: plainPassword,
      })
      toast.success("Client created successfully")
      setPage(1)
      loadBuilders(1)
    } catch (error) {
      toast.error(error.message || "Failed to create client")
    }
  }

  const handleCopyUsername = async () => {
    if (createdCredentials?.username) {
      try {
        await navigator.clipboard.writeText(createdCredentials.username)
        setUsernameCopied(true)
        toast.success("Username copied to clipboard")
        setTimeout(() => setUsernameCopied(false), 2000)
      } catch (error) {
        toast.error("Failed to copy username")
      }
    }
  }

  const handleCopyPassword = async () => {
    if (createdCredentials?.password) {
      try {
        await navigator.clipboard.writeText(createdCredentials.password)
        setPasswordCopied(true)
        toast.success("Password copied to clipboard")
        setTimeout(() => setPasswordCopied(false), 2000)
      } catch (error) {
        toast.error("Failed to copy password")
      }
    }
  }

  const generateEmailContent = () => {
    if (!createdCredentials) return ""

    const roleLabel = formData.role === "contractor" ? "Contractor" : "Client"
    const emailText = `Subject: Your ${roleLabel} Account Credentials - Duton System

Dear ${formData.client_name || "User"},

Your ${roleLabel.toLowerCase()} account has been successfully created in the Duton system. Below are your login credentials:

Username: ${createdCredentials.username}
Password: ${createdCredentials.password}

Use the username and password provided above to log in to the system.
You will be able to view and manage sites assigned to your account.

Please keep these credentials secure and do not share them with anyone.

Best regards,
Administrator
Duton System`

    return emailText
  }

  const handleCopyEmail = async () => {
    const emailContent = generateEmailContent()
    if (emailContent) {
      try {
        await navigator.clipboard.writeText(emailContent)
        setEmailCopied(true)
        toast.success("Email copied to clipboard")
        setTimeout(() => setEmailCopied(false), 2000)
      } catch (error) {
        toast.error("Failed to copy email")
      }
    }
  }

  const handleOpenAlertDialog = (builder) => {
    setSelectedBuilder(builder)
    setAlertForm({
      enabled: builder.alert_notifications_enabled !== false,
      extraEmails: (builder.alert_emails || []).join(", "),
      ccEmails: (builder.alert_cc || []).join(", "),
    })
    setAlertDialogOpen(true)
  }

  const parseEmailList = (value) =>
    value
      .split(/[,\n;]+/)
      .map((email) => email.trim())
      .filter(Boolean)

  const handleSaveAlertSettings = async () => {
    if (!selectedBuilder) return

    setSavingAlertSettings(true)
    try {
      const updated = await updateAlertSettings(selectedBuilder.username, {
        alert_notifications_enabled: alertForm.enabled,
        alert_emails: parseEmailList(alertForm.extraEmails),
        alert_cc: parseEmailList(alertForm.ccEmails),
      })
      setBuilders((prev) =>
        prev.map((builder) =>
          builder.username === selectedBuilder.username ? { ...builder, ...updated } : builder
        )
      )
      toast.success("Alert settings updated")
      setAlertDialogOpen(false)
      setSelectedBuilder(null)
    } catch (error) {
      toast.error(error.message || "Failed to update alert settings")
    } finally {
      setSavingAlertSettings(false)
    }
  }

  const handleToggleAlerts = async (builder) => {
    const newEnabled = builder.alert_notifications_enabled === false
    try {
      const updated = await updateAlertSettings(builder.username, {
        alert_notifications_enabled: newEnabled,
      })
      setBuilders((prev) =>
        prev.map((b) => (b.username === builder.username ? { ...b, ...updated } : b))
      )
      toast.success(`Alert notifications ${newEnabled ? "enabled" : "disabled"} for ${builder.username}`)
    } catch (error) {
      toast.error(error.message || "Failed to update alert settings")
    }
  }

  const handleBulkDisableAlerts = async () => {
    setBulkDisablingAlerts(true)
    try {
      await bulkUpdateAlertSettings(false)
      setBuilders((prev) => prev.map((b) => ({ ...b, alert_notifications_enabled: false })))
      toast.success("Alert notifications disabled for all clients")
      setBulkAlertDialogOpen(false)
      loadBuilders(page)
    } catch (error) {
      toast.error(error.message || "Failed to disable alert notifications")
    } finally {
      setBulkDisablingAlerts(false)
    }
  }

  const handleOpenAssignDialog = async (builder) => {
    setSelectedBuilder(builder)
    setSiteSearch("")
    setSearchInput("")
    try {
      const assignedSites = await getUserSites(builder.username)
      setBuilderSites(assignedSites || [])
      setAssignDialogOpen(true)
    } catch (error) {
      toast.error(error.message || "Failed to load assigned sites")
    }
  }

  const handleAssignSites = async (siteIds) => {
    if (!selectedBuilder) return

    try {
      await assignSitesToUser(selectedBuilder.username, siteIds)
      toast.success("Sites assigned successfully")
      const assignedSites = await getUserSites(selectedBuilder.username)
      setBuilderSites(assignedSites || [])
      loadData()
    } catch (error) {
      toast.error(error.message || "Failed to assign sites")
    }
  }

  const handleRemoveSite = async (siteId) => {
    if (!selectedBuilder) return

    try {
      await removeSiteFromUser(selectedBuilder.username, siteId)
      toast.success("Site assignment removed")
      const assignedSites = await getUserSites(selectedBuilder.username)
      setBuilderSites(assignedSites || [])
      loadData()
    } catch (error) {
      toast.error(error.message || "Failed to remove site assignment")
    }
  }

  const handleDelete = async () => {
    if (!selectedBuilder) return

    try {
      // Use user id for deletion (backend expects user_id)
      const userId = selectedBuilder.id || selectedBuilder._id || selectedBuilder.username
      await deleteBuilder(userId)
      toast.success("Client deleted successfully")
      setDeleteDialogOpen(false)
      setSelectedBuilder(null)
      if (builders.length === 1 && page > 1) {
        setPage(page - 1)
      } else {
        loadBuilders(page)
      }
    } catch (error) {
      toast.error(error.message || "Failed to delete client")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Client Management</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBulkAlertDialogOpen(true)}>
            <BellOff className="h-4 w-4 mr-2" />
            Disable All Alerts
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </div>
      </div>

      <div className="relative sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by username, email, or client name..."
          value={clientSearchInput}
          onChange={(e) => handleClientSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {clientSearchInput && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
            onClick={() => handleClientSearchChange("")}
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : builders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {clientSearch
              ? `No clients match "${clientSearch}".`
              : "No clients found. Create your first client to get started."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Client Name</TableHead>
                <TableHead>Assigned Sites</TableHead>
                <TableHead className="text-center">Alerts</TableHead>
                <TableHead className="text-center pl-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {builders.map((builder) => (
                <TableRow key={builder.username}>
                  <TableCell className="font-medium">{builder.username}</TableCell>
                  <TableCell>{builder.email}</TableCell>
                  <TableCell className="capitalize">{builder.role}</TableCell>
                  <TableCell>{builder.client_name || "-"}</TableCell>
                  <TableCell>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => handleOpenAssignDialog(builder)}
                    >
                      View Sites
                    </Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleAlerts(builder)}
                      title={
                        builder.alert_notifications_enabled !== false
                          ? "Alert notifications enabled - click to disable"
                          : "Alert notifications disabled - click to enable"
                      }
                    >
                      {builder.alert_notifications_enabled !== false ? (
                        <Bell className="h-4 w-4 text-green-600" />
                      ) : (
                        <BellOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="text-center pl-4">
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenAlertDialog(builder)}
                        title="Alert settings"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenAssignDialog(builder)}
                      >
                        <Building2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedBuilder(builder)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!isLoading && totalCount > PAGE_SIZE && (
          <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground text-center sm:text-left">
              Showing {rangeStart}-{rangeEnd} of {totalCount}
            </p>
            <div className="flex gap-2 shrink-0 justify-center sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange("prev")}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center text-sm text-muted-foreground px-1">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange("next")}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create Builder Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Client</DialogTitle>
            <DialogDescription>
              {createdCredentials
                ? "Client account created successfully. Please share the credentials below with the user."
                : "Create a new client account. They will be able to log in and view assigned sites."}
            </DialogDescription>
          </DialogHeader>

          {createdCredentials ? (
            // Show email format after successful creation
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Email Content (Ready to Send)</Label>
                <Button
                  type="button"
                  onClick={handleCopyEmail}
                  className="shrink-0"
                  variant={emailCopied ? "default" : "outline"}
                >
                  {emailCopied ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Email
                    </>
                  )}
                </Button>
              </div>
              <Card className="p-4">
                <Textarea
                  value={generateEmailContent()}
                  readOnly
                  className="min-h-[400px] font-mono text-sm resize-none"
                />
              </Card>
              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                <p className="font-semibold mb-1">How to use:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click &quot;Copy Email&quot; button above to copy the entire email content</li>
                  <li>Open your email client (Gmail, Outlook, etc.)</li>
                  <li>Create a new email and paste the content</li>
                  <li>Add the recipient&apos;s email address and send</li>
                </ol>
              </div>
            </div>
          ) : (
            // Show form for creating builder
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    placeholder="Enter username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="Enter email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="Enter password (min 6 characters)"
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="builder">Client</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client_name">Client Name</Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) =>
                      setFormData({ ...formData, client_name: e.target.value })
                    }
                    placeholder="Enter client name (optional)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </DialogFooter>
            </form>
          )}

          {createdCredentials && (
            <DialogFooter>
              <Button type="button" onClick={handleCloseDialog}>
                Done
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Sites Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              Assign Sites to {selectedBuilder?.username}
            </DialogTitle>
            <DialogDescription>
              Select sites to assign to this builder. They will see all sensors at these sites.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Available Sites</Label>
              <Input
                placeholder="Search by site name or sensor ID..."
                value={searchInput}
                onChange={(e) => {
                  const val = e.target.value
                  setSearchInput(val)
                  if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
                  searchTimeoutRef.current = setTimeout(() => setSiteSearch(val), 400)
                }}
                className="my-2"
              />
              <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-2">
                {sites
                  .filter((site) => {
                    if (!siteSearch) return true;
                    
                    const query = siteSearch.toLowerCase();
                    if (site.site_name && site.site_name.toLowerCase().includes(query)) {
                      return true;
                    }
                    
                    const siteSensors = allSensors.filter(s => 
                      s.site_name === site.site_name || s.site_id === site.site_id
                    );
                    
                    return siteSensors.some(s => 
                      (s.sensor_id && s.sensor_id.toLowerCase().includes(query)) ||
                      (s.device_id && s.device_id.toLowerCase().includes(query))
                    );
                  })
                  .map((site) => {
                  // Use site_name as the primary identifier since sites come from sensors
                  // site_id is auto-generated and may not exist in sensor documents
                  const siteIdentifier = site.site_name
                  const isAssigned = builderSites.some((s) =>
                    s.site_name === site.site_name ||
                    s.site_id === site.site_name
                  )
                  return (
                    <div
                      key={siteIdentifier}
                      className="flex items-center justify-between p-2 hover:bg-muted rounded"
                    >
                      <div>
                        <div className="font-medium">{site.site_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {site.site_address || site.site_name}
                        </div>
                      </div>
                      {isAssigned ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveSite(siteIdentifier)}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            // Use site_name for all assignments
                            const currentSiteIds = builderSites.map((s) => s.site_name || s.site_id).filter(Boolean)
                            handleAssignSites([...currentSiteIds, siteIdentifier])
                          }}
                        >
                          Assign
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            {builderSites.length > 0 && (
              <div className="space-y-2">
                <Label>Currently Assigned Sites</Label>
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                  {builderSites.map((site) => {
                    // Always use site_name for removal since that's what's stored in user_sites collection
                    // (the site_id field in user_sites actually stores the site_name)
                    const siteIdentifier = site.site_name || site.site_id
                    return (
                      <div
                        key={siteIdentifier}
                        className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                      >
                        <span>{site.site_name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveSite(siteIdentifier)}
                          title="Unassign site"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Settings Dialog */}
      <Dialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Alert Settings - {selectedBuilder?.username}</DialogTitle>
            <DialogDescription>
              Configure automatic email alerts (offline / abnormal readings) for this client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium text-sm">Alert Notifications</p>
                <p className="text-xs text-muted-foreground">
                  Send automatic offline and abnormal reading alerts to this client
                </p>
              </div>
              <Button
                type="button"
                variant={alertForm.enabled ? "default" : "outline"}
                size="sm"
                onClick={() => setAlertForm({ ...alertForm, enabled: !alertForm.enabled })}
              >
                {alertForm.enabled ? (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Enabled
                  </>
                ) : (
                  <>
                    <BellOff className="h-4 w-4 mr-2" />
                    Disabled
                  </>
                )}
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert_emails">Additional Recipients</Label>
              <Textarea
                id="alert_emails"
                value={alertForm.extraEmails}
                onChange={(e) => setAlertForm({ ...alertForm, extraEmails: e.target.value })}
                placeholder="Extra email addresses, separated by commas"
                className="min-h-[60px]"
              />
              <p className="text-xs text-muted-foreground">
                Alerts always go to the client&apos;s registered email ({selectedBuilder?.email}). Add more recipients here if needed.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert_cc">CC Recipients</Label>
              <Textarea
                id="alert_cc"
                value={alertForm.ccEmails}
                onChange={(e) => setAlertForm({ ...alertForm, ccEmails: e.target.value })}
                placeholder="CC email addresses, separated by commas"
                className="min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAlertDialogOpen(false)
                setSelectedBuilder(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveAlertSettings} disabled={savingAlertSettings}>
              {savingAlertSettings && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Disable Alerts Confirmation Dialog */}
      <Dialog open={bulkAlertDialogOpen} onOpenChange={setBulkAlertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable All Alerts</DialogTitle>
            <DialogDescription>
              This turns off alert notifications for every client. You can turn them back on
              individually from each client&apos;s alert toggle afterwards.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkAlertDialogOpen(false)}
              disabled={bulkDisablingAlerts}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleBulkDisableAlerts}
              disabled={bulkDisablingAlerts}
            >
              {bulkDisablingAlerts && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Disable All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedBuilder?.username}&quot;? This action cannot be undone.
              All site assignments will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setSelectedBuilder(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


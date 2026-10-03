"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
} from "@/components/ui/select"
import { Loader2, Search, X, RefreshCw, WifiOff, Activity } from "lucide-react"
import { toast } from "sonner"

const TICKET_API_BASE_URL = process.env.NEXT_PUBLIC_TICKET_API_URL || "http://localhost:8001/api"

const getAuthHeaders = () => {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("duton_access_token") : null
  if (!token) {
    throw new Error("Authentication token missing. Please log in again.")
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

const PAGE_SIZE = 15
const LOOKBACK_DAYS = 15

const TYPE_LABELS = {
  all: "All Types",
  offline: "Offline",
  abnormal_reading: "Abnormal Reading",
}

const STATUS_LABELS = {
  all: "All Status",
  open: "Open",
  resolved: "Resolved",
}

const fetchAlertLogs = async ({ skip = 0, limit = PAGE_SIZE, search = "", alertType = "", alertStatus = "" } = {}) => {
  const params = new URLSearchParams({
    skip: String(skip),
    limit: String(limit),
    days: String(LOOKBACK_DAYS),
  })
  if (search) params.set("search", search)
  if (alertType && alertType !== "all") params.set("alert_type", alertType)
  if (alertStatus && alertStatus !== "all") params.set("alert_status", alertStatus)

  const response = await fetch(`${TICKET_API_BASE_URL}/alerts/logs?${params}`, {
    method: "GET",
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || errorData.message || "Failed to load alert logs")
  }

  const data = await response.json()
  const payload = data.data || data
  return {
    logs: payload.logs || [],
    totalCount: payload.total_count ?? 0,
  }
}

const formatDateTime = (value) => {
  if (!value) return "-"
  const date = new Date(value)
  if (isNaN(date.getTime())) return "-"
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
}

export function AlertLog() {
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const searchTimeoutRef = useRef(null)
  const hasLoadedRef = useRef(false)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount)

  const loadLogs = useCallback(async () => {
    if (hasLoadedRef.current) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    try {
      const skip = (page - 1) * PAGE_SIZE
      const { logs: fetchedLogs, totalCount: count } = await fetchAlertLogs({
        skip,
        limit: PAGE_SIZE,
        search,
        alertType: typeFilter,
        alertStatus: statusFilter,
      })
      setLogs(fetchedLogs)
      setTotalCount(count)
      hasLoadedRef.current = true
    } catch (error) {
      toast.error(error.message || "Failed to load alert logs")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [page, search, typeFilter, statusFilter])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const handleSearchChange = (value) => {
    setSearchInput(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1)
      setSearch(value)
    }, 400)
  }

  const handlePageChange = (direction) => {
    setPage((prev) => {
      if (direction === "prev") return Math.max(1, prev - 1)
      return Math.min(totalPages, prev + 1)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Alert Log</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Showing open alerts and alerts from the last {LOOKBACK_DAYS} days.
          </p>
        </div>
        <Button variant="outline" onClick={loadLogs} disabled={isLoading || isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading || isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by sensor, client, site, or recipient..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchInput && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
              onClick={() => handleSearchChange("")}
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Select
          value={typeFilter}
          onValueChange={(value) => {
            setPage(1)
            setTypeFilter(value)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <span>{TYPE_LABELS[typeFilter] || "Alert Type"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="abnormal_reading">Abnormal Reading</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setPage(1)
            setStatusFilter(value)
          }}
        >
          <SelectTrigger className="w-[150px]">
            <span>{STATUS_LABELS[statusFilter] || "Status"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className={isRefreshing ? "opacity-70" : undefined}>
        {isLoading && logs.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {search || typeFilter !== "all" || statusFilter !== "all"
              ? "No alerts match the current filters."
              : `No open alerts or alerts in the last ${LOOKBACK_DAYS} days.`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Alert Type</TableHead>
                  <TableHead>Sensor ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(log.created_at)}</TableCell>
                    <TableCell>
                      {log.alert_type === "offline" ? (
                        <Badge variant="destructive" className="gap-1">
                          <WifiOff className="h-3 w-3" />
                          Offline
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Activity className="h-3 w-3" />
                          Abnormal
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{log.sensor_id}</TableCell>
                    <TableCell>{log.client_name || "-"}</TableCell>
                    <TableCell>{log.site_name || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {log.alert_type === "offline"
                        ? log.offline_duration_hours != null
                          ? `Offline ${log.offline_duration_hours}h`
                          : "-"
                        : log.reading_value != null
                          ? `Reading: ${log.reading_value}`
                          : "-"}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <span className="block truncate" title={(log.recipients || []).join(", ")}>
                        {(log.recipients || []).join(", ") || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.delivery_status === "sent"
                            ? "default"
                            : log.delivery_status === "skipped" || log.delivery_status === "logged"
                              ? "outline"
                              : "destructive"
                        }
                      >
                        {log.delivery_status === "sent"
                          ? "Sent"
                          : log.delivery_status === "skipped" || log.delivery_status === "logged"
                            ? "Logged"
                            : "Failed"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.alert_status === "resolved" ? "outline" : "secondary"}>
                        {log.alert_status === "resolved" ? "Resolved" : "Open"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
    </div>
  )
}

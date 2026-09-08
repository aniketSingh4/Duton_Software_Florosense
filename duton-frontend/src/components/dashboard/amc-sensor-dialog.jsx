"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { Loader2, History, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import { getAmcClientSensors, saveAmcClientSensors, getAmcAuditLogs } from "@/utils/api"

export const AMC_ALERT_WINDOW_DAYS = 90

// ---- date helpers (all day-precision, YYYY-MM-DD strings) -----------------

const toYmd = (iso) => (iso ? String(iso).slice(0, 10) : "")

const ymdToUtc = (ymd) => {
  if (!ymd) return null
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d))
}

const addOneYear = (ymd) => {
  const date = ymdToUtc(ymd)
  if (!date) return ""
  return new Date(Date.UTC(date.getUTCFullYear() + 1, date.getUTCMonth(), date.getUTCDate()))
    .toISOString()
    .slice(0, 10)
}

const todayYmd = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10)
}

const daysFromToday = (ymd) => {
  const date = ymdToUtc(ymd)
  const today = ymdToUtc(todayYmd())
  if (!date || !today) return null
  return Math.round((date.getTime() - today.getTime()) / 86400000)
}

export const formatYmd = (ymd) => {
  const date = ymdToUtc(toYmd(ymd))
  if (!date) return "-"
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
}

export const formatDaysRemaining = (days) => {
  if (days === null || days === undefined) return "-"
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
  if (days === 0) return "Expires today"
  return `${days} day${days === 1 ? "" : "s"} left`
}

// Derive the live preview of a row from its editable inputs (mirrors backend rules)
const deriveRow = (row) => {
  const warrantyExpiry = row.installation_date ? addOneYear(row.installation_date) : ""
  const amcExpiry = row.amc_renewal_date ? addOneYear(row.amc_renewal_date) : ""
  const warrantyDays = warrantyExpiry ? daysFromToday(warrantyExpiry) : null
  const amcDays = amcExpiry ? daysFromToday(amcExpiry) : null
  const nextExpiry = amcExpiry || warrantyExpiry
  const daysRemaining = amcExpiry ? amcDays : warrantyDays
  const renewalAllowed = Boolean(row.amc_renewal_date) || (warrantyDays !== null && warrantyDays <= 0)
  const alertActive = row.tracked && daysRemaining !== null && daysRemaining <= AMC_ALERT_WINDOW_DAYS
  return {
    warrantyExpiry,
    amcExpiry,
    nextExpiry,
    daysRemaining,
    renewalAllowed,
    alertActive,
    expiryType: amcExpiry ? "AMC" : warrantyExpiry ? "Warranty" : null,
  }
}

export function AmcSensorDialog({ open, onOpenChange, client, onSaved }) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [rows, setRows] = useState([])
  const [bulkDate, setBulkDate] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const username = client?.username

  useEffect(() => {
    if (!open || !username) return
    let cancelled = false
    setIsLoading(true)
    setShowHistory(false)
    setHistory([])
    setBulkDate("")

    getAmcClientSensors(username)
      .then((data) => {
        if (cancelled) return
        setRows(
          (data?.sensors || []).map((s) => ({
            sensor_id: s.sensor_id,
            site_name: s.site_name,
            is_active: s.is_active,
            tracked: s.tracked === true,
            installation_date: toYmd(s.installation_date),
            amc_renewal_date: toYmd(s.amc_renewal_date),
          }))
        )
      })
      .catch((error) => {
        toast.error(error.message || "Failed to load client sensors")
        onOpenChange?.(false)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, username, onOpenChange])

  const updateRow = (sensorId, patch) => {
    setRows((prev) => prev.map((r) => (r.sensor_id === sensorId ? { ...r, ...patch } : r)))
  }

  const trackedCount = useMemo(() => rows.filter((r) => r.tracked).length, [rows])
  const missingDates = useMemo(() => rows.filter((r) => r.tracked && !r.installation_date), [rows])

  const applyBulkDate = () => {
    if (!bulkDate) return
    setRows((prev) => prev.map((r) => (r.tracked ? { ...r, installation_date: bulkDate } : r)))
  }

  const selectAll = (checked) => {
    setRows((prev) => prev.map((r) => ({ ...r, tracked: checked })))
  }

  const loadHistory = async () => {
    if (showHistory) {
      setShowHistory(false)
      return
    }
    setShowHistory(true)
    if (history.length > 0) return
    setHistoryLoading(true)
    try {
      const { logs } = await getAmcAuditLogs({ username, limit: 30 })
      setHistory(logs)
    } catch (error) {
      toast.error(error.message || "Failed to load history")
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleSave = async () => {
    if (missingDates.length > 0) {
      toast.error(`Installation date is required for: ${missingDates.map((r) => r.sensor_id).join(", ")}`)
      return
    }
    for (const row of rows) {
      if (row.amc_renewal_date && row.installation_date && row.amc_renewal_date < row.installation_date) {
        toast.error(`AMC renewal date cannot be before installation date (${row.sensor_id})`)
        return
      }
    }

    setIsSaving(true)
    try {
      const payload = rows.map((r) => ({
        sensor_id: r.sensor_id,
        tracked: r.tracked,
        installation_date: r.installation_date || null,
        amc_renewal_date: r.amc_renewal_date || null,
      }))
      const result = await saveAmcClientSensors(username, payload)
      toast.success(
        result?.changes ? `AMC tracking saved (${result.changes} change${result.changes === 1 ? "" : "s"} logged)` : "AMC tracking saved"
      )
      onSaved?.(result)
      onOpenChange?.(false)
    } catch (error) {
      toast.error(error.message || "Failed to save AMC tracking")
    } finally {
      setIsSaving(false)
    }
  }

  const formatAuditValue = (field, value) => {
    if (value === null || value === undefined || value === "") return "—"
    if (field === "tracked") return value ? "Tracked" : "Not tracked"
    return formatYmd(value)
  }

  const fieldLabel = (field) =>
    ({ tracked: "Tracking", installation_date: "Installation Date", amc_renewal_date: "AMC Renewal Date" })[field] || field

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AMC / Warranty Tracking — {client?.client_name || client?.username}</DialogTitle>
          <DialogDescription>
            Tick the sensors to track. A ticked sensor needs an installation date. Warranty expiry is
            installation + 1 year. After the warranty ends, enter the AMC renewal date and AMC expiry is
            renewal + 1 year. The client sees an alert {AMC_ALERT_WINDOW_DAYS} days before expiry.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No sensors are assigned to this client yet. Assign sites or sensors first.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {trackedCount} of {rows.length} sensor{rows.length === 1 ? "" : "s"} tracked
                </span>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => selectAll(true)}>
                  Select all
                </Button>
                <span>·</span>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => selectAll(false)}>
                  Clear all
                </Button>
              </div>
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="amc-bulk-date" className="text-xs">
                    Set installation date for all ticked
                  </Label>
                  <Input
                    id="amc-bulk-date"
                    type="date"
                    value={bulkDate}
                    max={todayYmd()}
                    onChange={(e) => setBulkDate(e.target.value)}
                    className="h-9 w-44"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={applyBulkDate} disabled={!bulkDate || trackedCount === 0}>
                  Apply
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">Track</TableHead>
                    <TableHead>Sensor ID</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Installation Date</TableHead>
                    <TableHead>Warranty Expiry</TableHead>
                    <TableHead>AMC Renewal Date</TableHead>
                    <TableHead>AMC Expiry</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const derived = deriveRow(row)
                    const missing = row.tracked && !row.installation_date
                    return (
                      <TableRow key={row.sensor_id} className={row.tracked ? "" : "opacity-70"}>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-green-600"
                            checked={row.tracked}
                            onChange={(e) => updateRow(row.sensor_id, { tracked: e.target.checked })}
                            aria-label={`Track ${row.sensor_id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.sensor_id}
                          {row.is_active === false && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.site_name || "-"}</TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={row.installation_date}
                            max={todayYmd()}
                            disabled={!row.tracked}
                            required={row.tracked}
                            aria-invalid={missing}
                            onChange={(e) => updateRow(row.sensor_id, { installation_date: e.target.value })}
                            className={`h-9 w-40 ${missing ? "border-destructive" : ""}`}
                          />
                          {missing && <p className="mt-1 text-xs text-destructive">Required</p>}
                        </TableCell>
                        <TableCell className="text-sm">{derived.warrantyExpiry ? formatYmd(derived.warrantyExpiry) : "-"}</TableCell>
                        <TableCell>
                          {row.tracked && derived.renewalAllowed ? (
                            <Input
                              type="date"
                              value={row.amc_renewal_date}
                              min={row.installation_date || undefined}
                              onChange={(e) => updateRow(row.sensor_id, { amc_renewal_date: e.target.value })}
                              className="h-9 w-40"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {row.tracked && derived.warrantyExpiry ? "After warranty expiry" : "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{derived.amcExpiry ? formatYmd(derived.amcExpiry) : "-"}</TableCell>
                        <TableCell>
                          {!row.tracked ? (
                            <Badge variant="outline">Not tracked</Badge>
                          ) : derived.alertActive ? (
                            <Badge variant="destructive" title={formatDaysRemaining(derived.daysRemaining)}>
                              {derived.expiryType} · {formatDaysRemaining(derived.daysRemaining)}
                            </Badge>
                          ) : derived.nextExpiry ? (
                            <Badge variant="secondary" title={formatDaysRemaining(derived.daysRemaining)}>
                              OK · {formatDaysRemaining(derived.daysRemaining)}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Set date</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div>
              <Button variant="ghost" size="sm" onClick={loadHistory} className="text-muted-foreground">
                <History className="mr-2 h-4 w-4" />
                Change history
                {showHistory ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}
              </Button>
              {showHistory && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-md border text-sm">
                  {historyLoading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : history.length === 0 ? (
                    <p className="p-4 text-center text-muted-foreground">No changes recorded yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>By</TableHead>
                          <TableHead>Sensor</TableHead>
                          <TableHead>Field</TableHead>
                          <TableHead>From</TableHead>
                          <TableHead>To</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {log.changed_at ? new Date(log.changed_at).toLocaleString("en-GB") : "-"}
                            </TableCell>
                            <TableCell className="text-xs">{log.changed_by}</TableCell>
                            <TableCell className="text-xs">{log.sensor_id}</TableCell>
                            <TableCell className="text-xs">{fieldLabel(log.field)}</TableCell>
                            <TableCell className="text-xs">{formatAuditValue(log.field, log.old_value)}</TableCell>
                            <TableCell className="text-xs">{formatAuditValue(log.field, log.new_value)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading || rows.length === 0}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

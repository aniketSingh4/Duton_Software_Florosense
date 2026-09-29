"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Search, X, Settings2, Download, FileSpreadsheet, FileText, RefreshCw, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import ExcelJS from "exceljs"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { getAmcClients, disableAmcForClient, getAmcExpiringList } from "@/utils/api"
import { AmcSensorDialog, formatYmd, formatDaysRemaining, AMC_ALERT_WINDOW_DAYS } from "./amc-sensor-dialog"

const PAGE_SIZE = 10

const EXPIRY_FILTERS = [
  { value: "both", label: "Both" },
  { value: "warranty", label: "Warranty Expiry" },
  { value: "amc", label: "AMC Expiry" },
]

const formatDateTime = (value) => (value ? new Date(value).toLocaleString("en-GB") : "-")

// ---------------------------------------------------------------------------
// Clients with AMC toggle
// ---------------------------------------------------------------------------
function AmcClientsPanel() {
  const [clients, setClients] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const searchTimer = useRef(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [disableTarget, setDisableTarget] = useState(null)
  const [isDisabling, setIsDisabling] = useState(false)

  const loadClients = useCallback(
    async (targetPage = page) => {
      setIsLoading(true)
      try {
        const { clients: data, totalCount: count } = await getAmcClients({
          skip: (targetPage - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
          search,
        })
        setClients(data)
        setTotalCount(count)
      } catch (error) {
        toast.error(error.message || "Failed to load clients")
      } finally {
        setIsLoading(false)
      }
    },
    [page, search]
  )

  useEffect(() => {
    loadClients(page)
  }, [page, loadClients])

  const handleSearchChange = (value) => {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setSearch(value.trim())
      setPage(1)
    }, 350)
  }

  const openDialog = (client) => {
    setSelectedClient(client)
    setDialogOpen(true)
  }

  const handleToggle = (client, next) => {
    if (next) {
      openDialog(client)
    } else {
      setDisableTarget(client)
    }
  }

  const confirmDisable = async () => {
    if (!disableTarget) return
    setIsDisabling(true)
    try {
      await disableAmcForClient(disableTarget.username)
      toast.success(`AMC tracking disabled for ${disableTarget.client_name || disableTarget.username}`)
      setDisableTarget(null)
      loadClients(page)
    } catch (error) {
      toast.error(error.message || "Failed to disable AMC tracking")
    } finally {
      setIsDisabling(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by username, email, or client name..."
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
        <Button variant="outline" size="sm" onClick={() => loadClients(page)} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {search ? `No clients match "${search}".` : "No clients found."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b-0 bg-slate-900 hover:bg-slate-900">
                <TableHead className="font-bold uppercase tracking-wide text-sky-100">Username</TableHead>
                <TableHead className="font-bold uppercase tracking-wide text-sky-100">Client Name</TableHead>
                <TableHead className="font-bold uppercase tracking-wide text-sky-100">Email</TableHead>
                <TableHead className="text-center font-bold uppercase tracking-wide text-sky-100">Tracked Sensors</TableHead>
                <TableHead className="text-center font-bold uppercase tracking-wide text-sky-100">Status</TableHead>
                <TableHead className="text-center font-bold uppercase tracking-wide text-sky-100">AMC</TableHead>
                <TableHead className="text-center font-bold uppercase tracking-wide text-sky-100">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow
                  key={client.username}
                  className={
                    !client.amc_enabled
                      ? ""
                      : client.alert_active
                        ? "bg-amber-50/80 hover:bg-amber-50 dark:bg-amber-950/20"
                        : "bg-teal-50/70 hover:bg-teal-50 dark:bg-teal-950/20"
                  }
                >
                  <TableCell className="font-semibold text-indigo-800 dark:text-indigo-200">{client.username}</TableCell>
                  <TableCell className="font-medium text-slate-800 dark:text-slate-100">{client.client_name || "-"}</TableCell>
                  <TableCell className="text-sm text-sky-700 dark:text-sky-300">{client.email || "-"}</TableCell>
                  <TableCell className="text-center font-semibold tabular-nums text-violet-700 dark:text-violet-300">{client.tracked_sensor_count}</TableCell>
                  <TableCell className="text-center">
                    {!client.amc_enabled ? (
                      <Badge variant="outline" className="border-slate-300 font-bold uppercase tracking-wide text-slate-500">
                        Off
                      </Badge>
                    ) : client.alert_active ? (
                      <Badge className="border-transparent bg-amber-500 font-bold uppercase tracking-wide text-white">
                        <AlertTriangle className="h-3 w-3" />
                        {client.alert_sensor_count} expiring
                      </Badge>
                    ) : (
                      <Badge className="border-transparent bg-teal-600 font-bold uppercase tracking-wide text-white">
                        Tracking
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={client.amc_enabled}
                      onCheckedChange={(next) => handleToggle(client, next)}
                      aria-label={`AMC tracking for ${client.username}`}
                      title={client.amc_enabled ? "Click to disable AMC tracking" : "Click to select sensors"}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="sm" className="text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800" onClick={() => openDialog(client)} title="Manage sensors and dates">
                      <Settings2 className="h-4 w-4" />
                    </Button>
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
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <AmcSensorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={selectedClient}
        onSaved={() => loadClients(page)}
      />

      <Dialog open={Boolean(disableTarget)} onOpenChange={(open) => !open && !isDisabling && setDisableTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable AMC tracking?</DialogTitle>
            <DialogDescription>
              This will stop tracking all {disableTarget?.tracked_sensor_count} sensor
              {disableTarget?.tracked_sensor_count === 1 ? "" : "s"} for{" "}
              <strong>{disableTarget?.client_name || disableTarget?.username}</strong> and remove the expiry alert from
              their dashboard. Dates are kept and can be re-enabled later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableTarget(null)} disabled={isDisabling}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDisable} disabled={isDisabling}>
              {isDisabling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Expiry monitoring list + downloads
// ---------------------------------------------------------------------------
const EXPORT_COLUMNS = [
  { header: "Type", key: "type", width: 12 },
  { header: "Client Name", key: "client_name", width: 26 },
  { header: "Site Name", key: "site_name", width: 24 },
  { header: "Site Address", key: "site_address", width: 34 },
  { header: "Sensor ID", key: "sensor_id", width: 18 },
  { header: "Installation Date", key: "installation_date", width: 18 },
  { header: "Warranty Expiry", key: "warranty_expiry", width: 18 },
  { header: "AMC Start (Renewal)", key: "amc_renewal_date", width: 20 },
  { header: "AMC Expiry", key: "amc_expiry", width: 18 },
  { header: "Expiry Date", key: "expiry_date", width: 18 },
  { header: "Remaining Validity", key: "remaining", width: 26 },
  { header: "Contact Person", key: "spoc_name", width: 22 },
  { header: "Contact Number", key: "spoc_contact", width: 18 },
  { header: "Email", key: "email", width: 28 },
]

const toExportRow = (row) => ({
  type: row.expiry_type === "amc" ? "AMC" : "Warranty",
  client_name: row.client_name || "-",
  site_name: row.site_name || "-",
  site_address: row.site_address || "-",
  sensor_id: row.sensor_id || "-",
  installation_date: formatYmd(row.installation_date),
  warranty_expiry: formatYmd(row.warranty_expiry),
  amc_renewal_date: formatYmd(row.amc_renewal_date),
  amc_expiry: formatYmd(row.amc_expiry),
  expiry_date: formatYmd(row.expiry_date),
  remaining: formatDaysRemaining(row.days_remaining),
  spoc_name: row.spoc_name || "-",
  spoc_contact: row.spoc_contact || "-",
  email: row.email || "-",
})

const filterLabel = (type) => EXPIRY_FILTERS.find((f) => f.value === type)?.label || "Both"

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function AmcExpiryPanel() {
  const [type, setType] = useState("both")
  const [rows, setRows] = useState([])
  const [generatedAt, setGeneratedAt] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getAmcExpiringList(type)
      setRows(data?.rows || [])
      setGeneratedAt(data?.generated_at || null)
    } catch (error) {
      toast.error(error.message || "Failed to load expiry list")
    } finally {
      setIsLoading(false)
    }
  }, [type])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(
    () => ({
      warranty: rows.filter((r) => r.expiry_type === "warranty").length,
      amc: rows.filter((r) => r.expiry_type === "amc").length,
    }),
    [rows]
  )

  const stamp = () => new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16)

  const exportExcel = async () => {
    if (rows.length === 0) return
    setIsExporting(true)
    try {
      const now = new Date()
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet("AMC & Warranty Expiry")

      sheet.addRow([`AMC & Warranty Expiry Report — ${filterLabel(type)} (next ${AMC_ALERT_WINDOW_DAYS} days)`])
      sheet.addRow([`Generated on: ${now.toLocaleString("en-GB")}`])
      sheet.addRow([])
      sheet.getRow(1).font = { bold: true, size: 13 }
      sheet.getRow(2).font = { italic: true }

      const headerRow = sheet.addRow(EXPORT_COLUMNS.map((c) => c.header))
      headerRow.font = { bold: true }
      EXPORT_COLUMNS.forEach((c, i) => {
        sheet.getColumn(i + 1).width = c.width
      })
      rows.forEach((row) => {
        const data = toExportRow(row)
        sheet.addRow(EXPORT_COLUMNS.map((c) => data[c.key]))
      })

      const buffer = await workbook.xlsx.writeBuffer()
      triggerDownload(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `amc-warranty-expiry-${type}-${stamp()}.xlsx`
      )
      toast.success("Excel report downloaded")
    } catch (error) {
      toast.error(error.message || "Failed to export Excel")
    } finally {
      setIsExporting(false)
    }
  }

  const exportPdf = () => {
    if (rows.length === 0) return
    setIsExporting(true)
    try {
      const now = new Date()
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
      doc.setFontSize(14)
      doc.text(`AMC & Warranty Expiry Report — ${filterLabel(type)} (next ${AMC_ALERT_WINDOW_DAYS} days)`, 40, 40)
      doc.setFontSize(10)
      doc.text(`Generated on: ${now.toLocaleString("en-GB")}    Records: ${rows.length}`, 40, 58)

      autoTable(doc, {
        startY: 72,
        head: [EXPORT_COLUMNS.map((c) => c.header)],
        body: rows.map((row) => {
          const data = toExportRow(row)
          return EXPORT_COLUMNS.map((c) => data[c.key])
        }),
        styles: { fontSize: 7, cellPadding: 3 },
        headStyles: { fillColor: [22, 101, 52] },
        margin: { left: 30, right: 30 },
        didDrawPage: (data) => {
          const pageSize = doc.internal.pageSize
          doc.setFontSize(8)
          doc.text(
            `Generated ${now.toLocaleString("en-GB")} · Page ${data.pageNumber}`,
            pageSize.getWidth() - 30,
            pageSize.getHeight() - 16,
            { align: "right" }
          )
        },
      })

      doc.save(`amc-warranty-expiry-${type}-${stamp()}.pdf`)
      toast.success("PDF report downloaded")
    } catch (error) {
      toast.error(error.message || "Failed to export PDF")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {EXPIRY_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={type === f.value ? "default" : "outline"}
              onClick={() => setType(f.value)}
              className={
                type === f.value
                  ? f.value === "amc"
                    ? "bg-indigo-700 font-bold uppercase tracking-wide text-white hover:bg-indigo-800"
                    : f.value === "warranty"
                      ? "bg-sky-700 font-bold uppercase tracking-wide text-white hover:bg-sky-800"
                      : "bg-slate-900 font-bold uppercase tracking-wide text-white hover:bg-slate-800"
                  : f.value === "amc"
                    ? "border-indigo-300 font-semibold uppercase tracking-wide text-indigo-700 hover:bg-indigo-50"
                    : f.value === "warranty"
                      ? "border-sky-300 font-semibold uppercase tracking-wide text-sky-700 hover:bg-sky-50"
                      : "border-slate-300 font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
              }
            >
              {f.label}
            </Button>
          ))}
          <span className="ml-1 inline-flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Within {AMC_ALERT_WINDOW_DAYS} days
            </span>
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 tabular-nums text-sky-800 dark:bg-sky-950 dark:text-sky-200">
              Warranty {counts.warranty}
            </span>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 tabular-nums text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
              AMC {counts.amc}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="border-emerald-400 text-emerald-800 hover:bg-emerald-50" onClick={exportExcel} disabled={isExporting || isLoading || rows.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" size="sm" className="border-rose-400 text-rose-800 hover:bg-rose-50" onClick={exportPdf} disabled={isExporting || isLoading || rows.length === 0}>
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No {type === "both" ? "warranty or AMC" : type === "amc" ? "AMC" : "warranty"} expiries in the next{" "}
            {AMC_ALERT_WINDOW_DAYS} days.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-0 bg-slate-900 hover:bg-slate-900">
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">Type</TableHead>
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">Client</TableHead>
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">Site</TableHead>
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">Address</TableHead>
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">Sensor ID</TableHead>
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">Installation</TableHead>
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">AMC Start</TableHead>
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">Expiry Date</TableHead>
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">Remaining</TableHead>
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const expired = row.days_remaining !== null && row.days_remaining < 0
                  return (
                    <TableRow
                      key={`${row.expiry_type}-${row.sensor_id}`}
                      className={expired ? "bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/30" : "bg-amber-50/80 hover:bg-amber-100/70 dark:bg-amber-950/20"}
                    >
                      <TableCell>
                        <Badge
                          className={
                            row.expiry_type === "amc"
                              ? "border-transparent bg-indigo-700 font-bold uppercase tracking-wide text-white"
                              : "border-transparent bg-sky-700 font-bold uppercase tracking-wide text-white"
                          }
                        >
                          {row.expiry_type === "amc" ? "AMC" : "Warranty"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800 dark:text-slate-100">
                        {row.client_name}
                        <div className="text-xs font-medium text-indigo-600 dark:text-indigo-300">{row.username}</div>
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-200">{row.site_name}</TableCell>
                      <TableCell className="max-w-56 truncate text-slate-600" title={row.site_address}>
                        {row.site_address}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums text-violet-700 dark:text-violet-300">{row.sensor_id}</TableCell>
                      <TableCell className="whitespace-nowrap font-semibold tabular-nums">{formatYmd(row.installation_date)}</TableCell>
                      <TableCell className="whitespace-nowrap font-semibold tabular-nums">{formatYmd(row.amc_renewal_date)}</TableCell>
                      <TableCell className="whitespace-nowrap font-semibold tabular-nums">{formatYmd(row.expiry_date)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {expired ? (
                          <Badge className="border-transparent bg-rose-600 font-bold tabular-nums text-white">
                            {formatDaysRemaining(row.days_remaining)}
                          </Badge>
                        ) : (
                          <span className="font-bold tabular-nums text-amber-800 dark:text-amber-200">
                            {formatDaysRemaining(row.days_remaining)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{row.spoc_name}</div>
                        <div className="text-xs text-muted-foreground">{row.spoc_contact}</div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {!isLoading && generatedAt && (
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            Generated {formatDateTime(generatedAt)} · {rows.length} record{rows.length === 1 ? "" : "s"}
          </div>
        )}
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AMC Features tab
// ---------------------------------------------------------------------------
export function AmcFeatures() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-indigo-900 to-sky-800 px-5 py-4 text-white shadow-md">
        <h2 className="text-2xl font-bold tracking-tight">AMC Features</h2>
        <p className="mt-1 text-sm font-medium text-sky-100">
          Track warranty and AMC validity per sensor. Clients see a dashboard alert {AMC_ALERT_WINDOW_DAYS} days
          before expiry.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wide">
          <span className="rounded-full bg-teal-500/90 px-2.5 py-0.5">Tracking</span>
          <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-amber-950">Expiring</span>
          <span className="rounded-full bg-rose-600 px-2.5 py-0.5">Expired</span>
          <span className="rounded-full bg-indigo-500 px-2.5 py-0.5">AMC</span>
          <span className="rounded-full bg-sky-500 px-2.5 py-0.5">Warranty</span>
        </div>
      </div>

      <Tabs defaultValue="clients" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-100">
          <TabsTrigger value="clients" className="font-semibold data-[state=active]:bg-indigo-700 data-[state=active]:text-white">
            Clients
          </TabsTrigger>
          <TabsTrigger value="expiry" className="font-semibold data-[state=active]:bg-sky-700 data-[state=active]:text-white">
            <Download className="mr-2 h-4 w-4" />
            Expiry List
          </TabsTrigger>
        </TabsList>
        <TabsContent value="clients" className="mt-4">
          <AmcClientsPanel />
        </TabsContent>
        <TabsContent value="expiry" className="mt-4">
          <AmcExpiryPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

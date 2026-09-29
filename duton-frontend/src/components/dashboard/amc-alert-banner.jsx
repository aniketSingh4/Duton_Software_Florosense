"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { getMyAmcAlert } from "@/utils/api"
import { getClientUserContext } from "@/lib/user-context"
import { formatYmd, formatDaysRemaining } from "./amc-sensor-dialog"

export const AMC_ALERT_MESSAGE =
  "AMC Expiry Alert: Your AMC is expiring soon. For uninterrupted service, please contact ops2@florosense.com for renewal"

const LOGIN_ALERT_KEY = "duton_amc_login_alert"

// Scrolling marquee shown at the top of the client dashboard when any tracked
// sensor of the logged-in client is within the expiry alert window.
// A dialog opens once after login, and again from "See sites".
export function AmcAlertBanner() {
  const [alert, setAlert] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const { isAdmin, role } = getClientUserContext()
    if (isAdmin || !role) return undefined

    const pendingLoginAlert =
      typeof window !== "undefined" && sessionStorage.getItem(LOGIN_ALERT_KEY) === "1"

    getMyAmcAlert()
      .then((data) => {
        if (cancelled) return
        setAlert(data)
        if (!pendingLoginAlert) return
        sessionStorage.removeItem(LOGIN_ALERT_KEY)
        if (data?.alert_active) setOpen(true)
      })
      .catch((error) => {
        console.error("[AmcAlertBanner] Failed to load AMC alert:", error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!alert?.alert_active) return null

  const sensors = alert.sensors || []
  const expired = sensors.filter((s) => s.expired)
  const expiring = sensors.filter((s) => !s.expired)

  const hasExpired = expired.length > 0

  const renderRow = (s) => (
    <TableRow key={s.sensor_id} className={s.expired ? "bg-rose-50 dark:bg-rose-950/30" : "bg-amber-50/80 dark:bg-amber-950/20"}>
      <TableCell className="font-semibold text-slate-800 dark:text-slate-100">{s.site_name || "-"}</TableCell>
      <TableCell className="font-semibold tabular-nums text-violet-800 dark:text-violet-200">{s.sensor_id}</TableCell>
      <TableCell>
        <Badge
          className={
            s.expiry_type === "amc"
              ? "border-transparent bg-indigo-700 font-bold uppercase tracking-wide text-white"
              : "border-transparent bg-sky-700 font-bold uppercase tracking-wide text-white"
          }
        >
          {s.expiry_type === "amc" ? "AMC" : "Warranty"}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap font-semibold tabular-nums text-slate-700">{formatYmd(s.next_expiry)}</TableCell>
      <TableCell>
        {s.expired ? (
          <Badge className="border-transparent bg-rose-600 font-bold tabular-nums text-white">
            {formatDaysRemaining(s.days_remaining)}
          </Badge>
        ) : (
          <span className="font-bold tabular-nums text-amber-800 dark:text-amber-200">
            {formatDaysRemaining(s.days_remaining)}
          </span>
        )}
      </TableCell>
    </TableRow>
  )

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className={
          hasExpired
            ? "amc-marquee w-full border-b border-rose-900 bg-gradient-to-r from-rose-700 via-rose-600 to-slate-900 text-white"
            : "amc-marquee w-full border-b border-indigo-900 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-800 text-white"
        }
        title={AMC_ALERT_MESSAGE}
      >
        <div className="amc-marquee-track py-2.5 text-sm font-extrabold tracking-wide">
          <AlertTriangle className="mr-2 inline h-4 w-4 align-text-bottom" />
          {AMC_ALERT_MESSAGE}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-3 inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/15 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wide text-white hover:bg-white/25"
          >
            See sites
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div
              className={
                hasExpired
                  ? "rounded-lg bg-gradient-to-r from-rose-700 to-slate-900 px-4 py-3 text-white"
                  : "rounded-lg bg-gradient-to-r from-amber-500 to-indigo-900 px-4 py-3 text-white"
              }
            >
              <DialogTitle className="text-xl font-bold tracking-tight text-white">AMC expiry alert</DialogTitle>
              <DialogDescription className="mt-1 text-sm font-semibold text-amber-50">
                {AMC_ALERT_MESSAGE}
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 text-sm font-semibold tabular-nums">
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                {expired.length} expired
              </span>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {expiring.length} expiring soon
              </span>
            </div>
          </DialogHeader>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="border-b-0 bg-slate-900 hover:bg-slate-900">
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">Site</TableHead>
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">Sensor ID</TableHead>
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">Type</TableHead>
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">Expiry Date</TableHead>
                  <TableHead className="font-bold uppercase tracking-wide text-sky-100">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expired.map(renderRow)}
                {expiring.map(renderRow)}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

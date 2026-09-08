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

// Scrolling marquee shown at the top of the client dashboard when any tracked
// sensor of the logged-in client is within the expiry alert window.
// "See sites" opens a popup listing expired (red, on top) and expiring sites.
export function AmcAlertBanner() {
  const [alert, setAlert] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const { isAdmin, role } = getClientUserContext()
    if (isAdmin || !role) return undefined

    getMyAmcAlert()
      .then((data) => {
        if (!cancelled) setAlert(data)
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

  const renderRow = (s) => (
    <TableRow key={s.sensor_id} className={s.expired ? "bg-destructive/10" : ""}>
      <TableCell className="font-medium">{s.site_name || "-"}</TableCell>
      <TableCell>{s.sensor_id}</TableCell>
      <TableCell>{s.expiry_type === "amc" ? "AMC" : "Warranty"}</TableCell>
      <TableCell className="whitespace-nowrap">{formatYmd(s.next_expiry)}</TableCell>
      <TableCell>
        {s.expired ? (
          <Badge variant="destructive">{formatDaysRemaining(s.days_remaining)}</Badge>
        ) : (
          <Badge variant="secondary">{formatDaysRemaining(s.days_remaining)}</Badge>
        )}
      </TableCell>
    </TableRow>
  )

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="amc-marquee w-full border-b border-amber-500/40 bg-amber-500 text-amber-950 dark:bg-amber-500/90"
        title={AMC_ALERT_MESSAGE}
      >
        <div className="amc-marquee-track py-2 text-sm font-semibold">
          <AlertTriangle className="mr-2 inline h-4 w-4 align-text-bottom" />
          {AMC_ALERT_MESSAGE}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-3 inline-flex items-center gap-1 rounded-full border border-amber-950/40 bg-amber-950/10 px-3 py-0.5 text-xs font-bold underline-offset-2 hover:bg-amber-950/20 hover:underline"
          >
            See sites
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AMC / Warranty status</DialogTitle>
            <DialogDescription>
              {expired.length} expired · {expiring.length} expiring soon. Contact ops2@florosense.com for renewal.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Sensor ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
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

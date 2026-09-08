"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, TrendingUp, CheckCircle2, Clock, User, Download } from "lucide-react"
import { fetchAssignees, fetchAssigneePerformance } from "@/utils/api"
import { toast } from "sonner"
import ExcelJS from "exceljs"

export function AssigneePerformanceModal({ open, onOpenChange }) {
  const [assignees, setAssignees] = useState([])
  const [selectedAssignee, setSelectedAssignee] = useState("")
  const [timePeriod, setTimePeriod] = useState("month")
  const [performance, setPerformance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingAssignees, setLoadingAssignees] = useState(false)

  // Fetch assignees on mount
  useEffect(() => {
    if (open) {
      const loadAssignees = async () => {
        setLoadingAssignees(true)
        try {
          const data = await fetchAssignees()
          setAssignees(data || [])
          if (data && data.length > 0 && !selectedAssignee) {
            setSelectedAssignee("all")
          }
        } catch (error) {
          console.error("Failed to load assignees:", error)
          toast.error("Failed to load assignees")
        } finally {
          setLoadingAssignees(false)
        }
      }
      loadAssignees()
    }
  }, [open])

  // Fetch performance when assignee or time period changes
  useEffect(() => {
    if (open && selectedAssignee && selectedAssignee !== "all") {
      const loadPerformance = async () => {
        setLoading(true)
        try {
          const data = await fetchAssigneePerformance(selectedAssignee, timePeriod)
          setPerformance(data)
        } catch (error) {
          console.error("Failed to load performance:", error)
          toast.error("Failed to load performance data")
          setPerformance(null)
        } finally {
          setLoading(false)
        }
      }
      loadPerformance()
    } else if (open && selectedAssignee === "all") {
      // Clear performance when "All Assignees" is selected
      setPerformance(null)
      setLoading(false)
    }
  }, [open, selectedAssignee, timePeriod])

  const selectedAssigneeData = assignees.find(a => a.username === selectedAssignee)

  // Export assignee(s) performance to Excel based on selection
  const handleExportPerformance = async () => {
    if (!assignees || assignees.length === 0) {
      toast.error("No assignees available to export")
      return
    }

    // Determine which assignees to export
    const assigneesToExport = selectedAssignee === "all"
      ? assignees
      : assignees.filter(a => (a.username || a.id) === selectedAssignee)

    if (assigneesToExport.length === 0) {
      toast.error("No assignees selected for export")
      return
    }

    try {
      const exportType = selectedAssignee === "all" ? "all assignees" : "selected assignee"
      toast.info(`Fetching performance data for ${exportType}...`)

      // Fetch performance data for selected assignees
      const performanceDataList = await Promise.allSettled(
        assigneesToExport.map(async (assignee) => {
          try {
            const perf = await fetchAssigneePerformance(assignee.username || assignee.id, timePeriod)
            return {
              assignee: assignee,
              performance: perf,
              success: true
            }
          } catch (error) {
            console.error(`Failed to fetch performance for ${assignee.username}:`, error)
            return {
              assignee: assignee,
              performance: null,
              success: false
            }
          }
        })
      )

      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet("Assignee Performance")

      // Define columns
      worksheet.columns = [
        { header: "Assignee Name", key: "displayName", width: 25 },
        { header: "Username", key: "username", width: 20 },
        { header: "Email", key: "email", width: 30 },
        { header: "Time Period", key: "periodLabel", width: 15 },
        { header: "Start Date", key: "startDate", width: 15 },
        { header: "End Date", key: "endDate", width: 15 },
        { header: "Total Assigned", key: "total", width: 15 },
        { header: "Closed Tickets", key: "closed", width: 15 },
        { header: "Open Tickets", key: "open", width: 15 },
        { header: "Completion Rate (%)", key: "rate", width: 18 },
        { header: "Pending Tickets", key: "pending", width: 15 },
      ]

      // Format header row
      worksheet.getRow(1).font = { bold: true }

      // Add data rows
      performanceDataList.forEach((result, index) => {
        const periodLabel = timePeriod === "week" ? "Last 7 Days" : timePeriod === "month" ? "Last Month" : "Last Year"

        if (result.status === "fulfilled" && result.value.success && result.value.performance) {
          const { assignee, performance } = result.value
          const displayName = assignee.full_name || assignee.username || assignee.id || "Unknown"

          worksheet.addRow({
            displayName,
            username: assignee.username || assignee.id || "N/A",
            email: assignee.email || "N/A",
            periodLabel,
            startDate: performance.start_date ? new Date(performance.start_date).toLocaleDateString() : "N/A",
            endDate: performance.end_date ? new Date(performance.end_date).toLocaleDateString() : "N/A",
            total: performance.total_assigned || 0,
            closed: performance.closed || 0,
            open: performance.open || 0,
            rate: performance.completion_rate || 0,
            pending: (performance.total_assigned || 0) - (performance.closed || 0) - (performance.open || 0),
          })
        } else {
          const assignee = result.status === "fulfilled" ? result.value.assignee : assignees[index]
          const displayName = assignee?.full_name || assignee?.username || assignee?.id || "Unknown"

          worksheet.addRow({
            displayName,
            username: assignee?.username || assignee?.id || "N/A",
            email: assignee?.email || "N/A",
            periodLabel,
            startDate: "N/A",
            endDate: "N/A",
            total: 0,
            closed: 0,
            open: 0,
            rate: 0,
            pending: 0,
          })
        }
      })

      // Generate filename
      const now = new Date()
      const dateStr = now.toISOString().split("T")[0]
      const periodFileLabel = timePeriod === "week" ? "7days" : timePeriod === "month" ? "month" : "year"
      let filename = `assignee_performance_${periodFileLabel}_${dateStr}`

      if (selectedAssignee !== "all" && assigneesToExport.length === 1) {
        const assigneeName = assigneesToExport[0].full_name || assigneesToExport[0].username || assigneesToExport[0].id
        filename += `_${assigneeName.replace(/\s+/g, "_")}`
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

      const exportMessage = selectedAssignee === "all"
        ? `Exported performance data for all ${performanceDataList.length} assignee(s) to Excel`
        : `Exported performance data for ${performanceDataList.length} assignee(s) to Excel`
      toast.success(exportMessage)
    } catch (error) {
      console.error("Error exporting assignee performance:", error)
      toast.error("Failed to export assignee performance data")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Assignee Performance
            </div>
            {assignees.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPerformance}
                className="flex items-center gap-2"
                disabled={!selectedAssignee || selectedAssignee === ""}
              >
                <Download className="h-4 w-4" />
                {selectedAssignee === "all" ? "Export All" : "Export"}
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            View performance metrics for assignees based on ticket assignments and completions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Assignee Selection */}
          <div className="space-y-2">
            <Label htmlFor="assignee-select">Select Assignee</Label>
            <select
              id="assignee-select"
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="w-full border-input h-10 rounded-md border bg-background px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
              disabled={loadingAssignees}
            >
              {loadingAssignees ? (
                <option value="">Loading assignees...</option>
              ) : assignees.length === 0 ? (
                <option value="">No assignees found</option>
              ) : (
                <>
                  <option value="all">All Assignees</option>
                  {assignees.map((assignee) => {
                    const displayName = assignee.full_name || assignee.username || "Unknown"
                    const displayEmail = assignee.email ? ` (${assignee.email})` : ""
                    return (
                      <option key={assignee.username || assignee.id} value={assignee.username || ""}>
                        {displayName}{displayEmail}
                      </option>
                    )
                  })}
                </>
              )}
            </select>
          </div>

          {/* Time Period Selection */}
          <div className="space-y-2">
            <Label htmlFor="time-period-select">Time Period</Label>
            <select
              id="time-period-select"
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value)}
              className="w-full border-input h-10 rounded-md border bg-background px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
            </select>
          </div>

          {/* Performance Stats */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading performance data...
            </div>
          ) : selectedAssignee === "all" ? (
            <div className="text-center py-8 text-muted-foreground">
              Select a specific assignee to view their performance, or click "Export All" to export all assignees' performance data.
            </div>
          ) : performance && selectedAssignee ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {selectedAssigneeData?.full_name || selectedAssigneeData?.username || selectedAssignee}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Total Assigned */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Total Assigned</span>
                    </div>
                    <span className="text-lg font-semibold">{performance.total_assigned || 0}</span>
                  </div>

                  {/* Closed Tickets */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Closed</span>
                    </div>
                    <span className="text-lg font-semibold text-green-600">{performance.closed || 0}</span>
                  </div>

                  {/* Open Tickets */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">Open</span>
                    </div>
                    <span className="text-lg font-semibold text-orange-600">{performance.open || 0}</span>
                  </div>

                  {/* Completion Rate */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <span className="text-sm font-semibold">Completion Rate</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-primary">{performance.completion_rate || 0}%</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {performance.closed || 0} of {performance.total_assigned || 0} tickets
                      </p>
                    </div>
                  </div>

                  {/* Time Period Info */}
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    <p>Period: {new Date(performance.start_date).toLocaleDateString()} - {new Date(performance.end_date).toLocaleDateString()}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : selectedAssignee ? (
            <div className="text-center py-8 text-muted-foreground">
              No performance data available for this assignee
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Please select an assignee to view performance
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}


"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Download, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { fetchHistoricalData } from "@/utils/api"
import ExcelJS from "exceljs"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { toast } from "sonner"

const BASE_HEADERS = ["project_name", "timestamp", "pm2.5", "pm10", "temperature", "humidity"]

export function DownloadHistoricalData({ sensorId, projectName }) {
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [startTime, setStartTime] = useState("00:00")
  const [endTime, setEndTime] = useState("23:59")
  const [dataFormat, setDataFormat] = useState("CSV")
  const [sortOrder, setSortOrder] = useState("asc")
  const [isDownloading, setIsDownloading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    let role = null
    const userType = window.localStorage.getItem("user_type")

    if (userType === "admin") {
      role = "admin"
    }

    if (!role) {
      try {
        const token = window.localStorage.getItem("duton_access_token")
        if (token) {
          const payload = JSON.parse(atob(token.split(".")[1]))
          role = payload?.role || null
        }
      } catch {
      }
    }

    setIsAdmin(role === "admin")
  }, [])

  const formatDateTime = (date, time, { isEnd = false } = {}) => {
    if (!date) return null

    let hours = "00"
    let minutes = "00"

    if (typeof time === "string" && time.length > 0) {
      const [rawHours, rawMinutes] = time.split(":")
      hours = rawHours?.trim() || "00"
      minutes = rawMinutes?.trim() || "00"
    } else if (isEnd) {
      hours = "23"
      minutes = "59"
    }

    const hourNumber = Number.isNaN(parseInt(hours, 10)) ? 0 : parseInt(hours, 10)
    const minuteNumber = Number.isNaN(parseInt(minutes, 10)) ? 0 : parseInt(minutes, 10)

    const dateTime = new Date(date)
    dateTime.setHours(hourNumber, minuteNumber, 0, 0)
    // Format as YYYY-MM-DDTHH:MM for API
    const year = dateTime.getFullYear()
    const month = String(dateTime.getMonth() + 1).padStart(2, "0")
    const day = String(dateTime.getDate()).padStart(2, "0")
    const hoursStr = String(dateTime.getHours()).padStart(2, "0")
    const minutesStr = String(dateTime.getMinutes()).padStart(2, "0")
    return `${year}-${month}-${day}T${hoursStr}:${minutesStr}`
  }

  const handleDownload = async () => {
    if (!sensorId) {
      toast.error("Sensor ID is required")
      return
    }

    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates")
      return
    }

    if (startDate > endDate) {
      toast.error("Start date must be before end date")
      return
    }

    const timeDiff = endDate.getTime() - startDate.getTime()
    const diffDays = timeDiff / (1000 * 3600 * 24)

    if (!isAdmin && diffDays > 30) {
      toast.error("Please select up to 30 days to start downloading the data")
      return
    }

    setIsDownloading(true)

    try {
      const startDateStr = formatDateTime(startDate, startTime)
      const endDateStr = formatDateTime(endDate, endTime, { isEnd: true })

      if (!startDateStr || !endDateStr) {
        toast.error("Please select valid dates")
        setIsDownloading(false)
        return
      }


      // Fetch historical data
      // Fetch historical data via proxy
      // Fetch historical data via proxy with pagination
      let allData = []
      let offset = 0
      const limit = 10000
      let hasMore = true

      while (hasMore) {
        const params = new URLSearchParams({
          sensorId,
          start_date: startDateStr.replace("T", " ") + ":00",
          end_date: endDateStr.replace("T", " ") + ":00",
          limit: String(limit),
          offset: String(offset),
          sort_order: sortOrder
        })

        const response = await fetch(`/api/proxy/historical-download?${params.toString()}`)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || "Failed to fetch historical data")
        }

        const jsonData = await response.json()
        // Handle various response structures
        const chunk = jsonData.data || jsonData.readings || (Array.isArray(jsonData) ? jsonData : [])

        if (Array.isArray(chunk) && chunk.length > 0) {
          allData = [...allData, ...chunk]

          if (chunk.length < limit) {
            hasMore = false
          } else {
            offset += limit
          }
        } else {
          hasMore = false
        }
      }

      let data = allData
      const hasRecords = Array.isArray(data) && data.length > 0

      if (!hasRecords) {
        toast.info(
          "No historical records were found in the database for the selected range. " +
          "Downloading a blank template instead."
        )
      }

      // Prepare data for download - project_name as first column before sensor_id
      // Always include project_name even if no records
      const formattedData = hasRecords
        ? data.map((item) => ({
          project_name: projectName || "N/A",
          timestamp: item.timestamp || item.created_at || item.Timestamp || "",
          "pm2.5": item.pms_2_5 ?? item.pm2_5 ?? item["PM 2.5"] ?? "",
          pm10: item.pms_10 ?? item.pm10_0 ?? item["PM 10"] ?? "",
          temperature: item.temperature ?? item.ambient_temperature ?? item.Temperature ?? "",
          humidity: item.humidity ?? item.relative_humidity ?? item.Humidity ?? "",
        }))
        : [{
          project_name: projectName || "N/A",
          timestamp: "",
          "pm2.5": "",
          pm10: "",
          temperature: "",
          humidity: "",
        }]

      if (hasRecords) {
      }

      const filename = `sensor_data_${sensorId}_${startDateStr}_${endDateStr}`
      const totalRecords = formattedData.length

      // Download based on format
      try {

        // Call download function - pass projectName to all download functions
        switch (dataFormat.toUpperCase()) {
          case "CSV":
            downloadCSV(formattedData, filename, sensorId, startDateStr, endDateStr, totalRecords, projectName)
            break
          case "JSON":
            downloadJSON(formattedData, filename, sensorId, startDateStr, endDateStr, totalRecords, projectName)
            break
          case "EXCEL":
            await downloadExcel(formattedData, filename, sensorId, startDateStr, endDateStr, totalRecords, projectName)
            break
          case "PDF":
            downloadPDF(formattedData, filename, sensorId, startDateStr, endDateStr, totalRecords, projectName)
            break
          default:
            throw new Error("Invalid format selected")
        }

        // Small delay to ensure download completes before showing success
        await new Promise((resolve) => setTimeout(resolve, 500))

        toast.success(`Data downloaded successfully in ${dataFormat} format`)
      } catch (downloadError) {
        console.error("Download function error:", downloadError)
        console.error("Error stack:", downloadError.stack)
        toast.error(downloadError.message || "Failed to download file. Check browser console for details.")
        throw downloadError
      }
    } catch (error) {
      console.error("Download error:", error)
      toast.error(error.message || "Failed to download data")
    } finally {
      setIsDownloading(false)
    }
  }

  const downloadCSV = (data, filename, sensorId, startDate, endDate, totalRecords, projectName) => {
    try {
      // Ensure project_name is always first in headers
      const headers = data?.length ? Object.keys(data[0]) : BASE_HEADERS
      // Make sure project_name is first even if data exists
      const orderedHeaders = headers.includes("project_name")
        ? ["project_name", ...headers.filter(h => h !== "project_name")]
        : BASE_HEADERS

      // Add all metadata as comment rows at the top
      const downloadTimestamp = new Date().toISOString()
      const downloadTimestampLocal = new Date().toLocaleString()
      const csvRows = [
        `# Project Name: ${projectName || "N/A"}`,
        `# Sensor ID: ${sensorId}`,
        `# Start Date: ${startDate}`,
        `# End Date: ${endDate}`,
        `# Total Records: ${totalRecords}`,
        `# Downloaded on: ${downloadTimestampLocal}`,
        `# (UTC: ${downloadTimestamp})`,
        orderedHeaders.join(",")
      ]

      if (data?.length) {
        data.forEach((row) => {
          const csvRow = orderedHeaders
            .map((header) => {
              const value = row[header]
              if (value === null || value === undefined) return ""
              const stringValue = String(value)
              if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
                return `"${stringValue.replace(/"/g, '""')}"`
              }
              return stringValue
            })
            .join(",")
          csvRows.push(csvRow)
        })
      }

      const csvContent = csvRows.join("\n")

      // Use BOM for UTF-8 to ensure proper encoding
      const BOM = "\uFEFF"
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })

      // Create download link and trigger immediately
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)

      link.href = url
      link.download = `${filename}.csv`
      link.style.position = "fixed"
      link.style.top = "-9999px"
      link.style.left = "-9999px"

      document.body.appendChild(link)

      // Trigger download immediately
      link.click()

      // Cleanup after a short delay
      setTimeout(() => {
        try {
          if (link.parentNode) {
            document.body.removeChild(link)
          }
          URL.revokeObjectURL(url)
        } catch (e) {
        }
      }, 1000)
    } catch (error) {
      console.error("CSV download error:", error)
      throw new Error(`Failed to generate CSV file: ${error.message}`)
    }
  }

  const downloadJSON = (data, filename, sensorId, startDate, endDate, totalRecords, projectName) => {
    try {

      // Add all metadata to JSON
      const downloadTimestamp = new Date().toISOString()
      const downloadTimestampLocal = new Date().toLocaleString()
      const jsonData = {
        metadata: {
          project_name: projectName || "N/A",
          sensor_id: sensorId,
          start_date: startDate,
          end_date: endDate,
          total_records: totalRecords,
          downloaded_on: downloadTimestampLocal,
          downloaded_on_utc: downloadTimestamp,
        },
        data: data ?? []
      }

      const jsonContent = JSON.stringify(jsonData, null, 2)

      const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" })

      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)

      link.href = url
      link.download = `${filename}.json`
      link.style.position = "fixed"
      link.style.top = "-9999px"
      link.style.left = "-9999px"

      document.body.appendChild(link)

      // Trigger download immediately
      link.click()

      setTimeout(() => {
        try {
          if (link.parentNode) {
            document.body.removeChild(link)
          }
          URL.revokeObjectURL(url)
        } catch (e) {
        }
      }, 1000)
    } catch (error) {
      console.error("JSON download error:", error)
      throw new Error(`Failed to generate JSON file: ${error.message}`)
    }
  }

  const downloadExcel = async (data, filename, sensorId, startDate, endDate, totalRecords, projectName) => {
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet("Sensor Data")

      // Add metadata as first rows
      const downloadTimestamp = new Date().toISOString()
      const downloadTimestampLocal = new Date().toLocaleString()

      worksheet.addRow([`Project Name: ${projectName || "N/A"}`])
      worksheet.addRow([`Sensor ID: ${sensorId}`])
      worksheet.addRow([`Start Date: ${startDate}`])
      worksheet.addRow([`End Date: ${endDate}`])
      worksheet.addRow([`Total Records: ${totalRecords}`])
      worksheet.addRow([`Downloaded on: ${downloadTimestampLocal}`])
      worksheet.addRow([`(UTC: ${downloadTimestamp})`])

      // Add empty row for spacing
      worksheet.addRow([])

      // Get headers from first data row or fallback to BASE_HEADERS
      const headers = data?.length ? Object.keys(data[0]) : BASE_HEADERS
      const orderedHeaders = headers.includes("project_name")
        ? ["project_name", ...headers.filter(h => h !== "project_name")]
        : BASE_HEADERS

      // Add column headers
      const headerRow = worksheet.addRow(orderedHeaders.map(h => h.toUpperCase()))
      headerRow.font = { bold: true }

      // Add actual data
      if (data?.length > 0) {
        data.forEach(row => {
          worksheet.addRow(orderedHeaders.map(header => row[header]))
        })
      }

      // Auto-size columns
      worksheet.columns.forEach(column => {
        column.width = 20
      })

      // Generate buffer and trigger download
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${filename}.xlsx`
      link.click()

      // Cleanup
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      console.error("Excel download error:", error)
      throw new Error(`Failed to generate Excel file: ${error.message}`)
    }
  }

  const downloadPDF = (data, filename, sensorId, startDate, endDate, totalRecords, projectName) => {
    try {
      const hasRows = Array.isArray(data) && data.length > 0
      const doc = new jsPDF()

      // Add title
      doc.setFontSize(16)
      doc.text("Sensor Historical Data Report", 14, 15)

      // Add all metadata
      const downloadTimestamp = new Date().toISOString()
      const downloadTimestampLocal = new Date().toLocaleString()

      doc.setFontSize(10)
      let yPos = 25
      doc.text(`Project Name: ${projectName || "N/A"}`, 14, yPos)
      yPos += 5
      doc.text(`Sensor ID: ${sensorId}`, 14, yPos)
      yPos += 5
      doc.text(`Start Date: ${startDate}`, 14, yPos)
      yPos += 5
      doc.text(`End Date: ${endDate}`, 14, yPos)
      yPos += 5
      doc.text(`Total Records: ${totalRecords}`, 14, yPos)
      yPos += 5
      doc.text(`Downloaded on: ${downloadTimestampLocal}`, 14, yPos)
      yPos += 5
      doc.text(`(UTC: ${downloadTimestamp})`, 14, yPos)

      // Prepare table data - limit rows per page to avoid issues
      const maxRowsPerPage = 25

      if (hasRows) {
        const pages = Math.ceil(data.length / maxRowsPerPage)

        for (let page = 0; page < pages; page++) {
          if (page > 0) {
            doc.addPage()
          }

          const startIdx = page * maxRowsPerPage
          const endIdx = Math.min(startIdx + maxRowsPerPage, data.length)
          const pageData = data.slice(startIdx, endIdx)

          const tableData = pageData.map((row) => [
            String(row.project_name || ""),
            String(row.timestamp || "").substring(0, 19),
            String(row["pm2.5"] || ""),
            String(row.pm10 || ""),
            String(row.temperature || ""),
            String(row.humidity || ""),
          ])

          // Add table
          autoTable(doc, {
            startY: page === 0 ? yPos + 10 : 20,
            head: [["Project Name", "Timestamp", "PM 2.5", "PM 10", "Temperature", "Humidity"]],
            body: tableData,
            theme: "striped",
            styles: { fontSize: 7 },
            headStyles: { fillColor: [66, 139, 202] },
          })
        }
      } else {
        doc.setFontSize(12)
        doc.text("No historical records were found for the selected range.", 14, yPos + 10)
      }

      doc.save(`${filename}.pdf`)
    } catch (error) {
      console.error("PDF download error:", error)
      throw new Error(`Failed to generate PDF file: ${error.message}`)
    }
  }

  return (
    <Card className="shadow-sm border-border/50 py-4">
      <CardHeader className="pb-2 pt-0 px-4">
        <CardTitle className="text-base font-semibold">Download Historical Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4 pt-0">
        {/* Start Time */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Start Time</label>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy") : "dd/mm/yyyy"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-24"
              placeholder="--:--"
            />
          </div>
        </div>

        {/* End Time */}
        <div className="space-y-2">
          <label className="text-sm font-medium">End Time</label>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yyyy") : "dd/mm/yyyy"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-24"
              placeholder="--:--"
            />
          </div>
        </div>

        {/* Format */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Format</label>
          <select
            value={dataFormat}
            onChange={(e) => setDataFormat(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            disabled={isDownloading}
          >
            <option value="CSV">CSV</option>
            <option value="JSON">JSON</option>
            <option value="Excel">Excel</option>
            <option value="PDF">PDF</option>
          </select>
        </div>

        {/* Sort Order */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Sort Order</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            disabled={isDownloading}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        {/* Download Button */}
        <Button
          className="w-full"
          onClick={handleDownload}
          disabled={isDownloading || !sensorId}
        >
          {isDownloading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download Data
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

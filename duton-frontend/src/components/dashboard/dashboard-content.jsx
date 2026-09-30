"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
const SensorLocationGrid = dynamic(
  () => import('./sensor-location-grid').then((mod) => mod.SensorLocationGrid),
  { 
    ssr: false, // Disables server-side rendering for maps, speeding up load times
    loading: () => <div className="w-full p-10 text-center text-muted-foreground animate-pulse">Loading sensor grid...</div> 
  }
)
import { MonitoringTable } from "./monitoring-table"
import { SensorUpdateDialog } from "./sensor-update-dialog"
import { AddSensorDialog } from "./add-sensor-dialog"
import { SiteManagement } from "./site-management"
import { BuilderManagement } from "./builder-management"
import { SensorsMapView } from "./sensors-map-view"
import { SensorAnomaliesView } from "./sensor-anomalies-view"
import { AlertLog } from "./alert-log"
import { AmcFeatures } from "./amc-features"
import { fetchUserSensors, getUserSites, deleteSensor, updateSensor, fetchAllLatestReadings } from "@/utils/api"
import { applyCalibration } from "@/utils/calibration"
import { getClientUserContext } from "@/lib/user-context"
import ExcelJS from "exceljs"
import { toast } from "sonner"
import { Filter, X, Plus, ArrowUpDown, ArrowUp, ArrowDown, Building2, Users, MapPin, Download, ChevronDown, Bell, Loader2, ShieldCheck, LayoutGrid } from "lucide-react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"

const views = [
  { id: "grid", label: "Grid View" },
  { id: "table", label: "Table View" },
  { id: "map", label: "Map View" },
  // { id: "anomalies", label: "Sensor Anomalies" },
]
const PAGE_SIZE = 8
  const ALL_ASSIGNED_SITES_VALUE = "__all_assigned_sites__"

export function DashboardContent() {
  const [view, setView] = useState("table")
  const [sensorItems, setSensorItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState("")
  const [page, setPage] = useState(1)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [addSensorDialogOpen, setAddSensorDialogOpen] = useState(false)
  const [selectedSensor, setSelectedSensor] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAssignee, setIsAssignee] = useState(false)
  const [isBuilder, setIsBuilder] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [assignedSites, setAssignedSites] = useState([])
  const [selectedSite, setSelectedSite] = useState(ALL_ASSIGNED_SITES_VALUE)
  const [offlineTimestamps, setOfflineTimestamps] = useState({}) // Track when sensors went offline
  const [sortBy, setSortBy] = useState("") // "installation_date", "pm25", "pm10", "temperature", "humidity"
  const [sortOrder, setSortOrder] = useState("asc") // "asc" or "desc"

  // Filter states
  const [filters, setFilters] = useState({
    name: "",
    sensorId: "",
    pm25Min: "",
    pm25Max: "",
    pm10Min: "",
    pm10Max: "",
    status: "all", // "all", "online", "offline"
    installationDate: "",
  })

  const [mounted, setMounted] = useState(false)
  const [searchNameInput, setSearchNameInput] = useState("")
  const [searchIdInput, setSearchIdInput] = useState("")
  const [isDownloadingReport, setIsDownloadingReport] = useState(false)
  const nameTimeoutRef = useRef(null)
  const idTimeoutRef = useRef(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Resolve role from token/localStorage to avoid request fanout on mount.
  useEffect(() => {
    if (!mounted) return
    const userContext = getClientUserContext()
    setIsAdmin(userContext.isAdmin)
    setIsAssignee(userContext.isAssignee)
    setIsBuilder(userContext.isBuilder)
  }, [mounted])

  // Fetch assigned sites for builder/contractor users
  useEffect(() => {
    if (!mounted || !isBuilder) return

    const fetchSites = async () => {
      try {
        const username = typeof window !== "undefined" ? window.localStorage.getItem("duton_username") : null
        if (!username) return

        const sites = await getUserSites(username)
        setAssignedSites(sites || [])

        // For builder/contractor, default to showing all assigned sites first
        setSelectedSite(ALL_ASSIGNED_SITES_VALUE)
      } catch (error) {
        console.error("[Dashboard] Error fetching assigned sites:", error)
      }
    }

    fetchSites()
  }, [mounted, isBuilder])

  const mapApiSensorsToDashboard = (apiSensors = []) => {
    return apiSensors.map((apiSensor) => {
      const sensorId = apiSensor.sensor_id || apiSensor.device_id || apiSensor.identifier
      const lastReading = apiSensor.last_reading || apiSensor.current_reading

      // Extract PM values - handle ALL possible field name variants from API
      const rawPm25 = lastReading?.pm2_5 ?? lastReading?.pms_2_5 ?? lastReading?.pm_2_5 ?? null
      const rawPm10 = lastReading?.pm10_0 ?? lastReading?.pms_10 ?? lastReading?.pm_10 ?? null
      const rawTemp = lastReading?.temperature ?? lastReading?.ambient_temperature ?? null
      const rawHumidity = lastReading?.humidity ?? lastReading?.relative_humidity ?? null

      return {
        id: apiSensor.sensor_id || apiSensor.device_id || apiSensor.identifier || `sensor-${sensorId || "unknown"}`,
        name: apiSensor.name || apiSensor.sensor_name || apiSensor.sensor_id || apiSensor.device_id || "Unknown Sensor",
        sensor_name: apiSensor.name || apiSensor.sensor_name || "",
        identifier: apiSensor.sensor_id || apiSensor.device_id || apiSensor.identifier,
        site_name: apiSensor.site_name || null,
        client_name: apiSensor.client_name || "",
        device_id: apiSensor.device_id || null,
        sensor_id: apiSensor.sensor_id || null,
        location:
          apiSensor.location?.address ||
          apiSensor.location?.address_line ||
          "Unknown Location",
        latitude: apiSensor.location?.lat ?? apiSensor.latitude ?? null,
        longitude: apiSensor.location?.lng ?? apiSensor.longitude ?? null,
        pm25: (() => {
          const val = rawPm25 !== null ? applyCalibration(rawPm25, "pm25") : null
          return val !== null && !isNaN(val) ? Number(val) : null
        })(),
        pm10: (() => {
          const val = rawPm10 !== null ? applyCalibration(rawPm10, "pm10") : null
          return val !== null && !isNaN(val) ? Number(val) : null
        })(),
        temperature: (() => {
          const num = rawTemp !== null ? Number(rawTemp) : null
          return num !== null && !isNaN(num) ? num : null
        })(),
        humidity: (() => {
          const num = rawHumidity !== null ? Number(rawHumidity) : null
          return num !== null && !isNaN(num) ? num : null
        })(),
        status: apiSensor.is_active !== false ? "Active" : "Offline",
        lastUpdated: lastReading?.timestamp ||
          (lastReading && (lastReading.pms_2_5 !== null || lastReading.pms_10 !== null || lastReading.temperature !== null || lastReading.humidity !== null)
            ? new Date().toISOString()
            : null),
        installationDate: apiSensor.installation_date || apiSensor.installationDate || null,
        remark: apiSensor.remark || null,
        remarkDate: apiSensor.remark_date || apiSensor.remarkDate || null,
        spoc: apiSensor.spoc_name || null,
        spocContact: apiSensor.spoc_contact || null,
      }
    })
  }

  const calculateSensorStatus = (row) => {
    const hasCurrentData = (row.pm25 !== null && row.pm25 !== undefined && row.pm25 !== "XXX") ||
      (row.pm10 !== null && row.pm10 !== undefined && row.pm10 !== "XXX") ||
      (row.temperature !== null && row.temperature !== undefined && row.temperature !== "XXX") ||
      (row.humidity !== null && row.humidity !== undefined && row.humidity !== "XXX")

    const lastUpdate = row.lastUpdated || row.lastUpdate || row.timestamp || null

    if (!lastUpdate) {
      if (hasCurrentData) {
        return {
          isOnline: true,
          isDelayed: false,
          offlineSince: null,
        }
      }
      const now = new Date()
      const estimatedOfflineTime = new Date(now.getTime() - 30 * 60 * 1000)
      return {
        isOnline: false,
        isDelayed: false,
        offlineSince: estimatedOfflineTime,
      }
    }

    const lastUpdateTime = new Date(lastUpdate)
    if (isNaN(lastUpdateTime.getTime())) {
      if (hasCurrentData) {
        return {
          isOnline: true,
          isDelayed: false,
          offlineSince: null,
        }
      }
      const now = new Date()
      const estimatedOfflineTime = new Date(now.getTime() - 30 * 60 * 1000)
      return {
        isOnline: false,
        isDelayed: false,
        offlineSince: estimatedOfflineTime,
      }
    }

    const now = new Date()
    const minutesSinceLastUpdate = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60)

    // Online: has current data and within 30 minutes
    if (hasCurrentData && minutesSinceLastUpdate <= 30) {
      return {
        isOnline: true,
        isDelayed: false,
        offlineSince: null,
      }
    }

    // Delayed: has current data but more than 30 minutes since last update
    if (hasCurrentData && minutesSinceLastUpdate > 30) {
      const offlineSince = new Date(lastUpdateTime.getTime() + 30 * 60 * 1000)
      return {
        isOnline: false,
        isDelayed: true,
        offlineSince: offlineSince,
      }
    }

    // Offline: no current data or no data for extended period
    if (minutesSinceLastUpdate > 30) {
      const offlineSince = new Date(lastUpdateTime.getTime() + 30 * 60 * 1000)
      return {
        isOnline: false,
        isDelayed: false,
        offlineSince: offlineSince,
      }
    }

    return {
      isOnline: true,
      isDelayed: false,
      offlineSince: null,
    }
  }

  const fetchSensorsData = async () => {
    setIsLoading(true)
    setFetchError("")

    try {
      const { fetchAllLatestReadings } = await import("@/utils/api")
      const apiSensors = await fetchUserSensors()

      if (apiSensors && apiSensors.length > 0) {
        // Fetch real-time telemetry so sorting operates on the exact data displayed
        const ids = apiSensors.map(s => s.sensor_id || s.device_id || s.identifier).filter(Boolean)
        const latestReadings = await fetchAllLatestReadings(ids).catch(() => ({}))
        
        const mergedSensors = apiSensors.map(sensor => {
          const id = sensor.sensor_id || sensor.device_id || sensor.identifier
          const latest = id ? latestReadings[id] : null
          if (latest) {
             return {
                ...sensor,
                last_reading: {
                   ...(sensor.last_reading || {}),
                   pm2_5: latest.pm2_5 ?? sensor.last_reading?.pm2_5,
                   pm10_0: latest.pm10_0 ?? sensor.last_reading?.pm10_0,
                   temperature: latest.temperature ?? sensor.last_reading?.temperature,
                   humidity: latest.humidity ?? sensor.last_reading?.humidity,
                   timestamp: latest.timestamp ?? sensor.last_reading?.timestamp
                }
             }
          }
          return sensor
        })

        setSensorItems(mapApiSensorsToDashboard(mergedSensors))
      } else {
        setFetchError("No sensors assigned to your account.")
        setSensorItems([])
      }
    } catch (error) {
      console.error("[Dashboard] Error fetching sensors:", error)
      console.error("[Dashboard] Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
      setFetchError(error.message || "Failed to load sensor data.")
      setSensorItems([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!mounted) return
    fetchSensorsData()
  }, [mounted])

  // Apply filters to sensor data
  const filteredSensors = useMemo(() => {
    let filtered = [...sensorItems]

    // Filter by selected site for builder users
    if (isBuilder) {
      if (selectedSite && selectedSite !== ALL_ASSIGNED_SITES_VALUE) {
        // Filter by specific selected site
        filtered = filtered.filter((sensor) => sensor.site_name === selectedSite)
      } else {
        // "All Sites" selected - show only sensors from assigned sites
        const assignedSiteNames = assignedSites.map(site => site.site_name).filter(Boolean)
        if (assignedSiteNames.length > 0) {
          filtered = filtered.filter((sensor) => assignedSiteNames.includes(sensor.site_name))
        }
      }
    }

    // Filter by name
    if (filters.name) {
      filtered = filtered.filter((sensor) =>
        (sensor.site_name || "").toLowerCase().includes(filters.name.toLowerCase())
      )
    }

    // Filter by sensor ID
    if (filters.sensorId) {
      filtered = filtered.filter((sensor) =>
        sensor.identifier?.toLowerCase().includes(filters.sensorId.toLowerCase()) ||
        sensor.id?.toLowerCase().includes(filters.sensorId.toLowerCase())
      )
    }

    // Filter by PM2.5 range
    if (filters.pm25Min) {
      filtered = filtered.filter((sensor) => (sensor.pm25 ?? 0) >= Number(filters.pm25Min))
    }
    if (filters.pm25Max) {
      filtered = filtered.filter((sensor) => (sensor.pm25 ?? 0) <= Number(filters.pm25Max))
    }

    // Filter by PM10 range
    if (filters.pm10Min) {
      filtered = filtered.filter((sensor) => (sensor.pm10 ?? 0) >= Number(filters.pm10Min))
    }
    if (filters.pm10Max) {
      filtered = filtered.filter((sensor) => (sensor.pm10 ?? 0) <= Number(filters.pm10Max))
    }

    // Filter by status (Online/Offline/Delayed)
    if (filters.status !== "all") {
      filtered = filtered.filter((sensor) => {
        const statusInfo = calculateSensorStatus(sensor)
        if (filters.status === "online") {
          return statusInfo.isOnline && !statusInfo.isDelayed
        } else if (filters.status === "offline") {
          return !statusInfo.isOnline && !statusInfo.isDelayed
        } else if (filters.status === "delayed") {
          return statusInfo.isDelayed
        }
        return true
      })
    }

    // Filter by installation date
    if (filters.installationDate) {
      filtered = filtered.filter((sensor) => {
        if (!sensor.installationDate) return false
        const sensorDate = new Date(sensor.installationDate).toISOString().split("T")[0]
        return sensorDate === filters.installationDate
      })
    }

    // Apply sorting
    if (sortBy) {
      filtered.sort((a, b) => {
        let aValue = null
        let bValue = null

        switch (sortBy) {
          case "installation_date":
            const aDate = a.installationDate ? new Date(a.installationDate).getTime() : null
            const bDate = b.installationDate ? new Date(b.installationDate).getTime() : null
            aValue = isNaN(aDate) ? null : aDate
            bValue = isNaN(bDate) ? null : bDate
            break
          case "pm25":
            aValue = a.pm25
            bValue = b.pm25
            break
          case "pm10":
            aValue = a.pm10
            bValue = b.pm10
            break
          case "temperature":
            aValue = a.temperature
            bValue = b.temperature
            break
          case "humidity":
            aValue = a.humidity
            bValue = b.humidity
            break
          default:
            return 0
        }

        // Handle null/undefined values - put them at the end
        if ((aValue === null || aValue === undefined) && (bValue === null || bValue === undefined)) return 0
        if (aValue === null || aValue === undefined) return 1
        if (bValue === null || bValue === undefined) return -1

        // Compare values
        if (sortOrder === "asc") {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
        }
      })
    }

    return filtered
  }, [sensorItems, filters, sortBy, sortOrder, isBuilder, selectedSite, assignedSites])

  useEffect(() => {
    setPage(1)
  }, [filteredSensors.length])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredSensors.length / PAGE_SIZE)),
    [filteredSensors.length]
  )

  const paginatedSensors = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredSensors.slice(start, start + PAGE_SIZE)
  }, [filteredSensors, page])

  const sensorIdsSignature = useMemo(
    () =>
      sensorItems
        .map((sensor) => sensor?.identifier || sensor?.id)
        .filter(Boolean)
        .join("|"),
    [sensorItems]
  )

  useEffect(() => {
    let cancelled = false

    const refreshAllSensorReadings = async () => {
      if (!sensorIdsSignature) return
      const ids = [...new Set(sensorIdsSignature.split("|").filter(Boolean))]

      if (ids.length === 0) return

      try {
        const readings = await fetchAllLatestReadings(ids)
        if (!cancelled && readings && typeof readings === "object") {
          setSensorItems((prev) =>
            prev.map((sensor) => {
              const sensorId = sensor?.identifier || sensor?.id
              const latest = sensorId ? readings[sensorId] : null
              if (!latest) return sensor

              const rawPm25 = latest.pm2_5 ?? latest.pms_2_5 ?? null
              const rawPm10 = latest.pm10_0 ?? latest.pms_10 ?? null
              const rawTemp = latest.temperature ?? latest.ambient_temperature ?? null
              const rawHumidity = latest.humidity ?? latest.relative_humidity ?? null

              const pm25Value = rawPm25 !== null ? applyCalibration(rawPm25, "pm25") : sensor.pm25
              const pm10Value = rawPm10 !== null ? applyCalibration(rawPm10, "pm10") : sensor.pm10
              const tempValue = rawTemp !== null ? Number(rawTemp) : sensor.temperature
              const humidityValue = rawHumidity !== null ? Number(rawHumidity) : sensor.humidity

              return {
                ...sensor,
                pm25: pm25Value !== null && Number.isFinite(Number(pm25Value)) ? Number(pm25Value) : null,
                pm10: pm10Value !== null && Number.isFinite(Number(pm10Value)) ? Number(pm10Value) : null,
                temperature: Number.isFinite(tempValue) ? tempValue : null,
                humidity: Number.isFinite(humidityValue) ? humidityValue : null,
                lastUpdated:
                  latest.timestamp ??
                  latest.lastUpdate ??
                  sensor.lastUpdated ??
                  sensor.lastUpdate ??
                  sensor.timestamp ??
                  null,
              }
            })
          )
        }
      } catch (error) {
      }
    }

    // Initial readings are already merged in fetchSensorsData; only refresh on the interval
    const intervalId = setInterval(refreshAllSensorReadings, 30_000)

    return () => {
      cancelled = true
      clearInterval(intervalId)
      }
  }, [sensorIdsSignature])

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1) // Reset to first page when filters change
  }

  const clearFilters = () => {
    setSearchNameInput("")
    setSearchIdInput("")
    if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current)
    if (idTimeoutRef.current) clearTimeout(idTimeoutRef.current)
    setFilters({
      name: "",
      sensorId: "",
      pm25Min: "",
      pm25Max: "",
      pm10Min: "",
      pm10Max: "",
      status: "all",
      installationDate: "",
    })
    setSortBy("")
    setSortOrder("asc")
    setPage(1)
  }

  const handlePageChange = (direction) => {
    setPage((prev) => {
      if (direction === "prev") return Math.max(1, prev - 1)
      if (direction === "next") return Math.min(totalPages, prev + 1)
      return prev
    })
  }

  const handleUpdate = (sensor) => {
    setSelectedSensor(sensor)
    setUpdateDialogOpen(true)
  }

  const handleSave = async (updatedSensor) => {
    const originalSensorId = selectedSensor?.sensor_id || selectedSensor?.identifier || selectedSensor?.id

    if (!originalSensorId) {
      toast.error("Cannot update sensor: Sensor ID not found")
      return
    }

    try {
      const updateData = {
        name: updatedSensor.sensor_name || "",
        device_id: updatedSensor.device_id || "",
        client_name: updatedSensor.client_name || "",
        site_name: updatedSensor.site_name || "",
        location: {
          lat: parseFloat(updatedSensor.latitude) || parseFloat(selectedSensor?.latitude) || 19.059971,
          lng: parseFloat(updatedSensor.longitude) || parseFloat(selectedSensor?.longitude) || 72.829933,
          address: updatedSensor.location || "",
        },
        spoc_name: updatedSensor.spoc || "",
        spoc_contact: updatedSensor.spocContact || "",
        remark: updatedSensor.remark || "",
        remark_date: updatedSensor.remarkDate || "",
        installation_date: updatedSensor.installationDate || "",
      }

      await updateSensor(originalSensorId, updateData)
      await fetchSensorsData()

      toast.success("Sensor updated successfully")
      setUpdateDialogOpen(false)
      setSelectedSensor(null)
    } catch (error) {
      toast.error(error.message || "Failed to update sensor. Please try again.")
    }
  }

  const handleSaveRemark = async (updatedSensor) => {
    try {
      // Get sensor identifier - try multiple fields in order of preference
      // Priority: identifier (from API) > sensor_id > device_id > name (as fallback)
      const sensorIdentifier =
        updatedSensor.identifier ||
        updatedSensor.sensor_id ||
        updatedSensor.device_id ||
        updatedSensor.name ||
        updatedSensor.id

      if (!sensorIdentifier) {
        console.error("Sensor data:", updatedSensor)
        toast.error("Sensor identifier not found")
        return
      }


      // Import API function
      const { updateSensorRemark } = await import("@/utils/api")

      // Save to database
      await updateSensorRemark(
        sensorIdentifier,
        updatedSensor.remark || null,
        updatedSensor.remarkDate || null
      )

      // Update local state
      setSensorItems((prev) =>
        prev.map((sensor) =>
          sensor.id === updatedSensor.id ? updatedSensor : sensor
        )
      )

      toast.success("Remark updated successfully")
    } catch (error) {
      console.error("Error updating remark:", error)
      console.error("Sensor data that failed:", updatedSensor)
      toast.error(error.message || "Failed to update remark")
    }
  }

  const handleDelete = async (sensor) => {
    const sensorId = sensor.sensor_id || sensor.name || sensor.identifier || sensor.id || sensor.sensorId

    if (!sensorId) {
      toast.error("Cannot delete sensor: Sensor ID not found")
      return
    }

    try {
      await deleteSensor(sensorId)
      setSensorItems((prev) => prev.filter((s) => s.id !== sensor.id))
      toast.success("Sensor deleted successfully")
    } catch (error) {
      toast.error(error.message || "Failed to delete sensor. Please try again.")
    }
  }

  const showPagination =
    (view === "grid" || view === "table") && filteredSensors.length > PAGE_SIZE
  const rangeStart = filteredSensors.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredSensors.length)

  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== "" && value !== "all"
  )

  // Debug: Log current states
  useEffect(() => {
  }, [isAdmin, isAssignee, mounted])

  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      // Set new sort field and default to ascending
      setSortBy(newSortBy)
      setSortOrder("asc")
    }
  }

  const clearSort = () => {
    setSortBy("")
    setSortOrder("asc")
  }

  const handleDownloadSensorsReport = async (reportType) => {
    if (isDownloadingReport) return

    const token = typeof window !== "undefined" ? window.localStorage.getItem("duton_access_token") : null
    if (!token) {
      toast.error("Authentication token missing. Please log in again.")
      return
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_TICKET_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "http://localhost:8001/api"

    const reportConfig =
      reportType === "online"
        ? { endpoint: "/admin/sensors/online/download", filename: "online-sensors.xlsx", label: "online" }
        : reportType === "offline"
          ? { endpoint: "/admin/sensors/offline/download", filename: "offline-sensors.xlsx", label: "offline" }
          : { endpoint: "/admin/sensors/overall/download", filename: "overall-sensors.xlsx", label: "overall" }

    try {
      setIsDownloadingReport(true)
      const response = await fetch(`${baseUrl}${reportConfig.endpoint}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to download ${reportConfig.label} sensors report`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = reportConfig.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success(`${reportConfig.label.charAt(0).toUpperCase()}${reportConfig.label.slice(1)} sensors Excel downloaded`)
    } catch (error) {
      toast.error(error.message || "Failed to download sensors report")
    } finally {
      setIsDownloadingReport(false)
    }
  }

    const handleDownloadFilteredSensorsExcel = async () => {
    if (isDownloadingReport) return

    try {
      setIsDownloadingReport(true)

     const isSensorDelayed = (sensor) => {
        const hasCurrentData =
          (sensor.pm25 !== null && sensor.pm25 !== undefined && sensor.pm25 !== "XXX") ||
          (sensor.pm10 !== null && sensor.pm10 !== undefined && sensor.pm10 !== "XXX") ||
          (sensor.temperature !== null && sensor.temperature !== undefined && sensor.temperature !== "XXX") ||
          (sensor.humidity !== null && sensor.humidity !== undefined && sensor.humidity !== "XXX")

        const lastUpdate = sensor.lastUpdated || sensor.lastUpdate || sensor.timestamp || null
        if (!lastUpdate) return !hasCurrentData

        const lastUpdateTime = new Date(lastUpdate)
        if (isNaN(lastUpdateTime.getTime())) return !hasCurrentData

        const minutesSinceLastUpdate = (Date.now() - lastUpdateTime.getTime()) / (1000 * 60)
        if (hasCurrentData && minutesSinceLastUpdate <= 30) return false
        return minutesSinceLastUpdate > 30
      }
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet("Filtered Sensors")

      sheet.columns = [
        { header: "Project", key: "project", width: 35 },
        { header: "Sensor ID", key: "sensor_id", width: 22 },
        { header: "PM2.5", key: "pm25", width: 12 },
        { header: "PM10", key: "pm10", width: 12 },
        { header: "Temperature", key: "temperature", width: 14 },
        { header: "Humidity", key: "humidity", width: 12 },
        { header: "Status", key: "status", width: 12 },
        { header: "Last Updated", key: "lastUpdated", width: 24 },
        { header: "Installation Date", key: "installationDate", width: 18 },
      ]

      filteredSensors.forEach((sensor) => {
        const siteName = sensor.site_name || sensor.siteId || sensor.site_id || "Unknown Site"
        const deviceId = sensor.device_id || sensor.sensor_id || ""
        const projectDisplay = deviceId ? `${siteName} (${deviceId})` : siteName

        sheet.addRow({
          project: projectDisplay,
          sensor_id: sensor.identifier || sensor.sensor_id || sensor.id || "",
          pm25: sensor.pm25 ?? "",
          pm10: sensor.pm10 ?? "",
          temperature: sensor.temperature ?? "",
          humidity: sensor.humidity ?? "",
          status: isSensorDelayed(sensor) ? "Delay" : (sensor.status || ""),       
          lastUpdated: sensor.lastUpdated || sensor.lastUpdate || sensor.timestamp || "",
          installationDate: sensor.installationDate || "",
        })
      })

      const dateStr = new Date().toISOString().split("T")[0]
      const filename = `filtered_sensors_${dateStr}.xlsx`

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)

      toast.success("Filtered sensors Excel downloaded")
    } catch (error) {
      toast.error(error.message || "Failed to download filtered sensors")
    } finally {
      setIsDownloadingReport(false)
    }
  }

  const renderSensorContent = () => {
    return (
      <>
        <div className="flex flex-col gap-2 items-end w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-3 flex-wrap w-full justify-end">
            {/* Site filter dropdown for builder users - positioned near view toggle */}
            {isBuilder && assignedSites.length > 0 && (
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger id="site-select" className="w-[200px] max-w-[200px] min-w-0 overflow-hidden">
                  <span className="truncate flex-1 text-left min-w-0">
                    {selectedSite === ALL_ASSIGNED_SITES_VALUE ? "All Sites" : selectedSite || "Select a site"}
                  </span>
                </SelectTrigger>
                <SelectContent className="max-w-[200px] w-[200px] !z-[9999]" position="popper" sideOffset={5}>
                  <SelectItem value={ALL_ASSIGNED_SITES_VALUE}>All Sites</SelectItem>
                  {assignedSites.map((site) => {
                    const displayText = `${site.site_name}${site.site_address ? ` - ${site.site_address}` : ""}`
                    return (
                      <SelectItem
                        key={site.site_id || site.site_name}
                        value={site.site_name}
                        className="min-w-0 overflow-hidden"
                      >
                        <span className="truncate block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                          {displayText}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )}
            {/* Sort Icon */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={sortBy ? "default" : "outline"}
                  size="sm"
                  className="h-9 w-9 p-0"
                  title={sortBy ? `Sorting by ${sortBy} (${sortOrder})` : "Sort"}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 !z-[9999]">
                <DropdownMenuItem
                  onClick={() => setTimeout(() => handleSortChange("installation_date"), 0)}
                  className="flex items-center justify-between"
                >
                  <span>Installation Date</span>
                  {sortBy === "installation_date" && (
                    sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTimeout(() => handleSortChange("pm25"), 0)}
                  className="flex items-center justify-between"
                >
                  <span>PM2.5</span>
                  {sortBy === "pm25" && (
                    sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTimeout(() => handleSortChange("pm10"), 0)}
                  className="flex items-center justify-between"
                >
                  <span>PM10</span>
                  {sortBy === "pm10" && (
                    sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTimeout(() => handleSortChange("temperature"), 0)}
                  className="flex items-center justify-between"
                >
                  <span>Temperature</span>
                  {sortBy === "temperature" && (
                    sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTimeout(() => handleSortChange("humidity"), 0)}
                  className="flex items-center justify-between"
                >
                  <span>Humidity</span>
                  {sortBy === "humidity" && (
                    sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </DropdownMenuItem>
                {sortBy && (
                  <>
                    <DropdownMenuSeparator />
                    {view === "table" && (
                      <>
                        <DropdownMenuItem
                          onClick={() => setTimeout(() => setSortOrder("asc"), 0)}
                          className="flex items-center justify-between"
                        >
                          <span>Ascending</span>
                          {sortOrder === "asc" && <ArrowUp className="h-3 w-3" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setTimeout(() => setSortOrder("desc"), 0)}
                          className="flex items-center justify-between"
                        >
                          <span>Descending</span>
                          {sortOrder === "desc" && <ArrowDown className="h-3 w-3" />}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem
                      onClick={() => setTimeout(clearSort, 0)}
                      className="text-muted-foreground"
                    >
                      <X className="h-3 w-3 mr-2" />
                      Clear Sort
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {(isAdmin || isAssignee) && (
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="h-9 w-9 p-0 relative"
                title="Filters"
              >
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary-foreground text-primary text-[10px] flex items-center justify-center">
                    {Object.values(filters).filter((v) => v !== "" && v !== "all").length}
                  </span>
                )}
              </Button>
            )}
            {views.filter(option => isAdmin || (option.id !== 'map' && option.id !== 'anomalies')).map((option) => (
              <Button
                key={option.id}
                variant={view === option.id ? "default" : "outline"}
                size="sm"
                onClick={() => setView(option.id)}
              >
                {option.label}
              </Button>
            ))}
            {mounted && isAdmin && view === "table" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isDownloadingReport}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {isDownloadingReport ? "Downloading..." : "Download Excel"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 !z-[9999]">
                  <DropdownMenuItem
                    disabled={isDownloadingReport}
                    onClick={() => setTimeout(() => handleDownloadSensorsReport("overall"), 0)}
                  >
                    Download overall
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={isDownloadingReport}
                    onClick={() => setTimeout(() => handleDownloadSensorsReport("online"), 0)}
                  >
                    Download online
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={isDownloadingReport}
                    onClick={() => setTimeout(() => handleDownloadSensorsReport("offline"), 0)}
                  >
                    Download offline
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* Add Sensor Button - Always visible for admin */}
            {mounted && isAdmin && (
              <Button
                onClick={() => {
                  setAddSensorDialogOpen(true)
                }}
                size="sm"
                variant="default"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4" />
                Add Sensor
              </Button>
            )}
          </div>
          {isLoading && (
            <p className="text-xs text-muted-foreground">Fetching latest sensor data…</p>
          )}
          {fetchError && (
            <p className="text-xs text-red-500" role="alert">
              {fetchError}
            </p>
          )}
        </div>

        {/* Filters Panel - Admin and Assignee Only */}
        {(isAdmin || isAssignee) && showFilters && (
          <Card className="p-4 border-border/60 max-w-7xl mx-auto w-full relative z-40">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold">Filters</h3>
              <div className="flex items-center gap-2">
                {isAdmin && filteredSensors.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadFilteredSensorsExcel}
                    disabled={isDownloadingReport}
                    className="text-xs"
                  >
                    Download filtered
                  </Button>
                )}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-50 overflow-visible">
              {/* Search by Name */}
              <div className="space-y-2">
                <Label htmlFor="filter-name">Search by Name</Label>
                <Input
                  id="filter-name"
                  placeholder="Enter sensor name..."
                  value={searchNameInput}
                  onChange={(e) => {
                    const val = e.target.value
                    setSearchNameInput(val)
                    if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current)
                    nameTimeoutRef.current = setTimeout(() => handleFilterChange("name", val), 400)
                  }}
                />
              </div>

              {/* Search by Sensor ID */}
              <div className="space-y-2">
                <Label htmlFor="filter-sensor-id">Search by Sensor ID</Label>
                <Input
                  id="filter-sensor-id"
                  placeholder="Enter sensor ID..."
                  value={searchIdInput}
                  onChange={(e) => {
                    const val = e.target.value
                    setSearchIdInput(val)
                    if (idTimeoutRef.current) clearTimeout(idTimeoutRef.current)
                    idTimeoutRef.current = setTimeout(() => handleFilterChange("sensorId", val), 400)
                  }}
                />
              </div>

              {/* PM2.5 Range */}
              <div className="space-y-2">
                <Label>PM2.5 Range (µg/m³)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.pm25Min}
                    onChange={(e) => handleFilterChange("pm25Min", e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.pm25Max}
                    onChange={(e) => handleFilterChange("pm25Max", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* PM10 Range */}
              <div className="space-y-2">
                <Label>PM10 Range (µg/m³)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.pm10Min}
                    onChange={(e) => handleFilterChange("pm10Min", e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.pm10Max}
                    onChange={(e) => handleFilterChange("pm10Max", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
                  <SelectTrigger className="w-full">
                    <span>
                      {filters.status === "all" ? "All" : filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="!z-[9999]" position="popper" sideOffset={5}>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="delayed">Delayed</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Installation Date Filter */}
              <div className="space-y-2">
                <Label htmlFor="filter-date">Installation Date</Label>
                <Input
                  id="filter-date"
                  type="date"
                  value={filters.installationDate}
                  onChange={(e) => handleFilterChange("installationDate", e.target.value)}
                />
              </div>
            </div>
          </Card>
        )}

        <div className="w-full max-w-7xl mx-auto">
          {isLoading && sensorItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading your sensors…</p>
            </div>
          ) : !isLoading && sensorItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 border rounded-lg bg-muted/20">
              <p className="text-sm font-medium">No sensors to display</p>
              <p className="text-xs text-muted-foreground">
                {fetchError || "No sensors are assigned to your account yet."}
              </p>
            </div>
          ) : view === "grid" ? (
            <SensorLocationGrid
              sensors={paginatedSensors}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onRemarkUpdate={handleSaveRemark}
              offlineTimestamps={offlineTimestamps}
              isAdmin={isAdmin}
              isAssignee={isAssignee}
            />
          ) : view === "table" ? (
            <MonitoringTable
              onRemarkUpdate={handleSaveRemark}
              data={paginatedSensors}
              pageSize={PAGE_SIZE}
              showFooter={false}
              onStatusChange={(sensorId, newStatus) => {
                // If toggling to offline, store the current timestamp
                if (newStatus === "Offline") {
                  const offlineTimestamp = new Date().toISOString()
                  setOfflineTimestamps((prev) => ({
                    ...prev,
                    [sensorId]: offlineTimestamp
                  }))
                } else {
                  // If toggling back to online, clear the offline timestamp
                  setOfflineTimestamps((prev) => {
                    const updated = { ...prev }
                    delete updated[sensorId]
                    return updated
                  })
                }

                // Update sensor status in the list
                setSensorItems((prev) =>
                  prev.map((sensor) =>
                    sensor.id === sensorId
                      ? { ...sensor, status: newStatus === "Online" ? "Active" : "Inactive" }
                      : sensor
                  )
                )
                toast.success(`Sensor status updated to ${newStatus}`)
              }}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ) : view === "anomalies" ? (
            <SensorAnomaliesView />
          ) : (
            <SensorsMapView sensors={sensorItems} />
          )}
        </div>

        <SensorUpdateDialog
          sensor={selectedSensor}
          open={updateDialogOpen}
          onOpenChange={setUpdateDialogOpen}
          onSave={handleSave}
        />

        <AddSensorDialog
          open={addSensorDialogOpen}
          onOpenChange={setAddSensorDialogOpen}
          onSuccess={async () => {
            if (mounted) {
              // Force refresh by clearing any potential cache
              await fetchSensorsData()
              // Show a brief message
              toast.success("Sensor list refreshed")
            }
          }}
        />

        {showPagination && (
          <div className="w-full max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border rounded-lg px-4 py-3 bg-muted/20">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Showing {rangeStart}-{rangeEnd} of {filteredSensors.length}
                {hasActiveFilters && filteredSensors.length !== sensorItems.length && (
                  <span className="ml-2">(filtered from {sensorItems.length})</span>
                )}
              </p>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange("prev")}
                  disabled={page === 1}
                >
                  Previous
                </Button>
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
          </div>
        )}
      </>
    )
  }

  // Show tabs for admin users
  if (isAdmin) {
    return (
      <div className="space-y-6 w-full">
        <Tabs defaultValue="management" className="w-full">
          <TabsList className="grid w-full max-w-7xl mx-auto grid-cols-2">
            <TabsTrigger value="management">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Sensor Details
            </TabsTrigger>
            <TabsTrigger value="monitoring">
              <Bell className="h-4 w-4 mr-2" />
              Alerts &amp; AMC &amp; Anomalies
            </TabsTrigger>
          </TabsList>

          {/* Group 1: Sensors, Sites, Client */}
          <TabsContent value="management" className="space-y-6">
            <Tabs defaultValue="sensors" className="w-full">
              <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-3">
                <TabsTrigger value="sensors">Sensors</TabsTrigger>
                <TabsTrigger value="sites">
                  <Building2 className="h-4 w-4 mr-2" />
                  Sites
                </TabsTrigger>
                <TabsTrigger value="builders">
                  <Users className="h-4 w-4 mr-2" />
                  Client
                </TabsTrigger>
              </TabsList>
              <TabsContent value="sensors" className="space-y-6">
                {renderSensorContent()}
              </TabsContent>
              <TabsContent value="sites" className="space-y-6">
                <SiteManagement />
              </TabsContent>
              <TabsContent value="builders" className="space-y-6">
                <BuilderManagement />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Group 2: Alerts, AMC */}
          <TabsContent value="monitoring" className="space-y-6">
            <Tabs defaultValue="alerts" className="w-full">
              <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-3">
                <TabsTrigger value="alerts">
                  <Bell className="h-4 w-4 mr-2" />
                  Alerts
                </TabsTrigger>
                <TabsTrigger value="amc">
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  AMC
                </TabsTrigger>
                <TabsTrigger value="anomalies">
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Anomalies
                </TabsTrigger>
              </TabsList>
              <TabsContent value="alerts" className="space-y-6">
                <AlertLog />
              </TabsContent>
              <TabsContent value="amc" className="space-y-6">
                <AmcFeatures />
              </TabsContent>
              <TabsContent value="anomalies" className="space-y-6">
                <SensorAnomaliesView />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      {renderSensorContent()}
    </div>
  )
}


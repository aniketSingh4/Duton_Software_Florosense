"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { MonitoringHeader } from "./monitoring-header"
import { RealTimeDataCards } from "./real-time-data-cards"
import { PMTrendAnalysis } from "./pm-trend-analysis"
import { SiteInformation } from "./site-information"
import { StationLocation } from "./station-location"
import { DownloadHistoricalData } from "./download-historical-data"
import { DocumentsSection } from "./documents-section"
import { DiagnosticsSection } from "./diagnostics-section"
import { SPOCDetails } from "./spoc-details"
import { fetchUserSensors, fetchLatestReading, getSensorInfo } from "@/utils/api"
import { applyCalibration, reloadCalibrationFromDB } from "@/utils/calibration"
import { Button } from "@/components/ui/button"

const findFallbackSensor = () => null

const normalizeReading = (reading, sensorId = null) => {
  if (!reading) return null

  const rawPm25 = reading.pm2_5 ?? reading.pms_2_5 ?? null
  const rawPm10 = reading.pm10_0 ?? reading.pms_10 ?? null

  // Apply sensor-specific calibration if sensorId is provided
  // This will use the calibration values you set manually for the sensor
  const calibratedPm25 = rawPm25 !== null ? Math.round(applyCalibration(rawPm25, "pm25", sensorId)) : null
  const calibratedPm10 = rawPm10 !== null ? Math.round(applyCalibration(rawPm10, "pm10", sensorId)) : null

  return {
    pm2_5: rawPm25 !== null ? Math.round(rawPm25) : null,
    pm10_0: rawPm10 !== null ? Math.round(rawPm10) : null,
    pms_2_5: calibratedPm25,
    pms_10: calibratedPm10,
    temperature: reading.temperature ?? reading.ambient_temperature ?? null,
    humidity: reading.humidity ?? reading.relative_humidity ?? null,
    timestamp: reading.timestamp ?? null,
  }
}

const normalizeSpocAddress = (value) => {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  return trimmed
}

const getSpocAddress = (apiSensor, fallback) => {
  const candidates = [
    apiSensor?.spoc_address,
    apiSensor?.spoc_address_line,
    apiSensor?.spoc_location,
    apiSensor?.site_address,
    fallback?.spocAddress,
    fallback?.spoc_address,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeSpocAddress(candidate)
    if (normalized) return normalized
  }

  return ""
}

const ENTRIES_PER_PAGE = 8

// PM Thresholds
const PM25_THRESHOLDS = {
  EMERGENCY: 250,
  WARNING: 120,
  NORMAL: 90,
}

const PM10_THRESHOLDS = {
  EMERGENCY: 430,
  WARNING: 250,
  NORMAL: 100,
}

// Sound alert utility functions
const playEmergencySound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800
    oscillator.type = "sine"

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)

    // Play twice for emergency
    setTimeout(() => {
      const oscillator2 = audioContext.createOscillator()
      const gainNode2 = audioContext.createGain()
      oscillator2.connect(gainNode2)
      gainNode2.connect(audioContext.destination)
      oscillator2.frequency.value = 800
      oscillator2.type = "sine"
      gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
      oscillator2.start(audioContext.currentTime)
      oscillator2.stop(audioContext.currentTime + 0.5)
    }, 600)
  } catch (error) {
    console.error("Failed to play emergency sound:", error)
  }
}

const playWarningSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 600
    oscillator.type = "sine"

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
  } catch (error) {
    console.error("Failed to play warning sound:", error)
  }
}

// Check PM thresholds and return alert level
const checkPM25Threshold = (value) => {
  if (value === null || value === undefined) return null
  if (value >= PM25_THRESHOLDS.EMERGENCY) return "emergency"
  if (value >= PM25_THRESHOLDS.WARNING) return "warning"
  return "normal"
}

const checkPM10Threshold = (value) => {
  if (value === null || value === undefined) return null
  if (value >= PM10_THRESHOLDS.EMERGENCY) return "emergency"
  if (value >= PM10_THRESHOLDS.WARNING) return "warning"
  return "normal"
}

// Retry utility function
const retryWithBackoff = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      // If it's the last retry, throw the error
      if (i === maxRetries - 1) {
        throw error
      }
      // Wait before retrying with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)))
    }
  }
}

// Wait for token to be available
const waitForToken = async (maxWait = 2000) => {
  const startTime = Date.now()
  while (Date.now() - startTime < maxWait) {
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("duton_access_token")
      if (token) {
        return true
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return false
}

export function MonitoringDashboard({ monitorId }) {
  const [sensorData, setSensorData] = useState(null)
  const [currentReading, setCurrentReading] = useState(null)
  const [readingHistory, setReadingHistory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const lastAlertRef = useRef({ pm25: null, pm10: null, timestamp: null })

  useEffect(() => {
    // Guard: Don't fetch if monitorId is not ready or invalid
    if (!monitorId || (typeof monitorId === "string" && monitorId.trim() === "")) {
      setIsLoading(false)
      return
    }

    const fetchSensorDetails = async () => {
      setIsLoading(true)
      setError("")

      try {
        // Wait for token to be available before making API calls
        await waitForToken()

        // Use GET /api/sensors/info/:sensor_id (same API used by regular users)
        let apiSensor = null
        try {
          const sensorInfo = await retryWithBackoff(
            () => getSensorInfo(monitorId),
            3, // max 3 retries
            500 // initial delay 500ms
          )

          // Extract sensor_info from response
          if (sensorInfo?.sensor_info) {
            apiSensor = sensorInfo.sensor_info
          } else if (sensorInfo) {
            // If response is already the sensor object
            apiSensor = sensorInfo
          }
        } catch (sensorInfoError) {
          // If getSensorInfo fails, fallback to fetchUserSensors approach
          const apiSensors = await retryWithBackoff(
            () => fetchUserSensors(),
            3,
            500
          )

          const fallback = findFallbackSensor(monitorId)

          apiSensor =
            apiSensors.find(
              (sensor) =>
                sensor.sensor_id === monitorId ||
                sensor.device_id === monitorId ||
                sensor.identifier === monitorId ||
                (fallback &&
                  (sensor.sensor_id === fallback.identifier ||
                    sensor.sensor_id === fallback.name ||
                    sensor.device_id === fallback.identifier))
            ) || null

          if (!apiSensor && !fallback) {
            throw new Error("Sensor not found for this monitor.")
          }
        }

        const fallback = findFallbackSensor(monitorId)

        if (!apiSensor && !fallback) {
          throw new Error("Sensor not found for this monitor.")
        }

        const sensorIdentifier =
          apiSensor?.sensor_id || apiSensor?.device_id || apiSensor?.identifier ||
          fallback?.identifier || fallback?.name || monitorId

        const reading = await retryWithBackoff(() => fetchLatestReading(sensorIdentifier), 2, 300).catch(() => null)

        const initialNormalized = normalizeReading(
          reading || apiSensor?.last_reading || apiSensor?.current_reading || null,
          sensorIdentifier
        )

        // Check thresholds for initial reading
        if (initialNormalized) {
          const pm25Level = checkPM25Threshold(initialNormalized.pms_2_5)
          const pm10Level = checkPM10Threshold(initialNormalized.pms_10)

          // Play alerts for initial reading if needed
          if (pm25Level === "emergency" || pm10Level === "emergency") {
            playEmergencySound()
          } else if (pm25Level === "warning" || pm10Level === "warning") {
            playWarningSound()
          }

          const alertTimestamp = initialNormalized.timestamp || (typeof window !== "undefined" ? new Date().toISOString() : "")
          lastAlertRef.current = {
            pm25: pm25Level,
            pm10: pm10Level,
            timestamp: alertTimestamp,
          }
        }

        setCurrentReading(initialNormalized)
        setReadingHistory(
          initialNormalized ? [createHistoryEntry(initialNormalized, sensorIdentifier)] : []
        )

        setSensorData({
          id: sensorIdentifier,
          name: apiSensor?.site_name || apiSensor?.sensor_id || fallback?.name || sensorIdentifier,
          location:
            apiSensor?.location?.address ||
            apiSensor?.location?.address_line ||
            fallback?.location ||
            "Unknown location",
          identifier: sensorIdentifier,
          siteId:
            apiSensor?.device_id && apiSensor?.sensor_id
              ? `${apiSensor.device_id}_${String(apiSensor.sensor_id).slice(-3)}`
              : apiSensor?.site_id ?? apiSensor?.siteId ?? fallback?.site_id ?? fallback?.siteId ?? null,
          latitude: apiSensor?.location?.lat ?? fallback?.latitude ?? 0,
          longitude: apiSensor?.location?.lng ?? fallback?.longitude ?? 0,
          spoc: apiSensor?.spoc_name || fallback?.spoc || "Not available",
          spocContact: apiSensor?.spoc_contact || fallback?.spocContact || "Not available",
          spocAddress: getSpocAddress(apiSensor, fallback),
          unit: apiSensor?.device_id || fallback?.identifier || sensorIdentifier,
          clientName: apiSensor?.client_name || fallback?.client_name || "N/A",
          siteName: apiSensor?.site_name || fallback?.name || "N/A",
        })
      } catch (err) {
        console.error("Error fetching sensor details:", err)
        // Provide more helpful error messages
        if (err.message?.includes("Failed to fetch") || err.name === "TypeError") {
          setError("Network error: Unable to connect to server. Please check your connection and try again.")
        } else {
          setError(err.message || "Failed to load monitor details. Please try refreshing the page.")
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchSensorDetails()
  }, [monitorId])

  // Function to refresh PM values - using useRef to avoid dependency issues
  const refreshPMValuesRef = useRef(null)

  refreshPMValuesRef.current = async () => {
    if (!sensorData?.identifier) return

    try {
      const latest = await fetchLatestReading(sensorData.identifier)
      const normalized = normalizeReading(latest, sensorData.identifier)
      if (!normalized) return

      if (!normalized.timestamp && typeof window !== "undefined") {
        normalized.timestamp = new Date().toISOString()
      }

      // Check thresholds and play alerts
      const pm25Level = checkPM25Threshold(normalized.pms_2_5)
      const pm10Level = checkPM10Threshold(normalized.pms_10)

      // Only play alert if the alert level has changed
      const pm25Changed = pm25Level !== lastAlertRef.current.pm25
      const pm10Changed = pm10Level !== lastAlertRef.current.pm10

      if (pm25Changed || pm10Changed) {
        // Check for emergency first (highest priority)
        if (pm25Level === "emergency" || pm10Level === "emergency") {
          playEmergencySound()
        } else if (pm25Level === "warning" || pm10Level === "warning") {
          playWarningSound()
        }

        // Update last alert state
        lastAlertRef.current = {
          pm25: pm25Level,
          pm10: pm10Level,
          timestamp: normalized.timestamp,
        }
      } else {
        // Still update timestamp even if level hasn't changed
        lastAlertRef.current.timestamp = normalized.timestamp
      }

      // Always update with latest normalized data
      setCurrentReading(normalized)
      setReadingHistory((prev) => {
        const exists = prev.some((entry) => entry.timestamp === normalized.timestamp)
        if (exists) return prev
        return [createHistoryEntry(normalized, sensorData.identifier), ...prev]
      })
    } catch (pollError) {
      console.error("Failed to fetch latest reading:", pollError)
    }
  }

  useEffect(() => {
    if (!sensorData?.identifier) return
    let isMounted = true

    const pollLatest = async () => {
      if (refreshPMValuesRef.current) {
        await refreshPMValuesRef.current()
      }
    }

    const intervalId = window.setInterval(pollLatest, 30_000)
    pollLatest()

    return () => {
      isMounted = false
      clearInterval(intervalId)
    }
  }, [sensorData?.identifier])

  // Listen for calibration saved event to refresh PM values
  useEffect(() => {
    if (typeof window === "undefined") return

    const handleCalibrationSaved = async (event) => {
      // Refresh PM values when calibration is saved
      // Check if the saved calibration is for the current sensor
      const savedSensorId = event.detail?.sensorId

      // Refresh if it's for the current sensor or if no specific sensor was provided
      if (!savedSensorId || savedSensorId === sensorData?.identifier) {
        // Reload calibration from database to ensure we have the latest values
        if (sensorData?.identifier) {
          await reloadCalibrationFromDB(sensorData.identifier)
        }

        // Small delay to ensure localStorage is updated
        await new Promise(resolve => setTimeout(resolve, 100))

        // Force refresh PM values
        if (refreshPMValuesRef.current) {
          await refreshPMValuesRef.current()
        }
      }
    }

    window.addEventListener("calibrationSaved", handleCalibrationSaved)

    return () => {
      window.removeEventListener("calibrationSaved", handleCalibrationSaved)
    }
  }, [sensorData?.identifier])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading latest sensor data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-500 text-center text-sm max-w-md">{error}</div>
      </div>
    )
  }

  if (!sensorData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">No sensor data available.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <MonitoringHeader title={sensorData.name} spoc={sensorData.spoc} unit={sensorData.unit} />

      {/* Real-time Data Cards */}
      <RealTimeDataCards reading={currentReading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Trend Analysis */}
        <div className="lg:col-span-2">
          <PMTrendAnalysis sensorId={sensorData.identifier} />
        </div>

        {/* Right Column - Site Info & Location */}
        <div className="space-y-6">
          <SiteInformation siteId={sensorData.siteId} />
          <StationLocation
            latitude={sensorData.latitude}
            longitude={sensorData.longitude}
            location={sensorData.location}
            identifier={sensorData.identifier}
          />
        </div>
      </div>

      {/* Live Feed */}
      <ReadingTable readings={readingHistory} />

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DownloadHistoricalData sensorId={sensorData.identifier} projectName={sensorData.siteName} />
        <DocumentsSection sensorId={sensorData.identifier} />
        <div className="space-y-6">
          <DiagnosticsSection sensorId={sensorData.identifier} sensorName={sensorData.name} />
          <SPOCDetails
            spoc={sensorData.spoc}
            contact={sensorData.spocContact}
            spocAddress={sensorData.spocAddress}
            sensorAddress={sensorData.location}
          />
        </div>
      </div>
    </div>
  )
}

function createHistoryEntry(reading, sensorId = "") {
  const timestamp = reading.timestamp || (typeof window !== "undefined" ? new Date().toISOString() : "")
  const id = timestamp ? `${sensorId}-${timestamp}` : `${sensorId}-${sensorId ? 'entry' : 'unknown'}`

  return {
    id,
    timestamp,
    pm25: reading.pms_2_5 ?? reading.pm2_5 ?? null,
    pm10: reading.pms_10 ?? reading.pm10_0 ?? null,
    temperature: reading.temperature,
    humidity: reading.humidity,
  }
}

function ReadingTable({ readings }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(readings.length / ENTRIES_PER_PAGE))

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setPage(totalPages), 0)
    }
  }, [page, totalPages])

  const startIndex = (page - 1) * ENTRIES_PER_PAGE
  const currentPageRows = readings.slice(startIndex, startIndex + ENTRIES_PER_PAGE)

  const formatValue = (value, suffix = "") => {
    if (typeof value !== "number") return "--"
    return `${value.toFixed(2)}${suffix}`
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Live feed</p>
          <h3 className="text-lg font-semibold">Sensor data</h3>
        </div>
      </div>
      {currentPageRows.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">No readings captured yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">Timestamp</th>
                <th className="px-4 py-2 font-medium">PM2.5 (µg/m³)</th>
                <th className="px-4 py-2 font-medium">PM10 (µg/m³)</th>
                <th className="px-4 py-2 font-medium">Temp (°C)</th>
                <th className="px-4 py-2 font-medium">Humidity (%)</th>
              </tr>
            </thead>
            <tbody>
              {currentPageRows.map((reading) => {
                const formatTimestamp = (ts) => {
                  if (!ts) return "--"
                  try {
                    const date = new Date(ts)
                    const year = date.getFullYear()
                    const month = String(date.getMonth() + 1).padStart(2, '0')
                    const day = String(date.getDate()).padStart(2, '0')
                    const hours = String(date.getHours()).padStart(2, '0')
                    const minutes = String(date.getMinutes()).padStart(2, '0')
                    const seconds = String(date.getSeconds()).padStart(2, '0')
                    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
                  } catch {
                    return "--"
                  }
                }

                return (
                  <tr key={reading.id} className="border-t border-border/60">
                    <td className="px-4 py-2 whitespace-nowrap">
                      {formatTimestamp(reading.timestamp)}
                    </td>
                    <td className="px-4 py-2">{formatValue(reading.pm25)}</td>
                    <td className="px-4 py-2">{formatValue(reading.pm10)}</td>
                    <td className="px-4 py-2">{formatValue(reading.temperature)}</td>
                    <td className="px-4 py-2">{formatValue(reading.humidity)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
          <span>
            Showing {startIndex + 1}-{Math.min(startIndex + ENTRIES_PER_PAGE, readings.length)} of{" "}
            {readings.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-xs">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}


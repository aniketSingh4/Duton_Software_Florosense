"use client"

import { useId } from "react"
import { Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts"
const DEFAULT_REALTIME = {
  pm25: null,
  pm10: null,
  temperature: null,
  humidity: null,
  lastUpdate: null,
}

// Calculate percentage for circular gauge (0-999 µg/m³ scale for PM)
const PM_GAUGE_MAX = 999
const getPMPercentage = (value, max = PM_GAUGE_MAX) => {
  if (value === null || value === undefined) return 0
  const safe = Number.isFinite(value) ? value : 0
  const clamped = Math.max(0, Math.min(safe, max))
  return (clamped / max) * 100
}

const CARD_BODY_HEIGHT = "h-32"
const PM_CARD_BODY_HEIGHT = "h-36"
const TEMPERATURE_RANGE = { min: 15, max: 35 }
const HUMIDITY_RANGE = { min: 40, max: 60 }

const getRangeStatus = (value, range) => {
  if (value === null || value === undefined) {
    return { color: "text-muted-foreground", label: "N/A" }
  }
  if (value < range.min) {
    return { color: "text-amber-500", label: "Low" }
  }
  if (value > range.max) {
    return { color: "text-red-500", label: "High" }
  }
  return { color: "text-emerald-500", label: "OK" }
}

const formatTwoDecimals = (value, suffix = "") => {
  if (value === null || value === undefined) return "--"
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return "--"
  return `${numericValue.toFixed(2)}${suffix}`
}

const LastUpdatedIcon = ({ timestamp }) => {
  const formatTimestamp = (ts) => {
    if (!ts) return "No data yet"
    try {
      const date = new Date(ts)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${day}/${month}/${year} ${hours}:${minutes}`
    } catch {
      return "Invalid date"
    }
  }
  
  const label = formatTimestamp(timestamp)
  return (
    <div className="relative group inline-flex">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label={label}
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="pointer-events-none absolute right-0 top-full mt-1 z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="rounded-md border border-border bg-card px-3 py-1 text-xs text-foreground shadow-lg whitespace-nowrap">
          Last update: {label}
        </div>
      </div>
    </div>
  )
}

export function RealTimeDataCards({ reading }) {
  let pm25 = null
  let pm10 = null
  
  if (reading) {
    // Prefer calibrated values (pms_2_5, pms_10) - these use your manually set calibration
    // Fallback to raw values if calibrated values are not available
    if (reading.pms_2_5 !== null && reading.pms_2_5 !== undefined) {
      pm25 = typeof reading.pms_2_5 === 'number' && !isNaN(reading.pms_2_5) 
        ? Math.round(reading.pms_2_5) 
        : null
    } 
    else if (reading.pm2_5 !== null && reading.pm2_5 !== undefined) {
      pm25 = typeof reading.pm2_5 === 'number' && !isNaN(reading.pm2_5) 
        ? Math.round(reading.pm2_5) 
        : null
    }
    
    if (reading.pms_10 !== null && reading.pms_10 !== undefined) {
      pm10 = typeof reading.pms_10 === 'number' && !isNaN(reading.pms_10) 
        ? Math.round(reading.pms_10) 
        : null
    } 
    else if (reading.pm10_0 !== null && reading.pm10_0 !== undefined) {
      pm10 = typeof reading.pm10_0 === 'number' && !isNaN(reading.pm10_0) 
        ? Math.round(reading.pm10_0) 
        : null
    }
  }
  
  const data = {
    pm25: pm25 ?? DEFAULT_REALTIME.pm25,
    pm10: pm10 ?? DEFAULT_REALTIME.pm10,
    temperature: reading?.temperature ?? DEFAULT_REALTIME.temperature,
    humidity: reading?.humidity ?? DEFAULT_REALTIME.humidity,
    lastUpdate: reading?.timestamp || DEFAULT_REALTIME.lastUpdate,
  }

  const pm25GradientId = useId()
  const pm10GradientId = useId()
  const pm25Percentage = getPMPercentage(data.pm25)
  const pm10Percentage = getPMPercentage(data.pm10)
  const temperatureStatus = getRangeStatus(data.temperature, TEMPERATURE_RANGE)
  const humidityStatus = getRangeStatus(data.humidity, HUMIDITY_RANGE)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* PM 2.5 Card */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="px-4 flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">PM 2.5</CardTitle>
          <LastUpdatedIcon timestamp={data.lastUpdate} />
        </CardHeader>
        <CardContent className="px-4 pt-0 pb-4">
          <div className={`relative ${PM_CARD_BODY_HEIGHT} flex items-center justify-center`}>
            <ChartContainer className="h-full w-full" config={{ gauge: { color: "var(--color-primary)" } }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="110%"
                  outerRadius="100%"
                  data={[{ value: 100 }]}
                  startAngle={180}
                  endAngle={0}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} dataKey="value" tick={false} />
                  <defs>
                    <linearGradient id={pm25GradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="50%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#0ea5e9" />
                    </linearGradient>
                  </defs>
                  <RadialBar
                    dataKey="value"
                    cornerRadius={10}
                    fill={`url(#${pm25GradientId})`}
                    background={false}
                    clockWise
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-5xl font-medium">
                {data.pm25 !== null ? data.pm25 : "--"}
              </div>
              <div className="text-base text-muted-foreground">µg/m³</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PM 10.0 Card */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="px-4 flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">PM 10.0</CardTitle>
          <LastUpdatedIcon timestamp={data.lastUpdate} />
        </CardHeader>
        <CardContent className="px-4 pt-0 pb-4">
          <div className={`relative ${PM_CARD_BODY_HEIGHT} flex items-center justify-center`}>
            <ChartContainer className="h-full w-full" config={{ gauge: { color: "var(--color-primary)" } }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="110%"
                  outerRadius="100%"
                  data={[{ value: 100 }]}
                  startAngle={180}
                  endAngle={0}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} dataKey="value" tick={false} />
                  <defs>
                    <linearGradient id={pm10GradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#0ea5e9" />
                      <stop offset="50%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                  <RadialBar
                    dataKey="value"
                    cornerRadius={10}
                    fill={`url(#${pm10GradientId})`}
                    background={false}
                    clockWise
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-5xl font-medium">
                {data.pm10 !== null ? data.pm10 : "--"}
              </div>
              <div className="text-base text-muted-foreground">µg/m³</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Temperature & Humidity Card */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="px-4 flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">Temperature & Humidity</CardTitle>
          <LastUpdatedIcon timestamp={data.lastUpdate} />
        </CardHeader>
        <CardContent className="px-4 pt-0 pb-4">
          <div className={`${CARD_BODY_HEIGHT} flex flex-col items-center justify-center space-y-3 text-center`}>
            <div className="space-y-2">
              <div className="flex flex-col items-center">
                <div className="text-3xl font-bold text-foreground">
                  {formatTwoDecimals(data.temperature, "°C")}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Temperature
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-2xl font-semibold text-foreground">
                  {formatTwoDecimals(data.humidity, "%")}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Humidity
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              Temp: 15-35°C | Humidity: 40-60%
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


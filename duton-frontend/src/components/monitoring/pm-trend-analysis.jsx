"use client"

import { useMemo, useState, useEffect } from "react"
import { CalendarIcon, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { fetchFlorosenseHistorical } from "@/utils/api"

const chartConfig = {
  pm25: {
    label: "PM 2.5",
    color: "var(--color-chart-1)",
  },
  pm10: {
    label: "PM 10",
    color: "var(--color-chart-2)",
  },
  temperature: {
    label: "Temperature",
    color: "var(--color-chart-4)",
  },
  humidity: {
    label: "Humidity",
    color: "var(--color-chart-3)",
  },
}

const parsePointDate = (point) => {
  if (!point) return null
  const rawValue = point.timestamp || point.time || point.date || null
  if (!rawValue) return null
  const parsed = new Date(rawValue)
  return isNaN(parsed.getTime()) ? null : parsed
}

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

const formatMonthYear = (monthState) => {
  if (!monthState) return "Select month"
  const { month, year } = monthState
  if (typeof month !== "number" || typeof year !== "number") return "Select month"
  return `${monthNames[month]} ${year}`
}

const formatRangeLabel = (range, fallbackLabel = "Select dates") => {
  if (!range?.from && !range?.to) return fallbackLabel
  const formatter = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" })
  if (range.from && range.to) {
    return `${formatter.format(range.from)} - ${formatter.format(range.to)}`
  }
  return range.from ? formatter.format(range.from) : formatter.format(range.to)
}

export function PMTrendAnalysis({ sensorId, data = [] }) {
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("7d")
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date()
    return { month: today.getMonth(), year: today.getFullYear() }
  })
  const [customRange, setCustomRange] = useState({ from: null, to: null })
  const [monthPopoverOpen, setMonthPopoverOpen] = useState(false)
  const [rangePopoverOpen, setRangePopoverOpen] = useState(false)
  const [trendData, setTrendData] = useState([])
  const [loading, setLoading] = useState(false)

  const formatDate = (d) => d.toISOString().split("T")[0]

  const getDateRange = () => {
    const endDate = new Date()
    const startDate = new Date()

    if (dateFilter === "7d") {
      startDate.setDate(endDate.getDate() - 7)
    } else if (dateFilter === "month" && typeof selectedMonth?.month === "number") {
      startDate.setFullYear(selectedMonth.year, selectedMonth.month, 1)
      endDate.setFullYear(selectedMonth.year, selectedMonth.month + 1, 0)
    } else if (dateFilter === "range" && customRange?.from && customRange?.to) {
      return { start: formatDate(customRange.from), end: formatDate(customRange.to) }
    }

    return { start: formatDate(startDate), end: formatDate(endDate) }
  }

  useEffect(() => {
    if (!sensorId) {
      setTrendData(data || [])
      return
    }

    const loadData = async () => {
      setLoading(true)
      try {
        const { start, end } = getDateRange()
        const result = await fetchFlorosenseHistorical(sensorId, start, end, 1000)
        setTrendData(result || [])
      } catch (e) {
        console.error("Failed to fetch trend data:", e)
        setTrendData([])
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [sensorId, dateFilter, selectedMonth, customRange])

  const filteredKeys = useMemo(() => {
    switch (selectedFilter) {
      case "pm25":
        return ["pm25"]
      case "pm10":
        return ["pm10"]
      default:
        return ["pm25", "pm10", "temperature", "humidity"]
    }
  }, [selectedFilter])

  const chartData = trendData
  const filterSummary = useMemo(() => {
    if (dateFilter === "7d") return "Last 7 Days"
    if (dateFilter === "month") return `Month: ${formatMonthYear(selectedMonth)}`
    if (dateFilter === "range") return `Dates: ${formatRangeLabel(customRange, "Select dates")}`
    return "All data"
  }, [dateFilter, selectedMonth, customRange])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-lg font-semibold">PM Trend Analysis</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("all")}
                className="text-xs h-7"
              >
                All
              </Button>
              <Button
                variant={selectedFilter === "pm25" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("pm25")}
                className="text-xs h-7"
              >
                PM 2.5
              </Button>
              <Button
                variant={selectedFilter === "pm10" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter("pm10")}
                className="text-xs h-7"
              >
                PM 10.0
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Date Filters</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={dateFilter === "7d" ? "default" : "outline"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setDateFilter("7d")}
              >
                Last 7 Days
              </Button>

              {/* Commented out as per request to restrict to 7 days only
              <Popover open={monthPopoverOpen} onOpenChange={setMonthPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={dateFilter === "month" ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-8 gap-2"
                  >
                    <CalendarIcon className="size-3.5" />
                    {formatMonthYear(selectedMonth)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <MonthPicker
                    value={selectedMonth}
                    onChange={(next) => {
                      setSelectedMonth(next)
                      setDateFilter("month")
                      setMonthPopoverOpen(false)
                    }}
                  />
                </PopoverContent>
              </Popover>

              <Popover open={rangePopoverOpen} onOpenChange={setRangePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={dateFilter === "range" ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-8 gap-2"
                  >
                    <CalendarIcon className="size-3.5" />
                    {formatRangeLabel(customRange)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customRange?.from || new Date()}
                    selected={customRange}
                    onSelect={(range) => {
                      setCustomRange(range || { from: null, to: null })
                      if (range?.from && range?.to) {
                        setDateFilter("range")
                        setRangePopoverOpen(false)
                      }
                    }}
                    numberOfMonths={2}
                    captionLayout="dropdown-buttons"
                    fromYear={2019}
                    toYear={new Date().getFullYear() + 1}
                  />
                </PopoverContent>
              </Popover>
              */}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-2">Showing {filterSummary}</p>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading trend data...
          </div>
        ) : !chartData.length ? (
          <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
            No trend data available for the selected filters.
          </div>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="time"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 12 }}
                    label={{ value: "µg/m³", angle: -90, position: "insideLeft" }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {filteredKeys.map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={`var(--color-${key})`}
                      strokeWidth={2}
                      dot={false}
                      name={chartConfig[key]?.label || key}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function MonthPicker({ value, onChange }) {
  const today = new Date()
  const currentYear = today.getFullYear()
  const [year, setYear] = useState(value?.year ?? currentYear)

  const years = useMemo(() => {
    const maxYear = currentYear + 1
    const minYear = 2019
    const total = maxYear - minYear + 1
    return Array.from({ length: total }, (_, index) => maxYear - index)
  }, [currentYear])

  const handleMonthSelect = (monthIndex, targetYear) => {
    if (typeof onChange === "function") {
      onChange({ month: monthIndex, year: targetYear })
    }
  }

  return (
    <div className="w-72 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="month-picker-year" className="text-xs font-medium text-muted-foreground">
          Year
        </label>
        <select
          id="month-picker-year"
          className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
        >
          {years.map((optionYear) => (
            <option key={optionYear} value={optionYear}>
              {optionYear}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {monthNames.map((label, index) => {
          const isActive = value?.month === index && value?.year === year
          return (
            <button
              key={label}
              type="button"
              className={`rounded-md border px-3 py-2 text-sm transition ${isActive ? "bg-primary text-primary-foreground" : "bg-muted/40 hover:bg-muted"
                }`}
              onClick={() => handleMonthSelect(index, year)}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import { MapContainer, TileLayer, Marker } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Clock } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

const LEGEND_BANDS = [
    { label: "0", color: "#8BC34A" },
    { label: "50", color: "#C6D63A" },
    { label: "100", color: "#F5C518" },
    { label: "200", color: "#F57C00" },
    { label: "300", color: "#E53935" },
    { label: "400", color: "#B71C1C" },
    { label: "500+", color: "#8E24AA" },
]

function numericReading(value) {
    if (value === null || value === undefined || value === "XXX" || value === "") return null
    const num = Number(value)
    return Number.isFinite(num) ? num : null
}

function markerValue(sensor) {
    const pm25 = numericReading(sensor.pm25)
    const pm10 = numericReading(sensor.pm10)
    if (pm25 === null && pm10 === null) return null
    if (pm25 === null) return pm10
    if (pm10 === null) return pm25
    return Math.max(pm25, pm10)
}

function markerStyle(value) {
    if (value === null) return { bg: "#9CA3AF", fg: "#111827" }
    if (value <= 50) return { bg: "#8BC34A", fg: "#1B2A12" }
    if (value <= 100) return { bg: "#C6D63A", fg: "#1B2A12" }
    if (value <= 200) return { bg: "#F5C518", fg: "#1B2A12" }
    if (value <= 300) return { bg: "#F57C00", fg: "#FFFFFF" }
    if (value <= 400) return { bg: "#E53935", fg: "#FFFFFF" }
    if (value <= 500) return { bg: "#B71C1C", fg: "#FFFFFF" }
    return { bg: "#8E24AA", fg: "#FFFFFF" }
}

function formatReading(value, digits = 0) {
    const num = numericReading(value)
    if (num === null) return "--"
    return digits === 0 ? String(Math.round(num)) : num.toFixed(digits)
}

function sensorNumber(sensor) {
    return sensor?.device_id || sensor?.sensor_id || sensor?.identifier || "--"
}

function hexToRgba(hex, alpha) {
    const h = hex.replace("#", "")
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function createMarkerIcon(sensor) {
    const value = markerValue(sensor)
    const label = value === null ? "--" : String(Math.round(value))
    const { bg, fg } = markerStyle(value)
    const fontSize = label.length >= 3 ? 11 : 13
    const halo = `0 0 0 6px ${hexToRgba(bg, 0.45)}, 0 0 0 11px ${hexToRgba(bg, 0.22)}`

    return L.divIcon({
        className: "aqi-marker",
        iconSize: [56, 56],
        iconAnchor: [28, 28],
        html: `<div class="aqi-marker-bubble" style="background:${bg};color:${fg};font-size:${fontSize}px;box-shadow:${halo}">${label}</div>`,
    })
}

export default function MapComponent({ sensors }) {
    const [selectedSensor, setSelectedSensor] = useState(null)
    const [open, setOpen] = useState(false)

    // Default center (Mumbai coordinates as fallback)
    const defaultCenter = [18.6187, 73.8037]

    // Filter valid sensors with coordinates
    const validSensors = useMemo(() => {
        return sensors.filter(s =>
            s.latitude &&
            s.longitude &&
            !isNaN(parseFloat(s.latitude)) &&
            !isNaN(parseFloat(s.longitude))
        )
    }, [sensors])

    const markerIcons = useMemo(() => {
        const icons = new Map()
        validSensors.forEach((sensor) => {
            icons.set(sensor.id, createMarkerIcon(sensor))
        })
        return icons
    }, [validSensors])

    // Calculate center based on sensors if available
    const center = useMemo(() => {
        if (validSensors.length === 0) return defaultCenter

        const latSum = validSensors.reduce((sum, s) => sum + parseFloat(s.latitude), 0)
        const lngSum = validSensors.reduce((sum, s) => sum + parseFloat(s.longitude), 0)

        return [latSum / validSensors.length, lngSum / validSensors.length]
    }, [validSensors])

    return (
        <>
            <Card className="relative p-0 overflow-hidden h-[600px] w-full border border-border/60">
                <MapContainer
                    center={center}
                    zoom={11}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {validSensors.map((sensor) => (
                        <Marker
                            key={sensor.id}
                            position={[parseFloat(sensor.latitude), parseFloat(sensor.longitude)]}
                            icon={markerIcons.get(sensor.id)}
                            eventHandlers={{
                                click: () => {
                                    setSelectedSensor(sensor)
                                    setOpen(true)
                                },
                            }}
                        />
                    ))}
                </MapContainer>

                <div className="pointer-events-none absolute bottom-3 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-1 rounded-full border border-border/70 bg-background/95 px-3 py-1.5 shadow-md">
                    {LEGEND_BANDS.map((band) => (
                        <div key={band.label} className="flex items-center gap-1">
                            <span
                                className="inline-block h-3 w-3 rounded-full border border-white/80 shadow-sm"
                                style={{ backgroundColor: band.color }}
                            />
                            <span className="text-[11px] font-medium text-foreground">{band.label}</span>
                        </div>
                    ))}
                </div>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-start justify-between gap-3 pr-8">
                            <span className="min-w-0 text-left">
                                {selectedSensor?.site_name || selectedSensor?.name || "Unknown site"}
                            </span>
                            {selectedSensor && (
                                <Badge variant={selectedSensor.status === "Active" ? "default" : "destructive"} className="ml-2 shrink-0">
                                    {selectedSensor.status === "Active" ? "Online" : "Offline"}
                                </Badge>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            Sensor no: {selectedSensor ? sensorNumber(selectedSensor) : "--"}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSensor && (
                        <div className="py-4">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-muted/50 p-4 rounded-lg text-center flex flex-col items-center justify-center border">
                                    <div className="text-xs text-muted-foreground uppercase font-medium mb-1">PM2.5</div>
                                    <div className="font-bold text-3xl my-1">
                                        {formatReading(selectedSensor.pm25)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">µg/m³</div>
                                </div>
                                <div className="bg-muted/50 p-4 rounded-lg text-center flex flex-col items-center justify-center border">
                                    <div className="text-xs text-muted-foreground uppercase font-medium mb-1">PM10</div>
                                    <div className="font-bold text-3xl my-1">
                                        {formatReading(selectedSensor.pm10)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">µg/m³</div>
                                </div>
                                <div className="bg-muted/50 p-4 rounded-lg text-center flex flex-col items-center justify-center border">
                                    <div className="text-xs text-muted-foreground uppercase font-medium mb-1">Temperature</div>
                                    <div className="font-bold text-3xl my-1">
                                        {formatReading(selectedSensor.temperature, 1)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">°C</div>
                                </div>
                                <div className="bg-muted/50 p-4 rounded-lg text-center flex flex-col items-center justify-center border">
                                    <div className="text-xs text-muted-foreground uppercase font-medium mb-1">Humidity</div>
                                    <div className="font-bold text-3xl my-1">
                                        {formatReading(selectedSensor.humidity, 1)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">%</div>
                                </div>
                            </div>

                            <div className="flex items-center justify-center text-sm text-muted-foreground gap-2 bg-muted/30 p-2 rounded">
                                <Clock className="h-4 w-4" />
                                <span>
                                    Last Updated: <span className="font-medium text-foreground">{selectedSensor.lastUpdated ? new Date(selectedSensor.lastUpdated).toLocaleString() : "Never"}</span>
                                </span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}

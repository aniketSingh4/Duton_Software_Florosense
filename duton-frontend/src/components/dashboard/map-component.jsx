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
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export default function MapComponent({ sensors }) {
    const [selectedSensor, setSelectedSensor] = useState(null)
    const [open, setOpen] = useState(false)

    // Default center (Mumbai coordinates as fallback)
    const defaultCenter = [19.076, 72.8777]

    // Filter valid sensors with coordinates
    const validSensors = useMemo(() => {
        return sensors.filter(s =>
            s.latitude &&
            s.longitude &&
            !isNaN(parseFloat(s.latitude)) &&
            !isNaN(parseFloat(s.longitude))
        )
    }, [sensors])

    // Calculate center based on sensors if available
    const center = useMemo(() => {
        if (validSensors.length === 0) return defaultCenter

        const latSum = validSensors.reduce((sum, s) => sum + parseFloat(s.latitude), 0)
        const lngSum = validSensors.reduce((sum, s) => sum + parseFloat(s.longitude), 0)

        return [latSum / validSensors.length, lngSum / validSensors.length]
    }, [validSensors])

    return (
        <>
            <Card className="p-0 overflow-hidden h-[600px] w-full border border-border/60">
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
                            icon={new L.Icon({
                                iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
                                iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
                                shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
                                iconSize: [18, 28],
                                iconAnchor: [9, 28],
                                popupAnchor: [1, -26],
                                shadowSize: [28, 28]
                            })}
                            eventHandlers={{
                                click: () => {
                                    setSelectedSensor(sensor)
                                    setOpen(true)
                                },
                            }}
                        />
                    ))}
                </MapContainer>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between pr-8">
                            <span>{selectedSensor?.name}</span>
                            {selectedSensor && (
                                <Badge variant={selectedSensor.status === "Active" ? "default" : "destructive"} className="ml-2">
                                    {selectedSensor.status === "Active" ? "Online" : "Offline"}
                                </Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedSensor && (
                        <div className="py-4">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-muted/50 p-4 rounded-lg text-center flex flex-col items-center justify-center border">
                                    <div className="text-xs text-muted-foreground uppercase font-medium mb-1">PM2.5</div>
                                    <div className="font-bold text-3xl my-1">
                                        {selectedSensor.pm25 !== null ? Math.round(selectedSensor.pm25) : "--"}
                                    </div>
                                    <div className="text-xs text-muted-foreground">µg/m³</div>
                                </div>
                                <div className="bg-muted/50 p-4 rounded-lg text-center flex flex-col items-center justify-center border">
                                    <div className="text-xs text-muted-foreground uppercase font-medium mb-1">PM10</div>
                                    <div className="font-bold text-3xl my-1">
                                        {selectedSensor.pm10 !== null ? Math.round(selectedSensor.pm10) : "--"}
                                    </div>
                                    <div className="text-xs text-muted-foreground">µg/m³</div>
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

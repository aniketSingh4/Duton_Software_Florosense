"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, Navigation } from "lucide-react"
import dynamic from "next/dynamic"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const SensorMap = dynamic(
  () => import("../dashboard/sensor-map").then((mod) => mod.SensorMap),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[200px] rounded-lg bg-muted animate-pulse flex items-center justify-center border">
        <MapPin className="h-8 w-8 text-muted-foreground" />
      </div>
    ),
  }
)

export function StationLocation({ latitude, longitude, location, identifier }) {
  const [mapDialogOpen, setMapDialogOpen] = useState(false)

  const handleLocate = () => {
    setMapDialogOpen(true)
  }

  return (
    <Card>
      <CardHeader className="">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Station Location</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLocate}
            className="h-7 text-xs"
          >
            <Navigation className="h-3 w-3 mr-1" />
            Locate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg overflow-hidden border border-border/50">
          <SensorMap
            latitude={latitude}
            longitude={longitude}
            sensorName={identifier}
            height="200px"
          />
        </div>
      </CardContent>

      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent className="max-w-7xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>Station Location - {identifier || location}</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg overflow-hidden border border-border/50 mt-4">
            <SensorMap
              latitude={latitude}
              longitude={longitude}
              sensorName={identifier}
              height="450px"
              zoom={15}
              scrollWheelZoom={true}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}


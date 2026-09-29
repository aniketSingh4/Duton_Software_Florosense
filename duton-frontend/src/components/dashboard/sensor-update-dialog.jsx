"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

function toDateInput(value) {
  if (!value) return ""
  return String(value).slice(0, 10)
}

export function SensorUpdateDialog({ sensor, open, onOpenChange, onSave }) {
  const [formData, setFormData] = useState({
    sensorId: "",
    siteId: "",
    name: "",
    clientName: "",
    siteName: "",
    location: "",
    latitude: "",
    longitude: "",
    spocName: "",
    spocContact: "",
    installationDate: "",
    remark: "",
    remarkDate: "",
  })

  useEffect(() => {
    if (sensor) {
      const storedName = sensor.sensor_name || ""
      const fallbackName =
        storedName ||
        (sensor.name && sensor.name !== sensor.sensor_id && sensor.name !== sensor.identifier
          ? sensor.name
          : "")

      setFormData({
        sensorId: sensor.sensor_id || "",
        siteId: sensor.device_id || sensor.site_id || "",
        name: fallbackName,
        clientName: sensor.client_name || "",
        siteName: sensor.site_name || "",
        location: sensor.location && sensor.location !== "Unknown Location" ? sensor.location : "",
        latitude: sensor.latitude?.toString() || "",
        longitude: sensor.longitude?.toString() || "",
        spocName: sensor.spoc || "",
        spocContact: sensor.spocContact || "",
        installationDate: toDateInput(sensor.installationDate),
        remark: sensor.remark || "",
        remarkDate: toDateInput(sensor.remarkDate),
      })
    }
  }, [sensor])

  const handleSubmit = (e) => {
    e.preventDefault()
    const updatedSensor = {
      ...sensor,
      sensor_name: formData.name,
      device_id: sensor.device_id || "",
      client_name: formData.clientName,
      site_name: formData.siteName,
      location: formData.location,
      latitude: parseFloat(formData.latitude) || sensor.latitude,
      longitude: parseFloat(formData.longitude) || sensor.longitude,
      spoc: formData.spocName,
      spocContact: formData.spocContact,
      installationDate: formData.installationDate || null,
      remark: formData.remark,
      remarkDate: formData.remarkDate || null,
    }
    onSave(updatedSensor)
    onOpenChange(false)
  }

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Sensor</DialogTitle>
          <DialogDescription>
            Update the sensor details. Sensor ID and site ID stay unchanged.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="sensorId">Sensor ID</Label>
                <Input
                  id="sensorId"
                  value={formData.sensorId}
                  disabled
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="siteId">Site ID</Label>
                <Input
                  id="siteId"
                  value={formData.siteId}
                  disabled
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>
            </div>

            {/* <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Sensor Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Enter sensor name"
                />
              </div>
            </div> */}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="clientName">Client Company</Label>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) => handleChange("clientName", e.target.value)}
                  placeholder="Enter client company name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="siteName">Site Name</Label>
                <Input
                  id="siteName"
                  value={formData.siteName}
                  onChange={(e) => handleChange("siteName", e.target.value)}
                  placeholder="Enter site name"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="location">Address</Label>
              <Textarea
                id="location"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                placeholder="Enter location address"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => handleChange("latitude", e.target.value)}
                  placeholder="28.6139"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => handleChange("longitude", e.target.value)}
                  placeholder="77.2090"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="spocName">SPOC Name</Label>
                <Input
                  id="spocName"
                  value={formData.spocName}
                  onChange={(e) => handleChange("spocName", e.target.value)}
                  placeholder="Enter SPOC name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="spocContact">SPOC Contact</Label>
                <Input
                  id="spocContact"
                  value={formData.spocContact}
                  onChange={(e) => handleChange("spocContact", e.target.value)}
                  placeholder="Enter SPOC contact"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="installationDate">Installation Date</Label>
              <Input
                id="installationDate"
                type="date"
                value={formData.installationDate}
                onChange={(e) => handleChange("installationDate", e.target.value)}
              />
            </div>

            {/* <div className="grid gap-2">
              <Label htmlFor="remark">Remark</Label>
              <Textarea
                id="remark"
                value={formData.remark}
                onChange={(e) => handleChange("remark", e.target.value)}
                placeholder="Enter any remarks or notes"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="remarkDate">Remark Date</Label>
              <Input
                id="remarkDate"
                type="date"
                value={formData.remarkDate}
                onChange={(e) => handleChange("remarkDate", e.target.value)}
              />
            </div> */}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

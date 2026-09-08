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

export function SensorUpdateDialog({ sensor, open, onOpenChange, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    identifier: "",
    latitude: "",
    longitude: "",
    spocName: "",
    spocContact: "",
    installationDate: "",
  })

  useEffect(() => {
    if (sensor) {
      setFormData({
        name: sensor.name || "",
        location: sensor.location || "",
        identifier: sensor.identifier || "",
        latitude: sensor.latitude?.toString() || "",
        longitude: sensor.longitude?.toString() || "",
        spocName: sensor.spoc || "",
        spocContact: sensor.spocContact || "",
        // Normalise ISO datetime -> yyyy-mm-dd for the date input
        installationDate: sensor.installationDate ? String(sensor.installationDate).slice(0, 10) : "",
      })
    }
  }, [sensor])

  const handleSubmit = (e) => {
    e.preventDefault()
    const updatedSensor = {
      ...sensor,
      name: formData.name,
      location: formData.location,
      identifier: formData.identifier,
      latitude: parseFloat(formData.latitude) || sensor.latitude,
      longitude: parseFloat(formData.longitude) || sensor.longitude,
      spoc: formData.spocName,
      spocContact: formData.spocContact,
      installationDate: formData.installationDate || null,
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Sensor</DialogTitle>
          <DialogDescription>
            Update the sensor information. Note: Sensor Name cannot be changed. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Sensor Name (Cannot be changed)</Label>
              <Input
                id="name"
                value={formData.name}
                disabled
                className="bg-muted cursor-not-allowed"
                placeholder="Sensor name"
                readOnly
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                placeholder="Enter location address"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="identifier">Identifier</Label>
              <Input
                id="identifier"
                value={formData.identifier}
                onChange={(e) => handleChange("identifier", e.target.value)}
                placeholder="Enter sensor identifier"
                required
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
                  required
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
                  required
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


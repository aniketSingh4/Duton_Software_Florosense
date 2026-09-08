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
import { toast } from "sonner"

export function AddSensorDialog({ open, onOpenChange, onSuccess }) {
  const [formData, setFormData] = useState({
    sensor_id: "",
    device_id: "",
    name: "",
    client_name: "",
    site_name: "",
    location: "",
    latitude: "",
    longitude: "",
    spoc_name: "",
    spoc_contact: "",
    installation_date: "",
    remark: "",
    remark_date: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setFormData({
        sensor_id: "",
        device_id: "",
        name: "",
        client_name: "",
        site_name: "",
        location: "",
        latitude: "",
        longitude: "",
        spoc_name: "",
        spoc_contact: "",
        installation_date: "",
        remark: "",
        remark_date: "",
      })
    }
  }, [open])

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Get ticket-backend API URL
      const getTicketApiBaseUrl = () => {
        if (process.env.NEXT_PUBLIC_TICKET_API_URL && process.env.NEXT_PUBLIC_TICKET_API_URL.trim().length > 0) {
          return process.env.NEXT_PUBLIC_TICKET_API_URL
        }
        if (typeof window !== "undefined") {
          const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
          if (isLocalhost) {
            return `http://${window.location.hostname}:8001/api`
          }
        }
        return "http://localhost:8001/api"
      }

      const token = window.localStorage.getItem("duton_access_token")

      if (!token) {
        throw new Error("Authentication required. Please log in again.")
      }

      // Prepare sensor data according to Postman collection format
      // POST {{base_url}}/api/admin/sensors
      const sensorData = {
        sensor_id: formData.sensor_id.trim(),
        device_id: formData.device_id.trim() || formData.sensor_id.trim(),
        location: {
          lat: parseFloat(formData.latitude) || 19.076,
          lng: parseFloat(formData.longitude) || 72.8777,
          address: formData.location.trim() || "",
        },
        is_active: true,
        client_name: formData.client_name.trim(),
        site_name: formData.site_name.trim(),
        // Optional fields from Postman collection
        ...(formData.spoc_name && { spoc_name: formData.spoc_name.trim() }),
        ...(formData.spoc_contact && { spoc_contact: formData.spoc_contact.trim() }),
        ...(formData.remark && { remark: formData.remark.trim() }),
        ...(formData.remark_date && { remark_date: formData.remark_date }),
        ...(formData.installation_date && { installation_date: formData.installation_date }),
      }

      const ticketApiUrl = getTicketApiBaseUrl()
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }


      // Use POST /api/admin/sensors from Postman collection
      const createResponse = await fetch(`${ticketApiUrl}/admin/sensors`, {
        method: "POST",
        headers,
        body: JSON.stringify(sensorData),
      })

      const createResult = await createResponse.json().catch(() => null)


      if (!createResponse.ok) {
        throw new Error(
          createResult?.detail || createResult?.message || createResult?.error || "Failed to create sensor"
        )
      }

      const sensorId = createResult.sensor_id || createResult.data?.sensor_id || formData.sensor_id.trim()

      // Update remark if provided (using separate API call if needed)
      if (formData.remark || formData.remark_date) {
        try {
          const { updateSensorRemark } = await import("@/utils/api")
          await updateSensorRemark(
            sensorId,
            formData.remark.trim() || null,
            formData.remark_date || null
          )
        } catch (remarkError) {
          // Don't fail the whole operation if remark update fails
        }
      }

      toast.success("Sensor added successfully!")
      onOpenChange(false)
      // Call onSuccess callback to refresh the sensor list
      if (onSuccess) {
        // Add a small delay to ensure the backend has processed the creation
        setTimeout(() => {
          onSuccess()
        }, 500)
      }
    } catch (error) {
      console.error("Error adding sensor:", error)
      toast.error(error.message || "Failed to add sensor")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Sensor</DialogTitle>
          <DialogDescription>
            Enter all sensor details. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="sensor_id">
                  Sensor ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="sensor_id"
                  value={formData.sensor_id}
                  onChange={(e) => handleChange("sensor_id", e.target.value)}
                  placeholder="e.g., DUTON-12345"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="device_id">Site ID</Label>
                <Input
                  id="device_id"
                  value={formData.device_id}
                  onChange={(e) => handleChange("device_id", e.target.value)}
                  placeholder="Will use Sensor ID if empty"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Sensor Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Enter sensor name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="client_name">
                  Client Company <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) => handleChange("client_name", e.target.value)}
                  placeholder="Enter client company name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="site_name">
                  Site Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="site_name"
                  value={formData.site_name}
                  onChange={(e) => handleChange("site_name", e.target.value)}
                  placeholder="Enter site name"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="location">Address</Label>
              <Textarea
                id="location"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                placeholder="Enter full address"
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
                  placeholder="e.g., 19.0760"
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
                  placeholder="e.g., 72.8777"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="spoc_name">SPOC Name</Label>
                <Input
                  id="spoc_name"
                  value={formData.spoc_name}
                  onChange={(e) => handleChange("spoc_name", e.target.value)}
                  placeholder="e.g., Manufacturing Manager"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="spoc_contact">SPOC Contact</Label>
                <Input
                  id="spoc_contact"
                  value={formData.spoc_contact}
                  onChange={(e) => handleChange("spoc_contact", e.target.value)}
                  placeholder="e.g., +91 9876543222"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="installation_date">Installation Date</Label>
              <Input
                id="installation_date"
                type="date"
                value={formData.installation_date}
                onChange={(e) => handleChange("installation_date", e.target.value)}
              />
            </div>

            <div className="grid gap-2">
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
              <Label htmlFor="remark_date">Remark Date</Label>
              <Input
                id="remark_date"
                type="date"
                value={formData.remark_date}
                onChange={(e) => handleChange("remark_date", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Sensor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


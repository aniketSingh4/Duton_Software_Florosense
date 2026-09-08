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
import { PRIORITY_LEVELS, STATUS_FLOW, ISSUE_TYPES } from "@/lib/support-tickets"

export function TicketEditDialog({ ticket, open, onOpenChange, onSave }) {
  const [formData, setFormData] = useState({
    issueType: "",
    description: "",
    priority: "Medium",
    status: "Open",
    sensorId: "",
    fullName: "",
    location: "",
    assignee: "",
    closedBy: "",
  })

  useEffect(() => {
    if (ticket) {
      setFormData({
        issueType: ticket.issueType || "",
        description: ticket.description || "",
        priority: ticket.priority || "Medium",
        status: ticket.status || "Open",
        sensorId: ticket.sensorId || ticket.sensor_id || "",
        fullName: ticket.fullName || ticket.full_name || "",
        location: ticket.location || "",
        assignee: ticket.assignee || "",
        closedBy: ticket.closedBy || ticket.closed_by || "",
      })
    }
  }, [ticket])

  const handleSubmit = (e) => {
    e.preventDefault()
    const updatedTicket = {
      ...ticket,
      issueType: formData.issueType,
      description: formData.description,
      priority: formData.priority,
      status: formData.status,
      sensorId: formData.sensorId,
      fullName: formData.fullName,
      location: formData.location,
      assignee: formData.assignee,
      closedBy: formData.status === "Closed" ? formData.closedBy : "",
    }
    onSave(updatedTicket)
  }

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const inputLikeClass =
    "border-input h-10 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Ticket</DialogTitle>
          <DialogDescription>
            Update the ticket information. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="issueType">Issue Type</Label>
              <select
                id="issueType"
                value={formData.issueType}
                onChange={(e) => handleChange("issueType", e.target.value)}
                className={inputLikeClass}
                required
              >
                <option value="">Select issue</option>
                {ISSUE_TYPES.map((issue) => (
                  <option key={issue} value={issue}>
                    {issue}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Describe the issue"
                required
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => handleChange("priority", e.target.value)}
                  className={inputLikeClass}
                  required
                >
                  {PRIORITY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className={inputLikeClass}
                  required
                >
                  {STATUS_FLOW.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formData.status === "Closed" && (
              <div className="grid gap-2">
                <Label htmlFor="closedBy">Closed By</Label>
                <Input
                  id="closedBy"
                  value={formData.closedBy}
                  onChange={(e) => handleChange("closedBy", e.target.value)}
                  placeholder="Enter name of the person closing this ticket"
                  required
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="sensorId">Sensor ID</Label>
              <Input
                id="sensorId"
                value={formData.sensorId}
                onChange={(e) => handleChange("sensorId", e.target.value)}
                placeholder="Enter sensor ID"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                placeholder="Enter full name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                placeholder="Enter location"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="assignee">Assignee</Label>
              <Input
                id="assignee"
                value={formData.assignee}
                onChange={(e) => handleChange("assignee", e.target.value)}
                placeholder="Enter assignee name or email"
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


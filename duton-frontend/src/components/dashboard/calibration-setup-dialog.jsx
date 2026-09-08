"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { fetchUserSensors } from "@/utils/api"
import { toast } from "sonner"
import { Save, X, RotateCcw } from "lucide-react"

export function CalibrationSetupDialog({
  open,
  onOpenChange,
  restrictedSensorId = "",
  restrictedSensorName = "",
}) {
  const [selectedSensorId, setSelectedSensorId] = useState("")
  const [sensors, setSensors] = useState([])
  const [isLoadingSensors, setIsLoadingSensors] = useState(false)
  const [calibration, setCalibration] = useState({
    rh_strength_a: 0,
    rh_curvature_b: 0,
    initial_offset_k0: 0,
    fine_multiplier_k1: 1,
  })
  const [isLoading, setIsLoading] = useState(false)
  const isRestrictedToSingleSensor = Boolean(restrictedSensorId)

  // Fetch sensors when dialog opens
  useEffect(() => {
    if (open) {
      const loadSensors = async () => {
        setIsLoadingSensors(true)
        try {
          const sensorList = await fetchUserSensors()
          const normalizedSensors = sensorList || []

          if (isRestrictedToSingleSensor) {
            const matchingSensor = normalizedSensors.find((sensor) => {
              const sensorId = sensor.sensor_id || sensor.device_id || sensor.identifier || sensor.id
              return sensorId === restrictedSensorId
            })

            const singleSensorList = matchingSensor
              ? [matchingSensor]
              : [{ sensor_id: restrictedSensorId, name: restrictedSensorName || restrictedSensorId }]

            setSensors(singleSensorList)
            setSelectedSensorId(restrictedSensorId)
          } else {
            setSensors(normalizedSensors)
            if (normalizedSensors.length > 0 && !selectedSensorId) {
              // Auto-select first sensor
              const firstSensor = normalizedSensors[0]
              const sensorId = firstSensor.sensor_id || firstSensor.device_id || firstSensor.identifier || firstSensor.id
              setSelectedSensorId(sensorId)
            }
          }
        } catch (error) {
          console.error("Failed to load sensors:", error)
          toast.error("Failed to load sensors")
        } finally {
          setIsLoadingSensors(false)
        }
      }
      loadSensors()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isRestrictedToSingleSensor, restrictedSensorId, restrictedSensorName])

  useEffect(() => {
    if (open && selectedSensorId) {
      const loadCalibration = async () => {
        try {
          const { fetchSensorCalibration } = await import("@/utils/api")
          const saved = await fetchSensorCalibration(selectedSensorId)

          let calibrationData = null
          if (saved) {
            if (saved.calibration && typeof saved.calibration === 'object') {
              calibrationData = saved.calibration
            } else if (saved.data && typeof saved.data === 'object') {
              calibrationData = saved.data
            } else if (typeof saved === 'object' && 'rh_strength_a' in saved) {
              calibrationData = saved
            }
          }

          if (calibrationData && typeof calibrationData === 'object') {
            setCalibration({
              rh_strength_a: calibrationData.rh_strength_a ?? 0,
              rh_curvature_b: calibrationData.rh_curvature_b ?? 0,
              initial_offset_k0: calibrationData.initial_offset_k0 ?? 0,
              fine_multiplier_k1: calibrationData.fine_multiplier_k1 ?? 1,
            })
          } else {
            setCalibration({
              rh_strength_a: 0,
              rh_curvature_b: 0,
              initial_offset_k0: 0,
              fine_multiplier_k1: 1,
            })
          }
        } catch (error) {
          setCalibration({
            rh_strength_a: 0,
            rh_curvature_b: 0,
            initial_offset_k0: 0,
            fine_multiplier_k1: 1,
          })
        }
      }
      loadCalibration()
    } else if (open && !selectedSensorId) {
      setCalibration({
        rh_strength_a: 0,
        rh_curvature_b: 0,
        initial_offset_k0: 0,
        fine_multiplier_k1: 1,
      })
    }
  }, [open, selectedSensorId])

  const handleChange = (field, value) => {
    const numValue = value === "" ? "" : Number(value)
    setCalibration((prev) => ({
      ...prev,
      [field]: numValue,
    }))
  }

  const handleSave = async () => {
    if (!selectedSensorId) {
      toast.error("Please select a sensor", {
        position: "bottom-right",
      })
      return
    }

    setIsLoading(true)
    try {
      const { saveSensorCalibration } = await import("@/utils/api")
      await saveSensorCalibration(selectedSensorId, calibration)
      const selectedSensor = sensors.find(s => {
        const sensorId = s.sensor_id || s.device_id || s.identifier || s.id
        return sensorId === selectedSensorId
      })
      const sensorName = selectedSensor?.name || selectedSensor?.sensor_id || selectedSensorId
      toast.success(`Calibration settings saved for ${sensorName}`, {
        position: "bottom-right",
      })

      // Close the dialog after successful save
      onOpenChange(false)

      // Dispatch custom event to trigger PM values refresh
      // Use setTimeout to ensure dialog is closed and localStorage is updated
      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("calibrationSaved", {
            detail: { sensorId: selectedSensorId }
          }))
        }, 100)
      }
    } catch (error) {
      console.error("Error saving calibration:", error)
      toast.error(error?.message || "Failed to save calibration settings", {
        position: "bottom-right",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = async () => {
    if (!selectedSensorId) {
      toast.error("Please select a sensor", {
        position: "bottom-right",
      })
      return
    }

    setIsLoading(true)
    try {
      const defaultCalibration = {
        rh_strength_a: 0,
        rh_curvature_b: 0,
        initial_offset_k0: 0,
        fine_multiplier_k1: 1,
      }

      const { saveSensorCalibration } = await import("@/utils/api")
      await saveSensorCalibration(selectedSensorId, defaultCalibration)
      setCalibration(defaultCalibration)

      const selectedSensor = sensors.find(s => {
        const sensorId = s.sensor_id || s.device_id || s.identifier || s.id
        return sensorId === selectedSensorId
      })
      const sensorName = selectedSensor?.name || selectedSensor?.sensor_id || selectedSensorId
      toast.success(`Calibration reset to default for ${sensorName}`, {
        position: "bottom-right",
      })
    } catch (error) {
      console.error("Error resetting calibration:", error)
      toast.error(error?.message || "Failed to reset calibration settings", {
        position: "bottom-right",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    // Just close the dialog - changes are discarded
    // Values will be reloaded from database when dialog reopens
    onOpenChange(false)
  }

  const fields = [
    { id: "rh_strength_a", label: "RH Strength (a)", field: "rh_strength_a", placeholder: "0", description: "Variable a in calibration formula" },
    { id: "rh_curvature_b", label: "RH Curvature (b)", field: "rh_curvature_b", placeholder: "0", description: "Variable b in calibration formula" },
    { id: "initial_offset_k0", label: "Initial Offset (K0)", field: "initial_offset_k0", placeholder: "0", description: "K0 in calibration formula" },
    { id: "fine_multiplier_k1", label: "Fine Multiplier (K1)", field: "fine_multiplier_k1", placeholder: "1", description: "K1 in calibration formula" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calibration Setup</DialogTitle>
          <DialogDescription>
            Configure calibration parameters for sensor. These values apply to both PM2.5 and PM10 readings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="sensor-select">Select Sensor</Label>
            <select
              id="sensor-select"
              value={selectedSensorId}
              onChange={(e) => setSelectedSensorId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoadingSensors || isRestrictedToSingleSensor}
            >
              {isLoadingSensors ? (
                <option value="">Loading sensors...</option>
              ) : sensors.length === 0 ? (
                <option value="">No sensors found</option>
              ) : (
                <>
                  <option value="">Select a sensor...</option>
                  {sensors.map((sensor) => {
                    const sensorId = sensor.sensor_id || sensor.device_id || sensor.identifier || sensor.id
                    const sensorName = sensor.name || sensor.sensor_name || sensorId
                    return (
                      <option key={sensorId} value={sensorId}>
                        {sensorName}
                      </option>
                    )
                  })}
                </>
              )}
            </select>
          </div>

          {!selectedSensorId ? (
            <div className="space-y-4 border rounded-lg p-6 min-h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground">Please select a sensor to configure calibration</p>
            </div>
          ) : (
            <div className="space-y-4 border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Calibration Parameters</h3>
              <div className="grid grid-cols-2 gap-4">
                {fields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id}>{field.label}</Label>
                    <Input
                      id={field.id}
                      type="number"
                      step="any"
                      value={calibration[field.field]}
                      onChange={(e) => handleChange(field.field, e.target.value)}
                      placeholder={field.placeholder}
                    />
                    {field.description && (
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end items-center gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel} disabled={isLoading || !selectedSensorId}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isLoading || !selectedSensorId}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !selectedSensorId}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


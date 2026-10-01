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
import { normalizeCalibration } from "@/utils/calibration"
import { toast } from "sonner"
import { Save, X, RotateCcw } from "lucide-react"

const DEFAULT_FORM = {
  rh_strength_a: 0,
  rh_curvature_b: 0,
  initial_offset_k0: 0,
  fine_multiplier_k1: 1,
}

const DEFAULT_CALIBRATION_FORM = {
  pm25: { ...DEFAULT_FORM },
  pm10: { ...DEFAULT_FORM },
}

const FIELDS = [
  { id: "rh_strength_a", label: "RH Strength (a)", field: "rh_strength_a", placeholder: "0", description: "Variable a in calibration formula" },
  { id: "rh_curvature_b", label: "RH Curvature (b)", field: "rh_curvature_b", placeholder: "0", description: "Variable b in calibration formula" },
  { id: "initial_offset_k0", label: "Initial Offset (K0)", field: "initial_offset_k0", placeholder: "0", description: "K0 in calibration formula" },
  { id: "fine_multiplier_k1", label: "Fine Multiplier (K1)", field: "fine_multiplier_k1", placeholder: "1", description: "K1 in calibration formula" },
]

const toNumber = (value, fallback) => {
  if (value === "" || value === null || value === undefined || Number.isNaN(Number(value))) {
    return fallback
  }
  return Number(value)
}

const storedToForm = (config) => ({
  rh_strength_a: config?.variationMin ?? 0,
  rh_curvature_b: config?.variationMax ?? 0,
  initial_offset_k0: config?.k0 ?? 0,
  fine_multiplier_k1: config?.k1 ?? 1,
})

const formToStored = (fields) => ({
  k0: toNumber(fields?.initial_offset_k0, 0),
  k1: toNumber(fields?.fine_multiplier_k1, 1),
  variationMin: toNumber(fields?.rh_strength_a, 0),
  variationMax: toNumber(fields?.rh_curvature_b, 0),
})

const formFromSaved = (saved) => {
  const normalized = normalizeCalibration(saved)
  return {
    pm25: storedToForm(normalized.pm25),
    pm10: storedToForm(normalized.pm10),
  }
}

const buildPayload = (formState, loadedState, target) => {
  if (target === "all") {
    const shared = formToStored(formState.pm25)
    return {
      pm25: shared,
      pm10: { ...shared },
    }
  }

  return {
    pm25: formToStored(target === "pm25" ? formState.pm25 : loadedState.pm25),
    pm10: formToStored(target === "pm10" ? formState.pm10 : loadedState.pm10),
  }
}

const targetLabel = (target) => {
  if (target === "pm25") return "PM2.5"
  if (target === "pm10") return "PM10"
  return "All"
}

export function CalibrationSetupDialog({
  open,
  onOpenChange,
  restrictedSensorId = "",
  restrictedSensorName = "",
}) {
  const [selectedSensorId, setSelectedSensorId] = useState("")
  const [sensors, setSensors] = useState([])
  const [isLoadingSensors, setIsLoadingSensors] = useState(false)
  const [calibrationTarget, setCalibrationTarget] = useState("all")
  const [calibration, setCalibration] = useState(DEFAULT_CALIBRATION_FORM)
  const [loadedCalibration, setLoadedCalibration] = useState(DEFAULT_CALIBRATION_FORM)
  const [isLoading, setIsLoading] = useState(false)
  const isRestrictedToSingleSensor = Boolean(restrictedSensorId)

  // Fetch sensors when dialog opens
  useEffect(() => {
    if (open) {
      setCalibrationTarget("all")
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
          const form = saved ? formFromSaved(saved) : {
            pm25: { ...DEFAULT_FORM },
            pm10: { ...DEFAULT_FORM },
          }
          setCalibration(form)
          setLoadedCalibration(form)
        } catch (error) {
          const form = {
            pm25: { ...DEFAULT_FORM },
            pm10: { ...DEFAULT_FORM },
          }
          setCalibration(form)
          setLoadedCalibration(form)
        }
      }
      loadCalibration()
    } else if (open && !selectedSensorId) {
      const form = {
        pm25: { ...DEFAULT_FORM },
        pm10: { ...DEFAULT_FORM },
      }
      setCalibration(form)
      setLoadedCalibration(form)
    }
  }, [open, selectedSensorId])

  const handleChange = (pollutant, field, value) => {
    const numValue = value === "" ? "" : Number(value)
    setCalibration((prev) => ({
      ...prev,
      [pollutant]: {
        ...prev[pollutant],
        [field]: numValue,
      },
    }))
  }

  const sensorNameFor = () => {
    const selectedSensor = sensors.find(s => {
      const sensorId = s.sensor_id || s.device_id || s.identifier || s.id
      return sensorId === selectedSensorId
    })
    return selectedSensor?.name || selectedSensor?.sensor_id || selectedSensorId
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
      const payload = buildPayload(calibration, loadedCalibration, calibrationTarget)
      const { saveSensorCalibration } = await import("@/utils/api")
      await saveSensorCalibration(selectedSensorId, payload)

      const savedForm = formFromSaved(payload)
      setCalibration(savedForm)
      setLoadedCalibration(savedForm)

      toast.success(`Calibration settings saved for ${targetLabel(calibrationTarget)} on ${sensorNameFor()}`, {
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
      const nextForm = calibrationTarget === "all"
        ? {
          pm25: { ...DEFAULT_FORM },
          pm10: { ...DEFAULT_FORM },
        }
        : {
          pm25: calibrationTarget === "pm25" ? { ...DEFAULT_FORM } : { ...loadedCalibration.pm25 },
          pm10: calibrationTarget === "pm10" ? { ...DEFAULT_FORM } : { ...loadedCalibration.pm10 },
        }
      const payload = {
        pm25: formToStored(nextForm.pm25),
        pm10: formToStored(nextForm.pm10),
      }

      const { saveSensorCalibration } = await import("@/utils/api")
      await saveSensorCalibration(selectedSensorId, payload)
      setCalibration(nextForm)
      setLoadedCalibration(nextForm)

      toast.success(`Calibration reset to default for ${targetLabel(calibrationTarget)} on ${sensorNameFor()}`, {
        position: "bottom-right",
      })

      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("calibrationSaved", {
            detail: { sensorId: selectedSensorId }
          }))
        }, 100)
      }
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

  const activePollutant = calibrationTarget === "pm10" ? "pm10" : "pm25"
  const sectionTitle = calibrationTarget === "all"
    ? "Calibration Parameters"
    : calibrationTarget === "pm25"
      ? "PM2.5 Calibration Parameters"
      : "PM10 Calibration Parameters"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calibration Setup</DialogTitle>
          <DialogDescription>
            Choose All, PM2.5, or PM10. All applies one set of values to both readings. PM2.5 and PM10 can also be calibrated on their own.
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
            <>
              <div className="space-y-2">
                <Label htmlFor="calibration-target">Calibrate</Label>
                <select
                  id="calibration-target"
                  value={calibrationTarget}
                  onChange={(e) => setCalibrationTarget(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isLoading}
                >
                  <option value="all">All</option>
                  <option value="pm25">PM2.5</option>
                  <option value="pm10">PM10</option>
                </select>
              </div>

              <div className="space-y-4 border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">{sectionTitle}</h3>
                {calibrationTarget === "all" && (
                  <p className="text-sm text-muted-foreground -mt-2">
                    These values apply to both PM2.5 and PM10.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {FIELDS.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.id}>{field.label}</Label>
                      <Input
                        id={field.id}
                        type="number"
                        step="any"
                        value={calibration[activePollutant][field.field]}
                        onChange={(e) => handleChange(activePollutant, field.field, e.target.value)}
                        placeholder={field.placeholder}
                      />
                      {field.description && (
                        <p className="text-xs text-muted-foreground">{field.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
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

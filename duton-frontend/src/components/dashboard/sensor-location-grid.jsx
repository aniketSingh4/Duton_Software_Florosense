"use client"

import { SensorLocationCard } from "./sensor-location-card"

export function SensorLocationGrid({
  sensors = [],
  onUpdate,
  onDelete,
  onRemarkUpdate,
  offlineTimestamps = {},
  isAdmin = false,
  isAssignee = false,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
      {sensors.map((sensor) => (
        <SensorLocationCard 
          key={sensor.id} 
          sensor={sensor}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onRemarkUpdate={onRemarkUpdate}
          offlineTimestamp={offlineTimestamps[sensor.id]}
          isAdmin={isAdmin}
          isAssignee={isAssignee}
        />
      ))}
    </div>
  )
}


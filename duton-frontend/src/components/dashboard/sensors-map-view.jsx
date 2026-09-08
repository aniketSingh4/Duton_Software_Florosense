"use client"

import dynamic from 'next/dynamic'

const MapComponent = dynamic(
    () => import('./map-component'),
    { ssr: false }
)

export function SensorsMapView({ sensors }) {
    if (typeof window === "undefined") {
        return null;
    }
    return <MapComponent sensors={sensors} />
}

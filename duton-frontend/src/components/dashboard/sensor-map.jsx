"use client"

import { useEffect, useState, useRef, useCallback } from "react"

export function SensorMap({ latitude, longitude, sensorName, height = "200px", zoom = 13, scrollWheelZoom = false }) {
  const [shouldRenderMap, setShouldRenderMap] = useState(false)
  const [MapContainer, setMapContainer] = useState(null)
  const [TileLayer, setTileLayer] = useState(null)
  const [Marker, setMarker] = useState(null)
  const [Popup, setPopup] = useState(null)
  const containerRef = useRef(null)
  const mapKeyRef = useRef(0)
  const initTimeoutRef = useRef(null)
  const readyCheckRef = useRef(null)
  const isInitializingRef = useRef(false)

  // Validate coordinates
  const isValidCoords = latitude != null && longitude != null && 
                        !isNaN(latitude) && !isNaN(longitude) &&
                        latitude >= -90 && latitude <= 90 &&
                        longitude >= -180 && longitude <= 180

  // Check if container is in DOM and has dimensions
  const checkContainerReady = useCallback(() => {
    if (!containerRef.current) return false
    
    try {
      // Check if element is in the document
      if (!document.body.contains(containerRef.current)) {
        return false
      }
      
      // Check if element has dimensions (is visible)
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        return false
      }
      
      // Check if parent exists
      if (!containerRef.current.parentElement) {
        return false
      }
      
      return true
    } catch (e) {
      return false
    }
  }, [])

  // Initialize Leaflet components
  useEffect(() => {
    if (typeof window === "undefined") return
    
    // Prevent multiple initializations
    if (isInitializingRef.current) return
    isInitializingRef.current = true
    
    Promise.all([
      import("react-leaflet"),
      import("leaflet")
    ]).then(([leaflet, LModule]) => {
      const L = LModule.default || LModule
      
      try {
        if (L.Icon && L.Icon.Default && L.Icon.Default.prototype) {
          if (L.Icon.Default.prototype._getIconUrl) {
            delete L.Icon.Default.prototype._getIconUrl
          }
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
            iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
            shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
          })
        }
      } catch (e) {
      }
      
      setMapContainer(() => leaflet.MapContainer)
      setTileLayer(() => leaflet.TileLayer)
      setMarker(() => leaflet.Marker)
      setPopup(() => leaflet.Popup)
      isInitializingRef.current = false
    }).catch((err) => {
      console.error("Failed to load Leaflet:", err)
      isInitializingRef.current = false
    })
  }, [])

  // Wait for container to be ready before rendering map
  useEffect(() => {
    if (!isValidCoords || !MapContainer || !TileLayer || !Marker || !Popup) {
      setShouldRenderMap(false)
      return
    }

    // Reset render state when props change
    setShouldRenderMap(false)
    mapKeyRef.current += 1

    // Clear any existing checks
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current)
    }
    if (readyCheckRef.current) {
      clearInterval(readyCheckRef.current)
    }

    let isMounted = true

    // Function to check and set ready state
    const checkReady = () => {
      if (!isMounted) return
      
      if (checkContainerReady()) {
        // Use requestAnimationFrame to ensure DOM is fully ready
        requestAnimationFrame(() => {
          if (!isMounted) return
          
          if (checkContainerReady()) {
            setShouldRenderMap(true)
            if (readyCheckRef.current) {
              clearInterval(readyCheckRef.current)
              readyCheckRef.current = null
            }
          }
        })
      }
    }

    // Start checking after a delay
    initTimeoutRef.current = setTimeout(() => {
      if (!isMounted) return
      checkReady()
      
      // Keep checking until ready (use ref to avoid stale closure)
      if (readyCheckRef.current === null) {
        readyCheckRef.current = setInterval(() => {
          if (!isMounted) {
            if (readyCheckRef.current) {
              clearInterval(readyCheckRef.current)
              readyCheckRef.current = null
            }
            return
          }
          checkReady()
        }, 100)
      }
    }, 300)

    return () => {
      isMounted = false
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current)
        initTimeoutRef.current = null
      }
      if (readyCheckRef.current) {
        clearInterval(readyCheckRef.current)
        readyCheckRef.current = null
      }
      setShouldRenderMap(false)
    }
  }, [latitude, longitude, sensorName, isValidCoords, MapContainer, TileLayer, Marker, Popup, checkContainerReady])

  const heightPx = height.includes("px") ? height : "200px"

  // Always render the container div first
  return (
    <div 
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden"
      style={{ 
        height: heightPx,
        width: "100%",
        position: "relative",
        zIndex: 0,
        minHeight: heightPx
      }}
    >
      {!isValidCoords ? (
        <div className="w-full h-full rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
          <div className="text-muted-foreground text-sm">Invalid coordinates</div>
        </div>
      ) : !MapContainer || !TileLayer || !Marker || !Popup || !shouldRenderMap ? (
        <div className="w-full h-full rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
          <div className="text-muted-foreground text-sm">Loading map...</div>
        </div>
      ) : (
        <MapContainer
          key={`map-${mapKeyRef.current}-${latitude}-${longitude}-${sensorName}-${zoom}`}
          center={[latitude, longitude]}
          zoom={zoom}
          style={{ 
            height: "100%", 
            width: "100%",
            zIndex: 0
          }}
          scrollWheelZoom={scrollWheelZoom}
          zoomControl={true}
          className="z-0 rounded-xl"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <Marker position={[latitude, longitude]}>
            <Popup>
              <div>
                <strong>{sensorName}</strong>
                <br />
                <small>{latitude.toFixed(4)}, {longitude.toFixed(4)}</small>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      )}
    </div>
  )
}

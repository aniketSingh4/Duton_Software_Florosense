"use client"

import { useEffect, useState } from "react"

import { fetchUserSensors } from "@/utils/api"

const SENSOR_CACHE_TTL_MS = 60 * 1000
let cachedSensors = null
let cachedAt = 0
let sensorsRequestPromise = null

const getCachedSensors = () => {
  const isFresh = cachedSensors && (Date.now() - cachedAt) < SENSOR_CACHE_TTL_MS
  return isFresh ? cachedSensors : null
}

const loadSensorsShared = async () => {
  const cached = getCachedSensors()
  if (cached) return cached

  if (!sensorsRequestPromise) {
    sensorsRequestPromise = fetchUserSensors()
      .then((result) => {
        const normalized = Array.isArray(result) ? result : []
        cachedSensors = normalized
        cachedAt = Date.now()
        return normalized
      })
      .finally(() => {
        sensorsRequestPromise = null
      })
  }

  return sensorsRequestPromise
}

export function useTicketSensors(options = {}) {
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const enabled = options?.enabled ?? true

  useEffect(() => {
    if (!enabled) {
      setSensors([])
      setError(null)
      setLoading(false)
      return
    }

    let isMounted = true

    async function loadSensors() {
      try {
        const result = await loadSensorsShared()
        if (!isMounted) return
        setSensors(Array.isArray(result) ? result : [])
      } catch (err) {
        if (!isMounted) return
        setError(err)
        console.error("Failed to load sensors for tickets", err)
        setSensors([])
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadSensors()
    return () => {
      isMounted = false
    }
  }, [enabled])

  return { sensors, loading, error }
}


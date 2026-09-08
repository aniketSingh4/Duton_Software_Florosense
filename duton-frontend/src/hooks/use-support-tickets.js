"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { fetchSupportTickets } from "@/utils/api"

export const TICKET_EVENT_KEY = "duton_support_tickets_refresh"

export const emitTicketRefresh = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TICKET_EVENT_KEY))
  }
}

export function useSupportTickets(filters = {}, options = {}) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const enabled = options?.enabled ?? true

  const serializedFilters = useMemo(() => JSON.stringify(filters || {}), [filters])

  const refetch = useCallback(() => {
    setRefreshIndex((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setTickets([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    const isInitialLoad = refreshIndex === 0

    async function loadTickets() {
      if (isInitialLoad) {
        setLoading(true)
      }
      setError(null)
      try {
        const parsedFilters = JSON.parse(serializedFilters || "{}")
        const data = await fetchSupportTickets(parsedFilters)
        if (!cancelled) {
          setTickets(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err)
          if (isInitialLoad) {
            setTickets([])
          }
          console.error("Failed to load tickets", err)
        }
      } finally {
        if (!cancelled && isInitialLoad) {
          setLoading(false)
        }
      }
    }
    loadTickets()
    return () => {
      cancelled = true
    }
  }, [serializedFilters, refreshIndex, enabled])

  useEffect(() => {
    const handleRefresh = () => refetch()
    if (typeof window !== "undefined") {
      window.addEventListener(TICKET_EVENT_KEY, handleRefresh)
      return () => window.removeEventListener(TICKET_EVENT_KEY, handleRefresh)
    }
    return undefined
  }, [refetch])

  return {
    tickets,
    loading,
    error,
    refetch,
  }
}


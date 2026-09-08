"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { LogOut } from "lucide-react"

import { SupportTicketActions } from "@/components/dashboard/support-ticket-actions"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/ui/theme-toggle"

const ONLINE_STATUS_KEY = "duton_online_status"
const ADMIN_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
const DEFAULT_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export function DashboardHeader() {
  const [username, setUsername] = useState(() =>
    typeof window !== "undefined" ? (window.localStorage.getItem("duton_username") || "") : ""
  )
  const [status, setStatus] = useState(() => {
    if (typeof window === "undefined") return "online"
    const storedStatus = window.localStorage.getItem(ONLINE_STATUS_KEY)
    return storedStatus === "online" || storedStatus === "offline" ? storedStatus : "online"
  })
  const [logoutToast, setLogoutToast] = useState("")
  const router = useRouter()

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleStorage = (event) => {
      if (event.key === "duton_username") {
        setUsername(event.newValue || "")
      }
      if (event.key === ONLINE_STATUS_KEY && event.newValue) {
        setStatus(event.newValue)
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  const handleLogout = useCallback(() => {
    if (typeof window !== "undefined") {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("discord_alert_") || key.startsWith("discord_value_alert_")) {
          localStorage.removeItem(key)
        }
      })
      localStorage.removeItem("duton_access_token")
      localStorage.removeItem("duton_refresh_token")
      localStorage.removeItem("duton_token_type")
      localStorage.removeItem("duton_token_expiry")
      localStorage.removeItem("duton_username")
    }
    router.push("/login")
  }, [router])

  const showLogoutToast = useCallback((message) => {
    setLogoutToast(message)
    window.setTimeout(() => setLogoutToast(""), 4000)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const userType = window.localStorage.getItem("duton_user_type")
    const inactivityTimeoutMs =
      userType === "admin" ? ADMIN_INACTIVITY_TIMEOUT_MS : DEFAULT_INACTIVITY_TIMEOUT_MS
    let timerId

    const resetTimer = () => {
      if (timerId) {
        clearTimeout(timerId)
      }
      timerId = window.setTimeout(() => {
        showLogoutToast("You were logged out due to inactivity.")
        window.setTimeout(() => {
          handleLogout()
        }, 1500)
      }, inactivityTimeoutMs)
    }

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"]
    events.forEach((event) => window.addEventListener(event, resetTimer))
    resetTimer()

    return () => {
      if (timerId) {
        clearTimeout(timerId)
      }
      events.forEach((event) => window.removeEventListener(event, resetTimer))
    }
  }, [handleLogout, showLogoutToast])

  const toggleStatus = () => {
    setStatus((prev) => {
      const next = prev === "online" ? "offline" : "online"
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ONLINE_STATUS_KEY, next)
      }
      return next
    })
  }

  const isOnline = status === "online"

  return (
    <>
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center">
            <div className="relative h-8 w-24 md:h-10 md:w-32">
              <Image
                src="/Duton_Black.png"
                alt="Duton Logo"
                fill
                className="object-contain dark:hidden"
                priority
              />
              <Image
                src="/Duton_Whiite.png"
                alt="Duton Logo"
                fill
                className="object-contain hidden dark:block"
                priority
              />
            </div>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            {username && (
              <div className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium text-muted-foreground">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold uppercase">
                  {username.charAt(0)}
                </span>
                <span className="max-w-[120px] truncate">{username}</span>
              </div>
            )}
            <ModeToggle />
            <SupportTicketActions hideRaiseTicket={false} />
            <Button
              type="button"
              variant="outline"
              onClick={toggleStatus}
              aria-pressed={isOnline}
              className="flex items-center gap-2 text-sm"
            >
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-slate-400"}`}
              />
              {isOnline ? "Online" : "Offline"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
        </div>
      </header>

      {logoutToast && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-60">
          <div className="min-w-[280px] max-w-sm animate-pop rounded-lg border border-emerald-300 bg-white px-5 py-3 text-sm font-medium text-emerald-700 shadow-2xl">
            {logoutToast}
          </div>
        </div>
      )}
    </>
  )
}


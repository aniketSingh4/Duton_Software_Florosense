"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"

export function SiteInformation({ siteId }) {
  const [now] = useState(() => new Date())
  const formattedDate = format(now, "dd/MM/yyyy")
  const formattedTime = format(now, "HH:mm")

  const normalizedSiteId =
    siteId === null || siteId === undefined || String(siteId).trim() === "" ? null : String(siteId)

  return (
    <Card>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium mb-1">Site ID:</div>
            <div className="text-lg font-semibold">{normalizedSiteId ?? "null"}</div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t">
            <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="text-sm">
              <div className="font-medium">
                {formattedDate && formattedTime ? `${formattedDate} ${formattedTime}` : "--"}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


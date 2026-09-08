"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Phone, MapPin } from "lucide-react"

export function SPOCDetails({ spoc, contact, spocAddress, sensorAddress }) {
  const normalizedAddress = typeof spocAddress === "string" ? spocAddress.trim() : ""
  const addressText = normalizedAddress || (!sensorAddress ? "Address not found" : null)

  return (
    <Card className="shadow-sm border-border/50 py-4">
      <CardHeader className="pb-2 pt-0 px-4">
        <CardTitle className="text-base font-semibold">SPOC Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-3 pt-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Name</div>
            <div className="font-semibold">{spoc}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2 border-t">
          <div className="p-2 rounded-lg bg-primary/10">
            <Phone className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Contact</div>
            <a
              href={`tel:${contact}`}
              className="font-semibold text-primary hover:underline"
            >
              {contact}
            </a>
          </div>
        </div>
        <div className="flex items-start gap-3 pt-2 border-t">
          <div className="p-2 rounded-lg bg-primary/10">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Full Address</div>
            {addressText && <p className="font-semibold leading-snug">{addressText}</p>}
            {sensorAddress && (
              <p className={`font-semibold leading-snug ${addressText ? "mt-2" : ""}`}>{sensorAddress}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


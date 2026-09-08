"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { forgotPassword } from "@/utils/api"
import { toast } from "sonner"

export function ForgotPasswordDialog({ open, onOpenChange }) {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError("")

    try {
      await forgotPassword(email.trim())
      
      toast.success("OTP sent successfully! Please check your email.")
      onOpenChange(false)
      router.push(`/forgot-password?email=${encodeURIComponent(email.trim())}`)
      setEmail("")
    } catch (err) {
      console.error("Forgot password error:", err)
      const errorMessage = err.message || "Failed to send OTP. Please try again."
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forgot your password?</DialogTitle>
          <DialogDescription>
            Enter your email address and we'll send you an OTP to reset your password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reset-email">Email</FieldLabel>
              <Input
                id="reset-email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </Field>
            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}
          </FieldGroup>
          <DialogFooter style={{marginTop: "1rem"}}>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send Otp"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


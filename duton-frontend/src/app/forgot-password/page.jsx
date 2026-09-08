"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useMemo, useState, Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Eye, EyeOff } from "lucide-react"
import { resetPassword, verifyOTP, forgotPassword } from "@/utils/api"
import { toast } from "sonner"

// Force dynamic rendering to prevent prerendering errors with useSearchParams
export const dynamic = 'force-dynamic'

function ForgotPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialEmail = useMemo(() => searchParams.get("email") || "", [searchParams])
  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState(initialEmail ? "verify" : "email") // "email", "verify", "reset"

  const handleSendOTP = async (e) => {
    e.preventDefault()
    if (isSubmitting || !email) return

    setIsSubmitting(true)
    setError("")

    try {
      await forgotPassword(email.trim())
      toast.success("OTP sent successfully! Please check your email.")
      setStep("verify")
    } catch (err) {
      console.error("Send OTP error:", err)
      setError(err.message || "Failed to send OTP. Please try again.")
      toast.error(err.message || "Failed to send OTP")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      await verifyOTP(email.trim(), otp)
      toast.success("OTP verified successfully!")
      setStep("reset")
    } catch (err) {
      console.error("Verify OTP error:", err)
      setError(err.message || "Invalid or expired OTP")
      toast.error(err.message || "Invalid or expired OTP")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting || !password || !otp) return

    setIsSubmitting(true)
    setError("")

    try {
      await resetPassword(email.trim(), otp.trim(), password)
      toast.success("Password reset successfully! You can now login.")
      router.push("/login")
    } catch (err) {
      console.error("Reset password error:", err)
      setError(err.message || "Failed to reset password. Please try again.")
      toast.error(err.message || "Failed to reset password")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="/856171-hd_1920_1080_30fps.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-background/70 backdrop-blur" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-semibold">Reset Password</CardTitle>
            </CardHeader>
            <CardContent>
              {step === "email" && (
                <form className="space-y-6" onSubmit={handleSendOTP}>
                  <FieldGroup className="space-y-4">
                    <Field>
                      <FieldLabel>Email</FieldLabel>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email address"
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
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Sending..." : "Send OTP"}
                  </Button>
                </form>
              )}

              {step === "verify" && (
                <div className="space-y-6">
                  <FieldGroup className="space-y-4">
                    <Field>
                      <FieldLabel>Email</FieldLabel>
                      <Input value={email} disabled />
                    </Field>
                    <Field>
                      <FieldLabel>Enter OTP</FieldLabel>
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        containerClassName="justify-center"
                        className="w-full justify-center"
                      >
                        <InputOTPGroup className="gap-2">
                          {[0, 1, 2, 3, 4, 5].map((index) => (
                            <InputOTPSlot key={index} index={index} className="h-10 w-10 text-base" />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                      {error && (
                        <p className="text-sm text-red-500 mt-2" role="alert">
                          {error}
                        </p>
                      )}
                    </Field>
                  </FieldGroup>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStep("email")}
                      disabled={isSubmitting}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={handleVerifyOTP}
                      disabled={isSubmitting || otp.length !== 6}
                    >
                      {isSubmitting ? "Verifying..." : "Verify OTP"}
                    </Button>
                  </div>
                </div>
              )}

              {step === "reset" && (
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <FieldGroup className="space-y-4">
                    <Field>
                      <FieldLabel>Email</FieldLabel>
                      <Input value={email} disabled />
                    </Field>
                    <Field>
                      <FieldLabel>OTP</FieldLabel>
                      <Input value={otp} disabled />
                    </Field>
                    <Field>
                      <FieldLabel>New Password</FieldLabel>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your new password"
                          required
                          disabled={isSubmitting}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-3 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </Field>
                    {error && (
                      <p className="text-sm text-red-500" role="alert">
                        {error}
                      </p>
                    )}
                  </FieldGroup>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStep("verify")}
                      disabled={isSubmitting}
                    >
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" disabled={isSubmitting || !password}>
                      {isSubmitting ? "Resetting..." : "Reset Password"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/856171-hd_1920_1080_30fps.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-background/70 backdrop-blur" />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <Card className="shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-semibold">Reset Password</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground">Loading...</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  )
}


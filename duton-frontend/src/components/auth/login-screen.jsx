import { LoginForm } from "@/components/auth/login-form"
import { VideoBackground } from "@/components/layout/video-background"

export function LoginScreen() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <VideoBackground />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm md:max-w-4xl">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}

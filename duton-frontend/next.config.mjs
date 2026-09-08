/** @type {import('next').NextConfig} */

if (process.env.NODE_ENV === "production" && !process.env.BACKEND_URL) {
  console.error("❌ CRITICAL ERROR: BACKEND_URL is not defined in environment variables!");
  process.exit(1);
}

const nextConfig = {
  async rewrites() {
    // Ticket backend URL. Keep this pointing to the Express API (default dev port is 8001).
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8001"

    return [
      {
        // Only forward ticket-backend API prefixes.
        // IMPORTANT: Do not rewrite Next's own local API routes like `/api/proxy/*`.
        source: "/api/tickets/:path*",
        destination: `${backendUrl}/api/tickets/:path*`,
      },
      {
        source: "/api/admin/:path*",
        destination: `${backendUrl}/api/admin/:path*`,
      },
      {
        source: "/api/users/:path*",
        destination: `${backendUrl}/api/users/:path*`,
      },
      {
        source: "/api/sensors/:path*",
        destination: `${backendUrl}/api/sensors/:path*`,
      },
      {
        source: "/api/assignee/:path*",
        destination: `${backendUrl}/api/assignee/:path*`,
      },
      {
        source: "/api/sites/:path*",
        destination: `${backendUrl}/api/sites/:path*`,
      },
      {
        source: "/api/amc/:path*",
        destination: `${backendUrl}/api/amc/:path*`,
      },
      {
        source: "/calibration-proxy/:path*",
        destination: "https://api.florosense.cloud/:path*",
      },
    ]
  },
}

export default nextConfig;

import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'geolocation=(), camera=(), microphone=()' },
]

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.136'],
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
};

export default nextConfig;

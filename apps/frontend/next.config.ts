import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ['stony-hardener-emergency.ngrok-free.dev'],
  async rewrites() {
    return [
      {
        source: '/api/socket',
        destination: `${BACKEND_URL}/socket.io/`,
      },
      {
        source: '/api/socket/:path*',
        destination: `${BACKEND_URL}/socket.io/:path*`,
      },
      {
        source: '/turn-credentials',
        destination: `${BACKEND_URL}/turn-credentials`,
      },
    ];
  },
};

export default nextConfig;

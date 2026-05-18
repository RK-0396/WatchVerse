import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ['stony-hardener-emergency.ngrok-free.dev'],
  async rewrites() {
    return [
      {
        source: '/api/socket',
        destination: 'http://127.0.0.1:3001/socket.io/',
      },
      {
        source: '/api/socket/:path*',
        destination: 'http://127.0.0.1:3001/socket.io/:path*',
      },
    ];
  },
};

export default nextConfig;

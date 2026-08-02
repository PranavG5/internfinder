import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pg is a server-only driver; keep it out of the client bundle graph.
  serverExternalPackages: ['pg'],
  experimental: {
    // Search and tracker pages read the DB on every request.
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;

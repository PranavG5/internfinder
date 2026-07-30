import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // better-sqlite3 is a native addon; it must not be bundled by Turbopack/webpack.
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    // Search and tracker pages read the DB on every request.
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;

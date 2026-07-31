import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // better-sqlite3 is a native addon; it must not be bundled by Turbopack/webpack.
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    // Search and tracker pages read the DB on every request.
    staleTimes: { dynamic: 0 },
  },
  // On a serverless host the SQLite file has to travel with the function, or the
  // route handlers will not find it at runtime.
  outputFileTracingIncludes: {
    '/**': ['./data/internfinder.db', './src/lib/schema.sql'],
  },
};

export default nextConfig;

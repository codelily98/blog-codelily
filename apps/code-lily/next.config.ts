import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(import.meta.dirname, '../..'),
  transpilePackages: [
    '@codelily/ui',
    '@codelily/editor',
    '@codelily/charts',
    '@codelily/grid',
    '@codelily/content',
    '@codelily/storage',
    '@codelily/contracts',
  ],
  poweredByHeader: false,
  images: { unoptimized: true },
  serverExternalPackages: ['pg', '@electric-sql/pglite'],
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: "base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
          },
        ],
      },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/manage/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
    ];
  },
};
export default config;

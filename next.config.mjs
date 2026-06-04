/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 'standalone' is needed for the Docker/self-hosted target, but conflicts with
  // the Netlify Next.js runtime, which manages its own output. Disable it on Netlify.
  output: process.env.NETLIFY ? undefined : 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.coingecko.com' },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ]
  },
}

export default nextConfig

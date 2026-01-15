import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('argon2')
    }
    return config
  }
}

export default nextConfig

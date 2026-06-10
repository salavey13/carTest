let userConfig = undefined
try {
  userConfig = await import('./v0-user-next.config')
} catch (e) {
  // ignore error
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Packages that should only be resolved on the server side
  // This prevents Next.js from bundling them during build
  serverExternalPackages: ['@xenova/transformers', '@huggingface/transformers'],
  // Note: server-assets fonts are bundled automatically without explicit tracing
  // Disabled experimental features to reduce memory usage during build
  // Disable source maps in production to reduce memory usage
  productionBrowserSourceMaps: false,
  webpack: (config, { isServer }) => {
    // Only apply this to server-side bundles
    if (isServer) {
      config.externals = config.externals || [];
      // Mark pdf-lib and @pdf-lib/fontkit as external modules
      // This prevents webpack from bundling them, forcing Node.js to resolve them from node_modules at runtime.
      // This often solves issues with global state or native bindings in serverless environments.
      config.externals.push('pdf-lib', '@pdf-lib/fontkit');
      // Also mark heavy ML libraries as external to avoid memory issues during build
      config.externals.push('@xenova/transformers', '@huggingface/transformers');
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: '/franchize/about',
        destination: '/franchize/vip-bike/about',
        permanent: false,
      },
      {
        source: '/franchize/contacts',
        destination: '/franchize/vip-bike/contacts',
        permanent: false,
      },
      {
        source: '/franchize/cart',
        destination: '/franchize/vip-bike/cart',
        permanent: false,
      },
      {
        source: '/franchize/order/:id',
        destination: '/franchize/vip-bike/order/:id',
        permanent: false,
      },
    ]
  },
}

mergeConfig(nextConfig, userConfig)

function mergeConfig(nextConfig, userConfig) {
  if (!userConfig) {
    return
  }

  for (const key in userConfig) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...userConfig[key],
      }
    } else {
      nextConfig[key] = userConfig[key]
    }
  }
}

export default nextConfig

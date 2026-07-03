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
  // Note: server-assets fonts are bundled automatically without explicit tracing
  // Disabled experimental features to reduce memory usage during build
  // Disable source maps in production to reduce memory usage
  productionBrowserSourceMaps: false,
  // Reduce memory usage during build
  swcMinify: false,
  experimental: {
    // Disable turbo for now to reduce memory
    turbo: undefined,
  },
  webpack: (config, { isServer }) => {
    // Reduce memory usage during build
    config.parallelism = parseInt(process.env.WEBPACK_PARALLELISM || '2', 10); // Vercel=2 (2-core), VPS=1 (Dockerfile sets WEBPACK_PARALLELISM=1)
    config.optimization = {
      ...config.optimization,
      minimize: false, // Skip minification to save memory
      splitChunks: false, // Disable code splitting
    };

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
  // Чистый URL: корень rental.vip-bike.ru отдаёт каталог аренды без /franchize/vip-bike в адресе.
  // beforeFiles — чтобы перебить файловый роут app/page.tsx (иначе rewrite не сработает).
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/franchize/vip-bike' },
      ],
    }
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

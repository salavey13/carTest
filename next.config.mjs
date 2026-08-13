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
  // I3 hotfix (C2): sharp is a native Node module — must be external so
  // webpack doesn't try to bundle sharp.node. Without this, the server action
  // uploadRentalPhoto (which imports sharp) fails at build/runtime with
  // "Module not found: Can't resolve …/build/Release/sharp.node".
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
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
      // I3 hotfix (C2): belt + suspenders — also push sharp to externals
      config.externals.push('sharp');
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
        { source: '/home', destination: '/franchize/vip-bike' },
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


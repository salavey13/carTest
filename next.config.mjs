let userConfig = undefined
try {
  userConfig = await import('./v0-user-next.config')
} catch (e) {
  // ignore error
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    // Ensure that 'server-assets' directory, containing fonts for PDF generation, is included in the serverless bundle.
    outputFileTracingIncludes: {
      '/': ['server-assets/**/*'], 
    },
  },
  webpack: (config, { isServer }) => {
    // Only apply this to server-side bundles
    if (isServer) {
      config.externals = config.externals || [];
      // Mark pdf-lib and @pdf-lib/fontkit as external modules
      // This prevents webpack from bundling them, forcing Node.js to resolve them from node_modules at runtime.
      // This often solves issues with global state or native bindings in serverless environments.
      config.externals.push('pdf-lib', '@pdf-lib/fontkit');
    }
    return config;
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
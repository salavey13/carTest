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
  // Build-memory: the standalone `next lint` gate (CI/dev) is the lint
  // enforcement point; running a second full ESLint pass inside `next build`
  // spiked peak heap for zero extra safety. Skip it → build fits a 4GB heap
  // (package.json runs node with --max-old-space-size=4096).
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Build-memory: cap the static-generation worker fan-out. On many-core build
  // boxes Next defaults to cores-1 workers, each holding its own module graph —
  // the main reason the build needed an 8GB heap before. 2 workers keeps peak
  // RSS flat with a modest SSG time cost.
  experimental: {
    cpus: 2,
    serverComponentsExternalPackages: ['sharp'],
  },
  images: {
    unoptimized: true,
  },
  // Note: server-assets fonts are bundled automatically without explicit tracing
  // Disabled experimental features to reduce memory usage during build
  // Disable source maps in production to reduce memory usage
  productionBrowserSourceMaps: false,
  webpack: (config, { dev, isServer }) => {
    // Build-memory: stop generating source maps entirely in production builds —
    // source-map bookkeeping on a graph this size is a multi-hundred-MB heap
    // line item, and browser maps were already disabled via
    // productionBrowserSourceMaps: false (nothing consumes prod maps here).
    if (!dev) {
      config.devtool = false;
    }
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
      // I12 hotfix: redirect the old /vipbikerental page → "/" so the new
      // landing page (app/page.tsx) is shown. This also fixes the back-button
      // trap: when a user navigates from /vipbikerental → /franchize/vip-bike
      // and hits browser Back, they'd land back on /vipbikerental (which
      // redirects to the landing). With the rewrite removed below, "/" now
      // renders the landing page directly.
      {
        source: '/vipbikerental',
        destination: '/',
        permanent: false,
      },
    ]
  },
  // I12 hotfix: REMOVED the beforeFiles rewrite { source: '/', destination: '/franchize/vip-bike' }.
  // Previously "/" was rewritten to the franchize catalog, which meant the
  // landing page (app/page.tsx) was never shown. Now "/" renders app/page.tsx
  // directly, and the landing page's CTA buttons link to /franchize/vip-bike.
  // The rewrites() function is intentionally omitted so no path overrides run
  // before filesystem/edge checks. If user-config (v0-user-next.config) adds
  // its own rewrites, they will still apply via the mergeConfig step below.
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

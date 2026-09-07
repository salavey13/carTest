let userConfig = undefined
try {
  userConfig = await import('./v0-user-next.config')
} catch (e) {
  // ignore error
}

import { createRequire } from 'module'
const require = createRequire(import.meta.url)

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Build-memory: the standalone `next lint` gate (CI/dev) is the lint
  // enforcement point; running a second full ESLint pass inside `next build`
  // spiked peak heap for zero extra safety. Skip it → build fits a 3GB heap
  // (package.json runs node with --max-old-space-size=3072).
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Build-memory: cap the static-generation worker fan-out. On many-core build
  // boxes Next defaults to cores-1 workers, each holding its own module graph —
  // the main reason the build needed an 8GB heap before. 1 worker + the main
  // thread serializes SSG (modest time cost) so the whole build fits a 3GB
  // heap / a 4GB container with OS headroom to spare.
  //
  // More 3GB-heap levers:
  // - serverComponentsExternalPackages: heavy server-only node libs stay in
  //   node_modules (required at runtime) instead of being bundled into every
  //   server compilation — thousands of modules never enter the webpack graph.
  //   All listed packages verified require()-safe (CJS or dual, no edge routes).
  //   ESM-only packages (node-fetch, z-ai-web-dev-sdk, @octokit/rest) must
  //   stay bundled — do NOT add them here.
  // - webpackBuildWorker: run each webpack compilation (server / edge / client)
  //   in its own child process that EXITS when done — the build orchestrator
  //   never holds a module graph, so compile memory returns to the OS before
  //   static generation starts. This is the single biggest 3GB-heap lever;
  //   Next auto-disables it when a custom webpack() fn exists, forcing it on
  //   explicitly is safe because everything the old hook did for memory is
  //   preserved via the options below (externals → serverComponentsExternal-
  //   Packages; prod source maps were already off; prod webpack cache is
  //   pointless when each compiler process exits).
  experimental: {
    cpus: 1,
    webpackBuildWorker: true,
    // SSG workers as child processes (not worker threads): their heap is
    // reaped by the OS when the worker exits instead of accumulating in the
    // parent process RSS — safer for small build containers.
    workerThreads: false,
    serverComponentsExternalPackages: [
      'sharp',
      'exceljs',
      'docx',
      'xlsx',
      'jszip',
      'adm-zip',
      'cheerio',
      'nodemailer',
      'pg',
      'jsonwebtoken',
      'googleapis',
      'fast-xml-parser',
      '@google/genai',
      // previously pushed to webpack config.externals — same effect here, and
      // this list survives even when the custom webpack() fn does not:
      'pdf-lib',
      '@pdf-lib/fontkit',
      '@xenova/transformers',
      '@huggingface/transformers',
    ],
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  images: {
    unoptimized: true,
  },
  // Note: server-assets fonts are bundled automatically without explicit tracing
  // Disabled experimental features to reduce memory usage during build
  // Disable source maps in production to reduce memory usage
  productionBrowserSourceMaps: false,
  webpack: (config, { dev, isServer }) => {
    // Build-memory: disable webpack cache in production. Next 14 enables a
    // filesystem-backed cache even for `next build`; the in-memory copy of the
    // whole module graph is retained until the NEXT compilation finishes, and
    // the IdleFileCachePlugin "stored" step serializes the pack on top of it —
    // together ~1GB of unreclaimable RSS right when the second (server)
    // compilation starts. With cache:false the client graph becomes garbage
    // between compilations and can actually be collected.
    if (!dev) {
      config.cache = false;
    }
    // TEMP build-memory instrumentation: log progress phase + RSS to file.
    // Enable with BUILD_MEM_DEBUG=1 (adds a ProgressPlugin that samples RSS).
    if (!dev && process.env.BUILD_MEM_DEBUG) {
      const fs = require('fs');
      const log = (line) => {
        try { fs.appendFileSync('/tmp/build-progress.log', line + '\n'); } catch (e) {}
      };
      const t0 = Date.now();
      const { ProgressPlugin } = require('webpack');
      config.plugins = config.plugins || [];
      config.plugins.push(new ProgressPlugin({
        activeModules: false,
        entries: true,
        modules: true,
        modulesCount: 1000,
        dependencies: true,
        dependenciesCount: 1000,
        percentBy: 'modules',
        handler: (percent, msg, ...details) => {
          const now = Date.now();
          if (now - (globalThis.__lastProg || 0) > 2000) {
            globalThis.__lastProg = now;
            const rss = (process.memoryUsage().rss / 1048576) | 0;
            const heap = (process.memoryUsage().heapUsed / 1048576) | 0;
            log(`${((now - t0) / 1000) | 0}s rss=${rss}MB heapUsed=${heap}MB ${(percent * 100) | 0}% ${msg} ${details.join(' ')}`);
          }
        },
      }));
    }
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

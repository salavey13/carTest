/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "mapbox-gl": "mapbox-gl/dist/mapbox-gl.js",
      }

      // Output the worker file to a known location
      config.output.filename = (pathData) => {
        return pathData.chunk.name === "embedding.worker"
          ? "static/chunks/[name].js"
          : "static/chunks/[name].[contenthash].js"
      }
    }
    return config
  },
}

module.exports = nextConfig


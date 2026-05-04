/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {

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


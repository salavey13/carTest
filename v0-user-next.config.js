/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "mapbox-gl": "mapbox-gl/dist/mapbox-gl.js",
    }
    return config
  },
}

module.exports = nextConfig


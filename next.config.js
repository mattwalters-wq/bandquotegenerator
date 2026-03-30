/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["jspdf"],
  },
};
module.exports = nextConfig;

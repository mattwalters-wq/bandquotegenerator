/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["jspdf", "@anthropic-ai/sdk"],
  },
};
module.exports = nextConfig;

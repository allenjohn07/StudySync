import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo root has its own package-lock.json (for `npm run dev` there); this app's root is this folder.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    agentUpgrade: "security",
  },
  // The link-preview images draw with Geist. The fonts are read from the `geist` package at
  // request time, so make sure the server bundle carries them (lib/og.tsx falls back to the
  // built-in face if they are ever missing).
  outputFileTracingIncludes: {
    "/opengraph-image": [
      "./node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
      "./node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf",
      "./node_modules/geist/dist/fonts/geist-sans/Geist-Bold.ttf",
    ],
    "/**/opengraph-image": [
      "./node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
      "./node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf",
      "./node_modules/geist/dist/fonts/geist-sans/Geist-Bold.ttf",
    ],
  },
};

export default nextConfig;

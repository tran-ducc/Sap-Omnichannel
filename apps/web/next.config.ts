import type { NextConfig } from "next";

/**
 * Deployed: set API_ORIGIN (e.g. https://sap-api.onrender.com) and NEXT_PUBLIC_API_URL=/api/v1.
 * The browser then calls the API on the web's own origin and Next forwards it, so the
 * refresh cookie stays first-party (browsers like Safari drop cross-site cookies).
 * Unset locally, where the web talks to localhost:4000 directly.
 */
const apiOrigin = process.env.API_ORIGIN?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return apiOrigin ? [{ source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` }] : [];
  },
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Placeholder photography (Unsplash licence). Replace with own photos before launch.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

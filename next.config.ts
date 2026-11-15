import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce .next/standalone for the single-container Docker deployment.
  output: "standalone",
  // Load better-sqlite3 as a native Node module instead of bundling it.
  serverExternalPackages: ["better-sqlite3"],
  // Ship the Drizzle migrations folder inside the standalone bundle so the
  // runtime migrator can find it at /app/drizzle in the container.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**"],
  },
};

export default nextConfig;

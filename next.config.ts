import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray lockfile elsewhere on the machine
  // doesn't get picked as the root (local dev only; Vercel is unaffected).
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
};

export default nextConfig;

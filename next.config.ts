import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

/* Two build modes:
   - default (Vercel): full Next.js app, incl. the /api/auth/kick OAuth routes.
   - BUILD_TARGET=export (GitHub Pages): static export to ./out. The Pages
     workflow removes src/app/api first (route handlers can't be statically
     exported) and sets PAGES_BASE_PATH=/ChickenWebsite for the repo subpath. */
const isExport = process.env.BUILD_TARGET === "export";
const basePath = process.env.PAGES_BASE_PATH || "";

const nextConfig: NextConfig = {
  // Inlined at build time; lets src/lib/assetPath.ts prefix public-asset URLs
  // (plain <img>/url() srcs don't get basePath applied automatically).
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
  ...(isExport
    ? {
        output: "export",
        basePath: basePath || undefined,
        assetPrefix: basePath || undefined,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;

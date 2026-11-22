import type { NextConfig } from "next";

// Static export (Step 3 of the Android port): `next build` emits a fully
// static site into ./out which the Express backend serves from ./public.
// Cloudflare/OpenNext collect-and-deploy paths are not used in the APK build.
const nextConfig: NextConfig = {
    output: "export",
    images: { unoptimized: true },
    reactCompiler: true,
    skipTrailingSlashRedirect: true,
};

export default nextConfig;

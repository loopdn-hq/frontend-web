import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a plain out/ directory of HTML, JS and CSS - the artifact copied to
  // S3. Replaces "standalone", which built a Node server instead.
  output: "export",
  // Static export has no Image Optimization server to hit.
  images: { unoptimized: true },
  // Each route becomes <route>/index.html, which the CloudFront function
  // rewrites directory requests onto.
  trailingSlash: true,
  // Hides the floating Next.js dev tools badge, which sits bottom-left by
  // default and overlaps the nav rail's profile row. Dev-only either way -
  // it is never part of the exported build. Compile and runtime errors are
  // still surfaced.
  devIndicators: false,
  // The commercial site is this same app served on a commercial.* host (see
  // src/lib/config/site.ts). Next 16 refuses dev-server requests from any
  // host but localhost unless it is listed here; dev-only either way.
  allowedDevOrigins: ["commercial.localhost"],
};

export default nextConfig;

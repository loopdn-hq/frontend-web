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
};

export default nextConfig;

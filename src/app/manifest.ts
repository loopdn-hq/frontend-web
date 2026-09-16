import type { MetadataRoute } from "next";

/**
 * The web app manifest, served at /manifest.webmanifest.
 *
 * It exists for one concrete reason: iPhone and iPad show web notifications
 * ONLY for a site that has been added to the Home Screen, and a site can only
 * be added if it has a manifest with `display: standalone` and an icon. Every
 * other browser gets push without this file; iOS does not.
 *
 * `dynamic = "force-static"` because this is a static export - the route is
 * written out at build time rather than answered by a server.
 *
 * Deployment note: the S3 sync gives every non-HTML file a one-year immutable
 * cache, so this file and /sw.js are re-synced with `no-cache` afterwards. See
 * .github/workflows/deploy-staging.yml.
 */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Loopd'n",
    short_name: "Loopd'n",
    description: "Group messaging that reaches everyone - app, text or email.",
    // Where an installed copy opens. The chats list rather than the marketing
    // page: somebody who installed the app is signed in and wants their Loops.
    start_url: "/chats/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Android draws its own shape around this one, so it must tolerate
        // being cropped to a circle.
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

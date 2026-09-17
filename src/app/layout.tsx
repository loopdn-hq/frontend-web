import type { Metadata } from "next";
import { Public_Sans, Space_Mono } from "next/font/google";
import { GoogleOAuthProvider } from "@react-oauth/google";
import type { ReactNode } from "react";
import { appearanceInitScript } from "@/lib/app/appearanceOptions";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import "./globals.css";

// Public Sans is a variable font, so no `weight` list: every weight the UI
// asks for comes from the one file rather than a request each.
const sans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const mono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Loopd'n",
  description: "Loopd'n: The group chat where everyone stays connected.",
  // Installable, which on iPhone and iPad is the ONLY way web notifications
  // are shown at all: Safari delivers push to a site added to the Home
  // Screen and to no other. See src/app/manifest.ts.
  manifest: "/manifest.webmanifest",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Loopd'n", statusBarStyle: "default" },
};

// Applies the saved theme before hydration to avoid a light/dark flash.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("loopdn_theme") || "system";
    var resolved = stored === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : stored;
    if (resolved === "dark") document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: appearanceInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <GoogleOAuthProvider
          clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""}
        >
          <ThemeProvider>{children}</ThemeProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import "./globals.css";

const sans = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const mono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Loopdn Auth",
  description: "Loopdn web authentication MVP",
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
        {/* Sign In With Google's Identity Services client, used by AuthScreen. */}
        <Script src="https://accounts.google.com/gsi/client" async defer />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

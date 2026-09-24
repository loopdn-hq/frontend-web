"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import {
  DESKTOP_INSTALLERS,
  detectDesktopOs,
  type DesktopOs,
} from "@/lib/config/downloads";

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M17.05 12.53c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.81 3.15-.46 7.81 1.3 10.36.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.38.81 1.4-.02 2.28-1.27 3.13-2.53.99-1.45 1.4-2.86 1.42-2.93-.03-.01-2.72-1.04-2.75-4.14M14.5 4.76c.71-.87 1.2-2.07 1.07-3.27-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 2-1.08 3.17 1.15.09 2.32-.58 3.03-1.45" />
    </svg>
  );
}

function WindowsLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M3 5.56 10.27 4.5v6.99H3zm0 12.88 7.27 1.06v-6.9H3zM11.13 19.63 21 21V12.5h-9.87zM11.13 4.37v7.12H21V3z" />
    </svg>
  );
}

/** The dashed arrow and note pointing at the screenshot, as in the design. */
function DesktopNote() {
  return (
    <div className="pointer-events-none absolute -top-2 right-2 hidden w-[230px] xl:block">
      <p className="text-right text-[17px] leading-[1.5] font-medium text-[#2f6eb2] italic dark:text-[#8fc6ff]">
        Get the full
        <br />
        Loopd&apos;n experience
        <br />
        on desktop
      </p>
      <svg
        viewBox="0 0 90 60"
        aria-hidden
        className="mt-1 h-14 w-20 text-[#2f6eb2] dark:text-[#8fc6ff]"
      >
        <path
          d="M84 4C64 6 30 14 14 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M6 52c1-7 3-11 5-14M6 52c7-2 11-3 15-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

const subscribeToNothing = () => () => {};

export function DownloadHero() {
  // Read after hydration rather than during render: the page is statically
  // exported, so branching on navigator while rendering would not match the
  // HTML on disk. The server snapshot is null, which is also what a visitor on
  // a phone or on Linux gets.
  const detectedOs = useSyncExternalStore<DesktopOs | null>(
    subscribeToNothing,
    detectDesktopOs,
    () => null,
  );

  // Before detection resolves - and on a phone, where neither installer runs -
  // the primary button still has to lead somewhere, so it offers the Mac build
  // and both platform buttons sit right beneath it.
  const primary = DESKTOP_INSTALLERS[detectedOs ?? "mac"];

  return (
    <section className="relative w-full overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,#ecf7ff_0%,#d9efff_100%)] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.12)] dark:bg-[linear-gradient(180deg,#102a73_0%,#0a1f5a_100%)] dark:shadow-[0_18px_50px_rgba(2,13,45,0.3)] sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_92%,rgba(197,235,255,0.95)_0%,rgba(125,199,255,0.5)_36%,rgba(76,158,245,0.08)_62%,rgba(76,158,245,0)_75%)] dark:hidden" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(160,224,255,0)_35%,rgba(103,190,255,0.82)_50%,rgba(160,224,255,0)_64%)] dark:hidden" />

      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_18%_96%,rgba(255,255,255,0.72)_0%,rgba(145,221,255,0.45)_24%,rgba(77,177,255,0.18)_40%,rgba(24,80,170,0)_66%)] dark:block" />
      <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(136deg,rgba(122,212,255,0)_36%,rgba(182,237,255,0.8)_50%,rgba(122,212,255,0)_63%)] dark:block" />

      <DesktopNote />

      <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] lg:gap-10">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#67b8ff]/60 bg-[#eff7ffcc] px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-[#2c6db6] uppercase dark:border-[#5cb8ff]/45 dark:bg-[#0a2e74]/65 dark:text-[#9fd7ff]">
            Stay Connected
          </p>

          <h1 className="mt-7 text-4xl leading-[1.15] font-semibold tracking-[-0.02em] text-[#0b2558] dark:text-white sm:text-5xl lg:text-[52px]">
            One Connected Group.
            <br />
            <span className="text-[#2c62d6] dark:text-[#7db4ff]">
              Every Way To Connect.
            </span>
          </h1>

          <p className="mt-6 max-w-[500px] text-[17px] leading-8 text-[#3a6aa6] dark:text-[#E1ECFA]">
            <span className="font-semibold text-[#1d3f7f] dark:text-white">
              Loopd&apos;n
            </span>{" "}
            brings your people, plans, and conversations together in one place.
            Message, share, make plans, and stay close &mdash; whether
            you&apos;re with family, friends, a club, or your community.
          </p>

          <div className="mt-9 flex flex-col gap-3">
            <a
              href={primary.url}
              className="inline-flex h-14 w-full max-w-[420px] items-center justify-center gap-3 rounded-[12px] bg-[linear-gradient(180deg,#3f7bf0_0%,#2048a4_100%)] px-6 text-[17px] font-semibold text-[#eef5ff] shadow-[0_12px_30px_rgba(2,11,42,0.4)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2048a4] focus-visible:ring-offset-2 dark:focus-visible:ring-[#7db4ff] dark:focus-visible:ring-offset-[#0a1f5a]"
            >
              <Download aria-hidden className="h-5 w-5" />
              Download for Desktop
            </a>

            <div className="flex max-w-[420px] flex-col gap-3 sm:flex-row">
              {(["mac", "windows"] as const).map((os) => {
                const installer = DESKTOP_INSTALLERS[os];
                const Logo = os === "mac" ? AppleLogo : WindowsLogo;
                const isDetected = detectedOs === os;

                return (
                  <a
                    key={os}
                    href={installer.url}
                    className={`inline-flex h-12 flex-1 items-center justify-center gap-2.5 rounded-[10px] border bg-white px-5 text-[15px] font-semibold text-[#0d336f] shadow-[0_8px_20px_rgba(95,144,206,0.18)] transition hover:bg-[#f4faff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2048a4] focus-visible:ring-offset-2 dark:bg-[#0a2a72] dark:text-[#ecf4ff] dark:hover:bg-[#113785] dark:focus-visible:ring-[#7db4ff] dark:focus-visible:ring-offset-[#0a1f5a] ${
                      isDetected
                        ? "border-[#2c62d6] dark:border-[#7db4ff]"
                        : "border-[#8cb6ff]/60 dark:border-[#8cb6ff]/40"
                    }`}
                  >
                    <Logo className="h-[18px] w-[18px]" />
                    {installer.label}
                    {isDetected && (
                      <span className="text-[11px] font-medium text-[#3a6aa6] dark:text-[#9fd7ff]">
                        (yours)
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>

          <p className="mt-4 text-[13px] text-[#4f73a8] dark:text-[#8aaedf]">
            Free to download &nbsp;&middot;&nbsp; Works on macOS and Windows
            &nbsp;&middot;&nbsp; Always in sync
          </p>
        </div>

        <div className="w-full">
          <div className="relative mx-auto w-full max-w-[760px] overflow-hidden rounded-[14px] shadow-[0_22px_60px_rgba(11,35,95,0.28)] lg:mx-0">
            <Image
              src="/Loopdn_chat_image.png"
              alt="The Loopd'n desktop app showing a group conversation"
              width={1677}
              height={938}
              priority
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

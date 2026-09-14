"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { displayNameForSession, useAuth } from "@/lib/auth/client";

export default function RootPage() {
  const { session } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isDark = isMounted && resolvedTheme === "dark";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#071d5c] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_100%,#9fddf4_0%,#4bb9f3_20%,rgba(23,132,246,0.45)_35%,rgba(10,37,111,0.1)_52%,rgba(7,29,92,0)_65%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(136deg,rgba(6,36,114,0)_41%,rgba(106,222,255,0.88)_50%,rgba(6,36,114,0)_59%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#0a256f_0%,#061a54_100%)] opacity-95" />

      <header className="relative z-10 mx-auto w-full max-w-[1320px] px-4 pt-5 sm:px-8">
        <div className="flex min-h-[62px] items-center justify-between gap-4 rounded-2xl border border-[#89beff]/20 bg-[#092565]/70 px-4 shadow-[0_8px_30px_rgba(6,18,57,0.35)] backdrop-blur-sm sm:px-6">
          <Link href="/" className="shrink-0 transition hover:opacity-90">
            <Image
              src="/home-logo.png"
              alt="Loopd'n"
              width={115}
              height={26}
              priority
              className="h-auto w-[94px] sm:w-[108px]"
            />
          </Link>

          <nav className="hidden items-center gap-8 text-[14px] font-medium text-[#d8e6ff] lg:flex">
            <a href="#how-it-works" className="transition hover:text-white">
              How It Works
            </a>
            <a href="#who-its-for" className="transition hover:text-white">
              Who It&apos;s For
            </a>
            <Link href="/pricing/" className="transition hover:text-white">
              Pricing
            </Link>
            <a href="#groupme-alt" className="transition hover:text-white">
              GroupMe Alternative
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-[#7db4ff]/30 bg-[#0b2f7b]/80 p-1">
              <button
                type="button"
                onClick={() => setTheme("light")}
                aria-label="Enable light mode"
                className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                  !isDark
                    ? "bg-[#1a4da6] shadow-[inset_0_0_0_1px_rgba(146,196,255,0.45)]"
                    : "hover:bg-[#144192]"
                }`}
              >
                <Image src="/light-mode.svg" alt="" width={16} height={16} />
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                aria-label="Enable dark mode"
                className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                  isDark
                    ? "bg-[#1a4da6] shadow-[inset_0_0_0_1px_rgba(146,196,255,0.45)]"
                    : "hover:bg-[#144192]"
                }`}
              >
                <Image src="/dark-mode.svg" alt="" width={16} height={16} />
              </button>
            </div>

            {session ? (
              <Link
                href="/chats/"
                className="rounded-xl bg-[linear-gradient(180deg,#95b9ff_0%,#6e97f6_100%)] px-4 py-2 text-sm font-semibold text-[#052364] shadow-[0_10px_22px_rgba(74,126,255,0.33)]"
              >
                {displayNameForSession(session)}
              </Link>
            ) : (
              <>
                <Link
                  href="/signup/"
                  className="rounded-xl bg-[linear-gradient(180deg,#95b9ff_0%,#6e97f6_100%)] px-4 py-2 text-sm font-semibold text-[#052364] shadow-[0_10px_22px_rgba(74,126,255,0.33)]"
                >
                  Sign Up
                </Link>
                <Link
                  href="/login/"
                  className="rounded-xl border border-[#8cb6ff]/40 bg-[#0a2a72] px-4 py-2 text-sm font-semibold text-[#ecf4ff] transition hover:bg-[#113785]"
                >
                  Log In
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1320px] flex-col items-center px-4 pb-16 pt-14 sm:px-8 lg:flex-row lg:items-start lg:pt-20">
        <section className="w-full max-w-[580px] lg:pt-16">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#5cb8ff]/45 bg-[#0a2e74]/65 px-3 py-1 text-[11px] font-medium text-[#9fd7ff]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3bd1ff]" />
            Free to start. No app required.
          </p>

          <h1 className="mt-7 text-4xl leading-[1.15] font-semibold tracking-[-0.02em] text-[#b2d8ff] sm:text-5xl lg:text-[56px]">
            One Connected Group.
            <br />
            Every Way To Connect.
          </h1>

          <p className="mt-6 max-w-[530px] text-[17px] leading-8 text-[#8cb5e7]">
            Bring your family, community, or team into one shared conversation
            where everyone can connect through SMS, web, or voice, without
            needing to use the same app.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup/"
              className="inline-flex h-12 items-center justify-center rounded-[10px] bg-[linear-gradient(180deg,#2048a4_0%,#142f78_100%)] px-6 text-[15px] font-semibold text-[#eef5ff] shadow-[0_12px_30px_rgba(2,11,42,0.4)]"
            >
              Create Your Loopd&apos;n →
            </Link>
            <p className="inline-flex h-12 items-center justify-center rounded-[10px] border border-[#5ba8ef]/60 bg-[#58b9ff26] px-5 text-[15px] font-medium text-[#9fd7ff]">
              No credit card required
            </p>
          </div>
        </section>

        <section className="mt-12 w-full lg:mt-0 lg:flex lg:justify-end">
          <div className="relative mx-auto w-full max-w-[760px] lg:mx-0">
            <Image
              src="/hero-image.png"
              alt="Loopd'n app chat preview"
              width={760}
              height={560}
              priority
              className="h-auto w-full"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

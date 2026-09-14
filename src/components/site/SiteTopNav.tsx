"use client";

import Image from "next/image";
import Link from "next/link";
import { displayNameForSession, useAuth } from "@/lib/auth/client";
import { useTheme } from "@/lib/theme/ThemeProvider";

export function SiteTopNav() {
  const { session } = useAuth();
  const { setTheme } = useTheme();

  return (
    <header className="relative z-10 mx-auto w-full max-w-[1440px] px-4 pt-5 sm:px-8">
      <div className="flex min-h-[62px] items-center justify-between gap-4 rounded-2xl border border-[#9bc8ff]/70 bg-[#f3f9ff]/80 px-4 shadow-[0_8px_30px_rgba(76,126,190,0.25)] backdrop-blur-sm dark:border-[#89beff]/20 dark:bg-[#092565]/70 dark:shadow-[0_8px_30px_rgba(6,18,57,0.35)] sm:px-6">
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

        <nav className="hidden items-center gap-8 text-[14px] font-medium text-[#29518c] dark:text-[#d8e6ff] lg:flex">
          <Link
            href="/#how-it-works"
            className="transition hover:text-[#0d2d68] dark:hover:text-white"
          >
            How It Works
          </Link>
          <Link
            href="/#who-its-for"
            className="transition hover:text-[#0d2d68] dark:hover:text-white"
          >
            Who It&apos;s For
          </Link>
          <Link
            href="/pricing/"
            className="transition hover:text-[#0d2d68] dark:hover:text-white"
          >
            Pricing
          </Link>
          <Link
            href="/#groupme-alt"
            className="transition hover:text-[#0d2d68] dark:hover:text-white"
          >
            GroupMe Alternative
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[#9ac3f5]/80 bg-[#e4f1ff] p-1 dark:border-[#7db4ff]/30 dark:bg-[#0b2f7b]/80">
            <button
              type="button"
              onClick={() => setTheme("light")}
              aria-label="Enable light mode"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-[#d6eaff] shadow-[inset_0_0_0_1px_rgba(54,114,192,0.35)] transition hover:bg-[#d0e6ff] dark:bg-transparent dark:shadow-none dark:hover:bg-[#144192]"
            >
              <Image src="/light-mode.svg" alt="" width={16} height={16} />
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              aria-label="Enable dark mode"
              className="flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[#d0e6ff] dark:bg-[#1a4da6] dark:shadow-[inset_0_0_0_1px_rgba(146,196,255,0.45)] dark:hover:bg-[#144192]"
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
                className="rounded-xl border border-[#8cb6ff]/60 bg-[#ffffffb3] px-4 py-2 text-sm font-semibold text-[#0d336f] transition hover:bg-white dark:border-[#8cb6ff]/40 dark:bg-[#0a2a72] dark:text-[#ecf4ff] dark:hover:bg-[#113785]"
              >
                Log In
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

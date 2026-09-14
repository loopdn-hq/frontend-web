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

  function StatusIcon({ ok }: { ok: boolean }) {
    return ok ? (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
        <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
          <path
            d="M5 12.5 9.2 16.7 19 6.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    ) : (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/15 text-rose-500">
        <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
          <path
            d="M7 7 17 17M17 7 7 17"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eaf4ff] text-[#0b2558] transition-colors dark:bg-[#071d5c] dark:text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_100%,#c8ecff_0%,#84d3ff_24%,rgba(95,181,255,0.42)_44%,rgba(127,187,255,0)_69%)] dark:hidden" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(223,243,255,0)_34%,rgba(151,223,255,0.86)_50%,rgba(223,243,255,0)_65%)] dark:hidden" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#f3faff_0%,#d4ecff_100%)] dark:hidden" />

      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_10%_100%,#9fddf4_0%,#4bb9f3_20%,rgba(23,132,246,0.45)_35%,rgba(10,37,111,0.1)_52%,rgba(7,29,92,0)_65%)] dark:block" />
      <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(136deg,rgba(6,36,114,0)_41%,rgba(106,222,255,0.88)_50%,rgba(6,36,114,0)_59%)] dark:block" />
      <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(180deg,#0a256f_0%,#061a54_100%)] opacity-95 dark:block" />

      <header className="relative z-10 mx-auto w-full max-w-[1320px] px-4 pt-5 sm:px-8">
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
            <a
              href="#how-it-works"
              className="transition hover:text-[#0d2d68] dark:hover:text-white"
            >
              How It Works
            </a>
            <a
              href="#who-its-for"
              className="transition hover:text-[#0d2d68] dark:hover:text-white"
            >
              Who It&apos;s For
            </a>
            <Link
              href="/pricing/"
              className="transition hover:text-[#0d2d68] dark:hover:text-white"
            >
              Pricing
            </Link>
            <a
              href="#groupme-alt"
              className="transition hover:text-[#0d2d68] dark:hover:text-white"
            >
              GroupMe Alternative
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-[#9ac3f5]/80 bg-[#e4f1ff] p-1 dark:border-[#7db4ff]/30 dark:bg-[#0b2f7b]/80">
              <button
                type="button"
                onClick={() => setTheme("light")}
                aria-label="Enable light mode"
                className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                  !isDark
                    ? "bg-[#d6eaff] shadow-[inset_0_0_0_1px_rgba(54,114,192,0.35)]"
                    : "hover:bg-[#d0e6ff] dark:hover:bg-[#144192]"
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
                    : "hover:bg-[#d0e6ff] dark:hover:bg-[#144192]"
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
                  className="rounded-xl border border-[#8cb6ff]/60 bg-[#ffffffb3] px-4 py-2 text-sm font-semibold text-[#0d336f] transition hover:bg-white dark:border-[#8cb6ff]/40 dark:bg-[#0a2a72] dark:text-[#ecf4ff] dark:hover:bg-[#113785]"
                >
                  Log In
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1320px] flex-col items-center px-4 pb-16 pt-14 sm:px-8 lg:items-start lg:pt-20">
        <section className="w-full rounded-[18px] border border-[#b7d7ff]/60 bg-[#edf7ff80] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.12)] dark:border-[#1d4b95]/70 dark:bg-[#0a2a72]/35 dark:shadow-[0_18px_50px_rgba(2,13,45,0.3)] sm:p-7">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-10">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#67b8ff]/60 bg-[#eff7ffcc] px-3 py-1 text-[11px] font-medium text-[#2c6db6] dark:border-[#5cb8ff]/45 dark:bg-[#0a2e74]/65 dark:text-[#9fd7ff]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1a8cff] dark:bg-[#3bd1ff]" />
                Free to start. No app required.
              </p>

              <h1 className="mt-7 text-4xl leading-[1.15] font-semibold tracking-[-0.02em] text-[#1d3f7f] dark:text-[#b2d8ff] sm:text-5xl lg:text-[56px]">
                One Connected Group.
                <br />
                Every Way To Connect.
              </h1>

              <p className="mt-6 max-w-[530px] text-[17px] leading-8 text-[#3a6aa6] dark:text-[#8cb5e7]">
                Bring your family, community, or team into one shared
                conversation where everyone can connect through SMS, web, or
                voice, without needing to use the same app.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/signup/"
                  className="inline-flex h-12 items-center justify-center rounded-[10px] bg-[linear-gradient(180deg,#2048a4_0%,#142f78_100%)] px-6 text-[15px] font-semibold text-[#eef5ff] shadow-[0_12px_30px_rgba(2,11,42,0.4)]"
                >
                  Create Your Loopd&apos;n →
                </Link>
                <p className="inline-flex h-12 items-center justify-center rounded-[10px] border border-[#5ba8ef]/60 bg-[#7dc6ff2e] px-5 text-[15px] font-medium text-[#2f6eb2] dark:bg-[#58b9ff26] dark:text-[#9fd7ff]">
                  No credit card required
                </p>
              </div>
            </div>

            <div className="w-full">
              <div className="relative mx-auto w-full max-w-[760px] lg:mx-0">
                <Image
                  src="/hero-image.png"
                  alt="Loopd'n app chat preview"
                  width={760}
                  height={560}
                  priority
                  className="h-auto w-full opacity-95 dark:opacity-100"
                />
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="mt-18 w-full rounded-[18px] border border-[#b7d7ff]/70 bg-[#edf7ffb0] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.18)] dark:border-[#1d4b95] dark:bg-[#0a2a72]/55 dark:shadow-[0_18px_50px_rgba(2,13,45,0.4)] sm:p-6 lg:mt-24 w-full"
        >
          <p className="inline-flex rounded-full border border-[#7ab8ff]/70 bg-[#cfe7ff] px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-[#23528a] uppercase dark:border-[#3a76d2]/80 dark:bg-[#11408d] dark:text-[#b7d9ff]">
            How It Works
          </p>
          <h2 className="mt-3 text-2xl leading-tight font-semibold text-[#173a75] dark:text-[#d6e8ff] sm:text-[32px]">
            Three simple steps.
            <br />
            Everyone stays in the loop.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#3f679a] dark:text-[#86afe4]">
            Create your Loopdn, invite your people, and bring everyone into one
            shared conversation, whether they text, call, or use the web.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <article className="overflow-hidden rounded-xl border border-[#9ecbff]/80 bg-[#f4faff] shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)]">
              <Image
                src="/step-1.png"
                alt="Step 1: Create your Loopdn"
                width={420}
                height={280}
                className="h-auto w-full"
              />
            </article>
            <article className="overflow-hidden rounded-xl border border-[#9ecbff]/80 bg-[#f4faff] shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)]">
              <Image
                src="/step-2.png"
                alt="Step 2: Invite your people"
                width={420}
                height={280}
                className="h-auto w-full"
              />
            </article>
            <article className="overflow-hidden rounded-xl border border-[#9ecbff]/80 bg-[#f4faff] shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)]">
              <Image
                src="/step-3.png"
                alt="Step 3: Everyone connects"
                width={420}
                height={280}
                className="h-auto w-full"
              />
            </article>
          </div>
        </section>

        <section
          id="connect-your-way"
          className="mt-8 w-full rounded-[18px] border border-[#b7d7ff]/70 bg-[#edf7ffb0] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.18)] dark:border-[#1d4b95] dark:bg-[#0a2a72]/55 dark:shadow-[0_18px_50px_rgba(2,13,45,0.4)] sm:p-6"
        >
          <p className="inline-flex rounded-full border border-[#7ab8ff]/70 bg-[#cfe7ff] px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-[#23528a] uppercase dark:border-[#3a76d2]/80 dark:bg-[#11408d] dark:text-[#b7d9ff]">
            Everyone Connects Their Way
          </p>
          <h2 className="mt-3 text-2xl leading-tight font-semibold text-[#173a75] dark:text-[#d6e8ff] sm:text-[32px]">
            One Group. Every way
            <br />
            to stay connected.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#3f679a] dark:text-[#86afe4]">
            Loopdn brings SMS, web, and voice together so everyone can stay
            connected without needing to use the same app.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <article className="overflow-hidden rounded-xl border border-[#9ecbff]/80 bg-[#f4faff] shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)]">
              <Image
                src="/connected-by-text.png"
                alt="Stay connected by text"
                width={640}
                height={420}
                className="h-auto w-full"
              />
            </article>

            <div className="grid gap-4">
              <article className="overflow-hidden rounded-xl border border-[#9ecbff]/80 bg-[#f4faff] shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)]">
                <Image
                  src="/shared-space-for-all.png"
                  alt="A shared space for everyone"
                  width={540}
                  height={220}
                  className="h-auto w-full"
                />
              </article>
              <article className="overflow-hidden rounded-xl border border-[#9ecbff]/80 bg-[#f4faff] shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)]">
                <Image
                  src="/connect-with-your-voice.png"
                  alt="Connect with your voice"
                  width={540}
                  height={220}
                  className="h-auto w-full"
                />
              </article>
            </div>
          </div>
        </section>

        <section
          id="who-its-for"
          className="mt-8 w-full rounded-[18px] border border-[#b7d7ff]/70 bg-[#edf7ffb0] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.18)] dark:border-[#1d4b95] dark:bg-[#0a2a72]/55 dark:shadow-[0_18px_50px_rgba(2,13,45,0.4)] sm:p-6"
        >
          <p className="inline-flex rounded-full border border-[#7ab8ff]/70 bg-[#cfe7ff] px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-[#23528a] uppercase dark:border-[#3a76d2]/80 dark:bg-[#11408d] dark:text-[#b7d9ff]">
            Who It&apos;s For
          </p>
          <h2 className="mt-3 text-2xl leading-tight font-semibold text-[#173a75] dark:text-[#d6e8ff] sm:text-[32px]">
            Made for the people
            <br />
            you need to reach.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#3f679a] dark:text-[#86afe4]">
            From family and friends to communities and organizations, Loopdn
            brings everyone into one shared space no matter how they connect.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <article className="overflow-hidden rounded-xl border border-[#9ecbff]/80 bg-[#f4faff] shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)]">
              <Image
                src="/families-and-friends.png"
                alt="Families and friends"
                width={420}
                height={280}
                className="h-auto w-full"
              />
            </article>
            <article className="overflow-hidden rounded-xl border border-[#9ecbff]/80 bg-[#f4faff] shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)]">
              <Image
                src="/communities.png"
                alt="Communities"
                width={420}
                height={280}
                className="h-auto w-full"
              />
            </article>
            <article className="overflow-hidden rounded-xl border border-[#9ecbff]/80 bg-[#f4faff] shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)]">
              <Image
                src="/organizations.png"
                alt="Organizations"
                width={420}
                height={280}
                className="h-auto w-full"
              />
            </article>
          </div>
        </section>

        <section
          id="groupme-alt"
          className="mt-8 w-full rounded-[18px] border border-[#b7d7ff]/70 bg-[#edf7ffb0] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.18)] dark:border-[#1d4b95] dark:bg-[#0a2a72]/55 dark:shadow-[0_18px_50px_rgba(2,13,45,0.4)] sm:p-6"
        >
          <p className="inline-flex rounded-full border border-[#7ab8ff]/70 bg-[#cfe7ff] px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-[#23528a] uppercase dark:border-[#3a76d2]/80 dark:bg-[#11408d] dark:text-[#b7d9ff]">
            GroupMe Alternative
          </p>
          <h2 className="mt-3 text-2xl leading-tight font-semibold text-[#173a75] dark:text-[#d6e8ff] sm:text-[32px]">
            A Better Way to Keep
            <br />
            Everyone Connected.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#3f679a] dark:text-[#86afe4]">
            Stay connected through SMS, web, or voice without requiring everyone
            to use the same app.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[#9ecbff]/80 bg-[#f4faff] p-4 shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)] sm:p-5">
            <div className="grid grid-cols-[1.7fr_.9fr_.9fr] items-center gap-3 border-b border-[#b7d6ff] pb-3 dark:border-[#2f63b6]">
              <p className="text-xs font-semibold tracking-[0.08em] text-[#2f5f99] uppercase dark:text-[#9bc2f2]">
                Feature
              </p>
              <div className="flex items-center justify-center rounded-lg bg-[#1c4ca6] px-2 py-2 text-xs font-semibold text-white">
                <Image
                  src="/home-logo.png"
                  alt="Loopd'n"
                  width={80}
                  height={18}
                  className="h-auto w-[72px]"
                />
              </div>
              <div className="flex items-center justify-center rounded-lg border border-[#b7d6ff] bg-[#ebf5ff] px-2 py-2 dark:border-[#2f63b6] dark:bg-[#0f356f]">
                <Image
                  src="/groupme.png"
                  alt="GroupMe"
                  width={100}
                  height={24}
                  className="h-auto w-[72px]"
                />
              </div>
            </div>

            <div className="divide-y divide-[#c5defb] dark:divide-[#2f63b6]">
              <div className="grid grid-cols-[1.7fr_.9fr_.9fr] items-center gap-3 py-2.5 text-sm">
                <p className="text-[#2f5f99] dark:text-[#9bc2f2]">
                  No app required
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok />
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok={false} />
                </p>
              </div>
              <div className="grid grid-cols-[1.7fr_.9fr_.9fr] items-center gap-3 py-2.5 text-sm">
                <p className="text-[#2f5f99] dark:text-[#9bc2f2]">
                  Join by SMS
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok />
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok={false} />
                </p>
              </div>
              <div className="grid grid-cols-[1.7fr_.9fr_.9fr] items-center gap-3 py-2.5 text-sm">
                <p className="text-[#2f5f99] dark:text-[#9bc2f2]">
                  Works with any phone
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok />
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok={false} />
                </p>
              </div>
              <div className="grid grid-cols-[1.7fr_.9fr_.9fr] items-center gap-3 py-2.5 text-sm">
                <p className="text-[#2f5f99] dark:text-[#9bc2f2]">
                  Web + SMS + Voice
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok />
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok={false} />
                </p>
              </div>
              <div className="grid grid-cols-[1.7fr_.9fr_.9fr] items-center gap-3 py-2.5 text-sm">
                <p className="text-[#2f5f99] dark:text-[#9bc2f2]">
                  Admin broadcast mode
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok />
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok={false} />
                </p>
              </div>
              <div className="grid grid-cols-[1.7fr_.9fr_.9fr] items-center gap-3 py-2.5 text-sm">
                <p className="text-[#2f5f99] dark:text-[#9bc2f2]">
                  Voice messaging
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok />
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok />
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="mt-8 w-full rounded-[18px] border border-[#b7d7ff]/70 bg-[#edf7ffb0] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.18)] dark:border-[#1d4b95] dark:bg-[#0a2a72]/55 dark:shadow-[0_18px_50px_rgba(2,13,45,0.4)] sm:p-6"
        >
          <p className="inline-flex rounded-full border border-[#7ab8ff]/70 bg-[#cfe7ff] px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-[#23528a] uppercase dark:border-[#3a76d2]/80 dark:bg-[#11408d] dark:text-[#b7d9ff]">
            Pricing
          </p>
          <h2 className="mt-3 text-2xl leading-tight font-semibold text-[#173a75] dark:text-[#d6e8ff] sm:text-[32px]">
            Start Free. Stay Connected.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#3f679a] dark:text-[#86afe4]">
            Choose Loopdn&apos;s free tier and keep your core members connected
            through SMS, web, and voice.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
            <article className="rounded-2xl border border-[#91bfff] bg-[linear-gradient(140deg,#1d4ba5_0%,#0f2f78_55%,#1c58bc_100%)] p-5 text-white shadow-[0_12px_28px_rgba(9,35,92,0.35)]">
              <span className="inline-flex rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase">
                Free Tier
              </span>
              <p className="mt-3 text-5xl font-semibold leading-none">$0</p>
              <p className="mt-2 text-lg font-semibold">The Free Loop</p>
              <p className="mt-2 max-w-xs text-sm text-[#d5e7ff]">
                Designed for growing groups and day-to-day coordination.
              </p>
              <Link
                href="/signup/"
                className="mt-5 inline-flex h-10 items-center justify-center rounded-[10px] border border-white/35 bg-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/25"
              >
                Create Your Loopd&apos;n →
              </Link>
            </article>

            <article className="rounded-2xl border border-[#9ecbff]/80 bg-[#f4faff] p-5 shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)]">
              <h3 className="text-lg font-semibold text-[#173a75] dark:text-[#d6e8ff]">
                Included
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-[#345f97] dark:text-[#9bc2f2]">
                <li>Up to 50 members</li>
                <li>SMS + Web + Voice connection</li>
                <li>Voice messaging</li>
                <li>Group chat and broadcast mode</li>
                <li>Activity and delivery insights</li>
                <li>Admin approvals and join controls</li>
                <li>No credit card required</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="mt-8 w-full overflow-hidden rounded-[22px] border border-[#89beff]/35 bg-[linear-gradient(130deg,#194a9f_0%,#0d2e7a_34%,#53c5ff_100%)] px-6 py-12 text-center shadow-[0_20px_46px_rgba(11,35,95,0.35)] sm:px-10">
          <h2 className="text-2xl font-semibold text-[#eaf4ff] sm:text-[34px]">
            Bring Everyone Into The Loop.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[#d6e8ff] sm:text-base">
            Build a group where everyone can stay connected through SMS, web,
            and voice from one shared space.
          </p>
          <Link
            href="/signup/"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-[10px] bg-white px-6 text-sm font-semibold text-[#123a86] shadow-[0_10px_22px_rgba(11,32,78,0.35)] transition hover:bg-[#eaf4ff]"
          >
            Create Your Loopd&apos;n →
          </Link>
        </section>
      </main>

      <footer className="relative z-10 mx-auto mt-10 w-full max-w-[1320px] border-t border-[#96c5ff]/35 px-4 pb-10 pt-8 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <Image
              src="/home-logo.png"
              alt="Loopd'n"
              width={115}
              height={26}
              className="h-auto w-[108px]"
            />
            <p className="mt-4 max-w-md text-xs leading-6 text-[#3e669c] dark:text-[#87afe3]">
              Loopdn keeps groups connected through SMS, voice, and web in one
              shared conversation everyone can access.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#173a75] dark:text-[#d6e8ff]">
              Product
            </p>
            <div className="mt-3 space-y-2 text-sm text-[#3e669c] dark:text-[#87afe3]">
              <Link href="#how-it-works" className="block hover:underline">
                How It Works
              </Link>
              <Link href="#pricing" className="block hover:underline">
                Pricing
              </Link>
              <Link href="#groupme-alt" className="block hover:underline">
                GroupMe Alternative
              </Link>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#173a75] dark:text-[#d6e8ff]">
              Company
            </p>
            <div className="mt-3 space-y-2 text-sm text-[#3e669c] dark:text-[#87afe3]">
              <Link href="/contact/" className="block hover:underline">
                Contact
              </Link>
              <Link href="/privacy/" className="block hover:underline">
                Privacy
              </Link>
              <Link href="/terms/" className="block hover:underline">
                Terms &amp; Conditions
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-[#96c5ff]/30 pt-4 text-[11px] text-[#4f73a8] dark:text-[#8aaedf] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Loopd&apos;n. All rights reserved.</p>
          <p>Built to keep every group connected.</p>
        </div>
      </footer>
    </div>
  );
}

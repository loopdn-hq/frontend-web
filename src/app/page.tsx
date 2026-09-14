"use client";

import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteTopNav } from "@/components/site/SiteTopNav";

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

export default function RootPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eaf4ff] text-[#0b2558] transition-colors dark:bg-[#071d5c] dark:text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_100%,#c8ecff_0%,#84d3ff_24%,rgba(95,181,255,0.42)_44%,rgba(127,187,255,0)_69%)] dark:hidden" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(223,243,255,0)_34%,rgba(151,223,255,0.86)_50%,rgba(223,243,255,0)_65%)] dark:hidden" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#f3faff_0%,#d4ecff_100%)] dark:hidden" />

      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_10%_100%,#9fddf4_0%,#4bb9f3_20%,rgba(23,132,246,0.45)_35%,rgba(10,37,111,0.1)_52%,rgba(7,29,92,0)_65%)] dark:block" />
      <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(136deg,rgba(6,36,114,0)_41%,rgba(106,222,255,0.88)_50%,rgba(6,36,114,0)_59%)] dark:block" />
      <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(180deg,#0a256f_0%,#061a54_100%)] opacity-95 dark:block" />

      <SiteTopNav />

      <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col items-center px-4 pb-16 pt-14 sm:px-8 lg:items-start lg:pt-20">
        <section className="w-full rounded-[18px] bg-[#edf7ff80] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.12)] dark:bg-[#0a2a72]/35 dark:shadow-[0_18px_50px_rgba(2,13,45,0.3)] sm:p-7">
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
          className="mt-18 w-full rounded-[18px] bg-[#edf7ffb0] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.18)] dark:bg-[#0a2a72]/55 dark:shadow-[0_18px_50px_rgba(2,13,45,0.4)] sm:p-6 lg:mt-24 w-full"
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
          className="mt-8 w-full rounded-[18px] bg-[#edf7ffb0] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.18)] dark:bg-[#0a2a72]/55 dark:shadow-[0_18px_50px_rgba(2,13,45,0.4)] sm:p-6"
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

          <div className="mt-6 grid gap-1.5 lg:grid-cols-[0.95fr_1.28fr] lg:items-stretch">
            <article className="overflow-hidden rounded-xl border border-[#9ecbff]/80 bg-[#f4faff] shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)] lg:max-w-[560px]">
              <Image
                src="/connected-by-text.png"
                alt="Stay connected by text"
                width={640}
                height={430}
                className="h-full w-full object-cover"
              />
            </article>

            <div className="grid gap-2 lg:grid-rows-2">
              <article className="overflow-hidden h-full rounded-xl border border-[#9ecbff]/80 bg-[#f4faff] shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)] lg:min-h-[188px]">
                <Image
                  src="/shared-space-for-all.png"
                  alt="A shared space for everyone"
                  width={480}
                  height={220}
                  className="h-full w-full object-cover object-left"
                />
              </article>
              <article className="overflow-hidden rounded-xl border border-[#9ecbff]/80 bg-[#f4faff] shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)] lg:min-h-[188px]">
                <Image
                  src="/connect-with-your-voice.png"
                  alt="Connect with your voice"
                  width={540}
                  height={220}
                  className="h-full w-full object-cover object-left"
                />
              </article>
            </div>
          </div>
        </section>

        <section
          id="who-its-for"
          className="mt-8 w-full rounded-[18px] bg-[#edf7ffb0] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.18)] dark:bg-[#0a2a72]/55 dark:shadow-[0_18px_50px_rgba(2,13,45,0.4)] sm:p-6"
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
          className="mt-8 w-full rounded-[18px] bg-[#edf7ffb0] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.18)] dark:bg-[#0a2a72]/55 dark:shadow-[0_18px_50px_rgba(2,13,45,0.4)] sm:p-6"
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
                  Join by link or code
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok />
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok />
                </p>
              </div>
              <div className="grid grid-cols-[1.7fr_.9fr_.9fr] items-center gap-3 py-2.5 text-sm">
                <p className="text-[#2f5f99] dark:text-[#9bc2f2]">
                  Admin approval &amp; member control
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok />
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok />
                </p>
              </div>
              <div className="grid grid-cols-[1.7fr_.9fr_.9fr] items-center gap-3 py-2.5 text-sm">
                <p className="text-[#2f5f99] dark:text-[#9bc2f2]">
                  Chat or broadcast groups
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
                  Free to start
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok />
                </p>
                <p className="flex justify-center">
                  <StatusIcon ok />
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
          className="mt-8 w-full rounded-[18px] bg-[#edf7ffb0] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.18)] dark:bg-[#0a2a72]/55 dark:shadow-[0_18px_50px_rgba(2,13,45,0.4)] sm:p-6"
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

        <section className="mt-8 w-full overflow-hidden rounded-[22px] bg-[linear-gradient(130deg,#194a9f_0%,#0d2e7a_34%,#53c5ff_100%)] px-6 py-12 text-center shadow-[0_20px_46px_rgba(11,35,95,0.35)] sm:px-10">
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

      <SiteFooter />
    </div>
  );
}

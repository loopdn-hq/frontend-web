"use client";

import Link from "next/link";
import { displayNameForSession, useSession } from "@/lib/auth/client";

export default function RootPage() {
  const session = useSession();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_20%,#5bd0ff_0%,#daf4ff_30%,#eaf7ff_60%,#f8fcff_100%)] text-slate-800">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -left-20 top-16 h-72 w-72 rounded-full bg-cyan-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-96 h-96 w-96 rounded-full bg-sky-400/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-1/3 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl" />

      {/* Header / Nav */}
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-slate-900 transition hover:opacity-80"
          >
            Loopd&apos;n
          </Link>
        </div>

        <nav className="flex items-center gap-3 sm:gap-4">
          {session ? (
            <>
              <span className="hidden text-xs text-slate-500 sm:inline">
                Signed in as{" "}
                <strong className="font-semibold text-slate-700">
                  {displayNameForSession(session)}
                </strong>
              </span>
              <Link
                href="/home/"
                className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(0,143,223,0.3)] transition hover:brightness-110"
              >
                Go to Home
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login/"
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
              >
                Log In
              </Link>
              <Link
                href="/signup/"
                className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(0,143,223,0.3)] transition hover:brightness-110"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative mx-auto max-w-6xl px-6 pt-10 pb-20 sm:px-8 sm:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/70 px-4 py-1.5 text-xs font-semibold tracking-wider text-sky-800 uppercase shadow-xs backdrop-blur-sm">
            One group &bull; Any phone &bull; Everyone connected
          </p>

          <h1 className="mt-6 text-4xl leading-tight font-extrabold tracking-tight text-slate-900 sm:text-6xl sm:leading-[1.15]">
            The group chat where everyone stays connected.
          </h1>

          <p className="mt-6 text-base leading-relaxed text-slate-600 sm:text-lg">
            Coordinate groups seamlessly across web and SMS. Phone members can
            read, reply, and participate without installing an app, while web
            users get real-time chat, voice notes, and admin broadcast controls.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            {session ? (
              <Link
                href="/home/"
                className="w-full rounded-2xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-8 py-4 text-center text-base font-bold text-white shadow-[0_12px_28px_rgba(0,143,223,0.35)] transition hover:brightness-110 sm:w-auto"
              >
                Open Loopd&apos;n Home &rarr;
              </Link>
            ) : (
              <>
                <Link
                  href="/signup/"
                  className="w-full rounded-2xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-8 py-4 text-center text-base font-bold text-white shadow-[0_12px_28px_rgba(0,143,223,0.35)] transition hover:brightness-110 sm:w-auto"
                >
                  Create Your Loop (Free)
                </Link>
                <Link
                  href="/login/"
                  className="w-full rounded-2xl border border-slate-200 bg-white/80 px-8 py-4 text-center text-base font-semibold text-slate-700 shadow-xs backdrop-blur-sm transition hover:bg-white hover:text-slate-900 sm:w-auto"
                >
                  Log In &rarr;
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Feature Cards Grid */}
        <section className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-[0_10px_30px_rgba(0,102,179,0.08)] backdrop-blur-sm transition hover:shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-xl font-bold text-sky-700">
              💬
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              Realtime Web + SMS Sync
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Messages sent from the web instantly broadcast to SMS members, and
              text replies from phones appear live in the group thread.
            </p>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-[0_10px_30px_rgba(0,102,179,0.08)] backdrop-blur-sm transition hover:shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-xl font-bold text-sky-700">
              🎙️
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              Voice Notes Anywhere
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Record voice updates once. Web users play them inline, while SMS
              members receive a secure, instant playback link.
            </p>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-[0_10px_30px_rgba(0,102,179,0.08)] backdrop-blur-sm transition hover:shadow-md sm:col-span-2 lg:col-span-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-xl font-bold text-sky-700">
              🛡️
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              Admin &amp; Broadcast Modes
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Run open community discussions or broadcast announcements with
              flexible joining methods, approvals, and reply controls.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-sky-100/60 bg-white/40 py-8 text-center text-xs text-slate-500 backdrop-blur-xs">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row sm:px-8">
          <p>
            &copy; {new Date().getFullYear()} Loopd&apos;n. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/terms/"
              className="text-slate-600 underline hover:text-slate-900"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy/"
              className="text-slate-600 underline hover:text-slate-900"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

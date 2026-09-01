import Link from "next/link";
import type { ReactNode } from "react";

type LegalLayoutProps = {
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

// Shared shell for /terms and /privacy - matches the auth screen's visual
// language but as a scrollable long-form document instead of a card.
export function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_20%,#5bd0ff_0%,#daf4ff_30%,#eaf7ff_60%,#f8fcff_100%)] px-4 py-10 sm:px-8">
      <div className="pointer-events-none absolute -left-16 top-16 h-52 w-52 rounded-full bg-cyan-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-12 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl" />

      <div className="relative mx-auto max-w-3xl rounded-3xl border border-sky-100 bg-white/90 p-6 shadow-[0_10px_40px_rgba(34,113,176,0.15)] backdrop-blur-sm sm:p-10">
        <Link
          href="/"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600 hover:text-sky-700"
        >
          Loopd&apos;n
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Last updated {lastUpdated}</p>

        <article className="prose-legal mt-8 space-y-6 text-sm leading-6 text-slate-700 sm:text-base sm:leading-7">
          {children}
        </article>
      </div>
    </main>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteTopNav } from "@/components/site/SiteTopNav";

type LegalLayoutProps = {
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

// Shared shell for /terms and /privacy - matches the auth screen's visual
// language but as a scrollable long-form document instead of a card.
export function LegalLayout({
  title,
  lastUpdated,
  children,
}: LegalLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eaf4ff] text-[#0b2558] dark:bg-[#111949] dark:text-[#c2dcff]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_100%,#c8ecff_0%,#84d3ff_24%,rgba(95,181,255,0.42)_44%,rgba(127,187,255,0)_69%)] dark:hidden" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(223,243,255,0)_34%,rgba(151,223,255,0.86)_50%,rgba(223,243,255,0)_65%)] dark:hidden" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#f3faff_0%,#d4ecff_100%)] dark:hidden" />

      <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(180deg,#161c58_0%,#101642_100%)] dark:block" />

      <SiteTopNav />

      <main className="relative z-10 px-4 pb-16 pt-8 sm:px-8 sm:pt-10">
        <div className="mx-auto w-full max-w-[1440px]">
          <div className="mx-auto max-w-[1100px]">
            <div className="flex justify-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#7ab8ff]/70 bg-[#cfe7ff]/80 px-3 py-1 text-xs text-[#23528a] dark:border-[#2f63b6] dark:bg-[#123373] dark:text-[#9bc2f2]">
                <Link href="/" className="hover:underline">
                  Home
                </Link>
                <span aria-hidden>›</span>
                <span>{title}</span>
              </p>
            </div>

            <h1 className="mt-6 text-center text-4xl font-semibold tracking-tight text-[#1d3f7f] dark:text-[#bfe2ff] sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-center text-sm text-[#5579ae] dark:text-[#88aee0]">
              Last Updated: {lastUpdated}
            </p>

            <article className="mx-auto mt-14 max-w-[1180px] space-y-8 text-sm leading-7 text-[#315b92] dark:text-[#9ebfe9] sm:text-base">
              {children}
            </article>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

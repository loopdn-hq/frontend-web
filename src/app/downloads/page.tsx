import type { Metadata } from "next";
import Link from "next/link";
import { DownloadHero } from "@/components/site/DownloadHero";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteTopNav } from "@/components/site/SiteTopNav";
import { DESKTOP_INSTALLERS } from "@/lib/config/downloads";

export const metadata: Metadata = {
  title: "Download Loopd'n for Desktop | Loopd'n",
  description:
    "Get the Loopd'n desktop app for macOS and Windows. Free to download, always in sync with the web.",
};

const REASONS = [
  {
    title: "Built for the whole screen",
    body: "Your groups, conversation, and members side by side - no tab switching to see who said what.",
  },
  {
    title: "Notifications that reach you",
    body: "Messages arrive on your dock or taskbar while you work, even when the browser is closed.",
  },
  {
    title: "Always in sync",
    body: "The same account and the same conversations as the web and SMS. Start anywhere, finish anywhere.",
  },
];

export default function DownloadsPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eaf4ff] text-[#0b2558] transition-colors dark:bg-[#071d5c] dark:text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_100%,#c8ecff_0%,#84d3ff_24%,rgba(95,181,255,0.42)_44%,rgba(127,187,255,0)_69%)] dark:hidden" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#f3faff_0%,#d4ecff_100%)] dark:hidden" />

      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_10%_100%,#9fddf4_0%,#4bb9f3_20%,rgba(23,132,246,0.45)_35%,rgba(10,37,111,0.1)_52%,rgba(7,29,92,0)_65%)] dark:block" />
      <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(180deg,#0a256f_0%,#061a54_100%)] opacity-95 dark:block" />

      <SiteTopNav />

      <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col items-center px-4 pb-16 pt-6 sm:px-8 lg:items-start lg:pt-5">
        <DownloadHero />

        <section className="mt-8 w-full rounded-[18px] bg-[#edf7ffb0] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.18)] dark:bg-[#0a2a72]/55 dark:shadow-[0_18px_50px_rgba(2,13,45,0.4)] sm:p-6">
          <p className="inline-flex rounded-full border border-[#7ab8ff]/70 bg-[#cfe7ff] px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-[#23528a] uppercase dark:border-[#3a76d2]/80 dark:bg-[#11408d] dark:text-[#b7d9ff]">
            Why Desktop
          </p>
          <h2 className="mt-3 text-2xl leading-tight font-semibold text-[#173a75] dark:text-[#d6e8ff] sm:text-[32px]">
            Everything the web app does,
            <br />
            with room to breathe.
          </h2>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {REASONS.map((reason) => (
              <article
                key={reason.title}
                className="rounded-xl border border-[#9ecbff]/80 bg-[#f4faff] p-5 shadow-[0_12px_28px_rgba(95,144,206,0.2)] dark:border-[#2f63b6] dark:bg-[#10327d]/65 dark:shadow-[0_12px_28px_rgba(1,9,32,0.35)]"
              >
                <h3 className="text-lg font-semibold text-[#173a75] dark:text-[#d6e8ff]">
                  {reason.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#3f679a] dark:text-[#9bc2f2]">
                  {reason.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 w-full rounded-[18px] bg-[#edf7ffb0] p-5 shadow-[0_18px_50px_rgba(86,139,204,0.18)] dark:bg-[#0a2a72]/55 dark:shadow-[0_18px_50px_rgba(2,13,45,0.4)] sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-[#7ab8ff]/70 bg-[#cfe7ff] px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-[#23528a] uppercase dark:border-[#3a76d2]/80 dark:bg-[#11408d] dark:text-[#b7d9ff]">
                System Requirements
              </p>
              <dl className="mt-4 divide-y divide-[#96c5ff]/35 text-sm">
                {Object.values(DESKTOP_INSTALLERS).map((installer) => (
                  <div
                    key={installer.os}
                    className="grid gap-1 py-3 sm:grid-cols-[120px_1fr] sm:gap-3"
                  >
                    <dt className="font-semibold text-[#173a75] dark:text-[#d6e8ff]">
                      {installer.label}
                    </dt>
                    <dd className="text-[#3f679a] dark:text-[#9bc2f2]">
                      {installer.requirement}
                    </dd>
                  </div>
                ))}
                <div className="grid gap-1 py-3 sm:grid-cols-[120px_1fr] sm:gap-3">
                  <dt className="font-semibold text-[#173a75] dark:text-[#d6e8ff]">
                    Updates
                  </dt>
                  <dd className="text-[#3f679a] dark:text-[#9bc2f2]">
                    The app checks for new versions and offers them to you. It
                    never installs one without asking.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-[#9ecbff]/80 bg-[#f4faff] p-5 dark:border-[#2f63b6] dark:bg-[#10327d]/65">
              <h3 className="text-lg font-semibold text-[#173a75] dark:text-[#d6e8ff]">
                Not on your own computer?
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#3f679a] dark:text-[#9bc2f2]">
                Loopd&apos;n works in any browser, with nothing to install. Your
                groups are the same either way.
              </p>
              <Link
                href="/chats/"
                className="mt-4 inline-flex h-11 items-center justify-center rounded-[10px] border border-[#8cb6ff]/60 bg-white px-5 text-sm font-semibold text-[#0d336f] transition hover:bg-[#eaf4ff] dark:border-[#8cb6ff]/40 dark:bg-[#0a2a72] dark:text-[#ecf4ff] dark:hover:bg-[#113785]"
              >
                Open Loopd&apos;n on the web →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

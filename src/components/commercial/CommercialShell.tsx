"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { CompanyStatusBadge } from "@/components/commercial/StatusBadge";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import { cn } from "@/lib/ui/cn";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Whether a pathname belongs to this item, for the active highlight. */
  matches: (pathname: string) => boolean;
};

const NAV: NavItem[] = [
  {
    href: "/commercial/",
    label: "Overview",
    icon: LayoutDashboard,
    matches: (path) => path === "/commercial/" || path === "/commercial",
  },
  {
    href: "/commercial/campaigns/",
    label: "Campaigns",
    icon: Megaphone,
    // /commercial/campaign/?id= is one campaign, and still "Campaigns".
    matches: (path) => /^\/commercial\/campaigns?(\/|$)/.test(path),
  },
  {
    href: "/commercial/billing/",
    label: "Billing",
    icon: CreditCard,
    matches: (path) => path.startsWith("/commercial/billing"),
  },
  {
    href: "/commercial/settings/",
    label: "Company settings",
    icon: Settings,
    matches: (path) => path.startsWith("/commercial/settings"),
  },
];

/**
 * The commercial dashboard's frame: its own sidebar, not the chat nav rail.
 *
 * Deliberately independent of AppShellProvider. The chat shell opens a
 * websocket, a call layer and activity toasts; none of that belongs on a
 * campaign report, and none of it should break because this page exists.
 * The one road back to chat is the link at the bottom.
 */
export function CommercialShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { company } = useCompany();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 md:flex-row dark:bg-slate-950">
      <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white md:w-64 md:border-r md:border-b-0 dark:border-slate-800 dark:bg-slate-900">
        <div className="px-4 pt-4 pb-3">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-sky-600 uppercase">
            Loopd&apos;n Commercial
          </p>
          <p className="mt-1 truncate text-base font-bold text-slate-900 dark:text-slate-100">
            {company.name}
          </p>
          <CompanyStatusBadge status={company.status} className="mt-1.5" />
        </div>

        <nav
          aria-label="Commercial"
          className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:overflow-visible"
        >
          {NAV.map((item) => {
            const active = item.matches(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/chats/"
          className="hidden items-center gap-2 border-t border-slate-200 px-5 py-3 text-xs font-medium text-slate-500 hover:text-slate-800 md:flex dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to chats
        </Link>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

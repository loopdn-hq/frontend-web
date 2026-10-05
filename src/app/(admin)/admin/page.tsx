"use client";

import Link from "next/link";
import {
  ArrowRight,
  Megaphone,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useAdminFeatures } from "@/components/admin/AdminFrame";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { meets } from "@/lib/rbac";

/**
 * /admin/ - the admin site's overview: where each admin tool is. Every action
 * behind these is checked on the server against its own feature, whatever
 * this page shows.
 */
export default function AdminOverviewPage() {
  const context = useAdminFeatures();
  const may = (feature: string) => meets({ account: feature }, context);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <AdminPageHeader
        title="Overview"
        description="Loopd'n's own tools. Everything here is checked again on the server."
      />

      <section className="grid gap-4 sm:grid-cols-2">
        {may("platform.campaign.review") && (
          <Tool
            href="/admin/campaigns/"
            icon={Megaphone}
            title="Campaign review"
            description="Approve campaigns companies submit, or send them back with notes."
          />
        )}
        {may("platform.permissions.view") && (
          <Tool
            href="/admin/permissions/"
            icon={ShieldCheck}
            title="Permissions"
            description="Which role may use which feature, and changing it."
          />
        )}
      </section>
    </div>
  );
}

function Tool({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-violet-300 dark:border-slate-800 dark:bg-slate-900"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </span>
        </span>
        <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">
          {description}
        </span>
      </span>
      <ArrowRight
        className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-500"
        aria-hidden
      />
    </Link>
  );
}

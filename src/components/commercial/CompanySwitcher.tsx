"use client";

import { useRef, useState } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  RotateCw,
} from "lucide-react";

import { CompanyLogo } from "@/components/commercial/CompanyLogo";
import {
  useCompaniesDialog,
  useCreateCompany,
} from "@/components/commercial/CompanyDialogs";
import { useSwitchCompany } from "@/components/commercial/useSwitchCompany";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import type { Company } from "@/lib/commercial/types";

// A white pill on the blue bar, in every state, so the bar never changes
// shape as the company loads.
const PILL =
  "inline-flex h-11 max-w-[min(20rem,100%)] min-w-0 items-center gap-2.5 rounded-xl bg-white px-2 pr-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

// How many companies the dropdown lists before "View all companies" is the
// way to the rest. The active one is always among them.
const LISTED = 6;

/**
 * The active company, at the left of the dashboard's blue bar. Clicking it
 * opens the company dropdown:
 *
 *   [ (logo) Luna Cafe  v ]
 *   ┌───────────────────────────┐
 *   │ (logo) Luna Cafe        ✓ │
 *   │        Food and drink     │
 *   │ (logo) City Fitness       │
 *   │        Health and fitness │
 *   ├───────────────────────────┤
 *   │ View all companies      2 │
 *   │ + Create new company      │
 *   └───────────────────────────┘
 *
 * Picking a company switches to it and keeps the section - Campaigns stays
 * Campaigns - except on a page that belongs to the company being left.
 * "Create new company" opens the create modal; "View all companies" opens the
 * Companies dialog.
 */
export function CompanySwitcher() {
  const openCreateCompany = useCreateCompany();
  const openCompanies = useCompaniesDialog();
  const switchCompany = useSwitchCompany();
  const { company, companies, companyCount, status, switchingTo, reload } =
    useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  const close = () => setIsOpen(false);
  useClickOutside(container, isOpen, close);
  useEscapeKey(isOpen, close);

  if (status === "unavailable") {
    return (
      <button type="button" onClick={reload} className={PILL}>
        <RotateCw className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <span className="truncate">Couldn&apos;t load companies. Retry</span>
      </button>
    );
  }

  if (status === "loading" && !company) {
    return (
      <span
        aria-label="Loading your company"
        className="inline-block h-11 w-48 animate-pulse rounded-xl bg-white/30"
      />
    );
  }

  // No company yet is a normal state, not a different control: the pill
  // still opens the dropdown, which then offers the two ways forward.
  const active = company;

  function choose(id: number) {
    close();
    if (id === active?.id) return;
    void switchCompany(id);
  }

  // The active one first, then the rest by name.
  const others = companies
    .filter((item) => item.id !== active?.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const listed = (active ? [active, ...others] : others).slice(0, LISTED);

  return (
    <div ref={container} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={
          active
            ? `Company: ${active.name}. Show companies`
            : "No company yet. Show companies"
        }
        onClick={() => setIsOpen((current) => !current)}
        className={PILL}
      >
        {active ? (
          <CompanyLogo name={active.name} logoUrl={active.logoUrl} size={32} />
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-600 dark:bg-slate-800 dark:text-sky-400">
            <Building2 className="h-4 w-4" aria-hidden />
          </span>
        )}
        <span className="min-w-0 truncate">
          {active ? active.name : "No company yet"}
        </span>
        {switchingTo !== null ? (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-slate-400"
            aria-label="Switching company"
          />
        ) : (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-500 transition ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-30 mt-2 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {listed.length > 0 ? (
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {listed.map((item) => (
                <li key={item.id}>
                  <CompanyRow
                    company={item}
                    isActive={item.id === active?.id}
                    onSelect={() => choose(item.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
              You haven&apos;t created a company yet. Create one to start
              advertising on Loopd&apos;n.
            </p>
          )}

          <div className="mx-2 my-2 h-px bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                close();
                openCompanies();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Building2 className="h-5 w-5 text-slate-500" aria-hidden />
              <span className="flex-1">View all companies</span>
              <span className="text-xs text-slate-400">{companyCount}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                openCreateCompany();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-base font-semibold text-sky-600 transition hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-slate-800"
            >
              <Plus className="h-5 w-5" aria-hidden />
              Create new company
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CompanyRow({
  company,
  isActive,
  onSelect,
}: {
  company: Company;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isActive ? "true" : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        isActive
          ? "bg-sky-50 dark:bg-slate-800"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
      }`}
    >
      <CompanyLogo name={company.name} logoUrl={company.logoUrl} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold text-slate-900 dark:text-slate-100">
          {company.name}
        </span>
        <span className="block truncate text-sm text-slate-500 dark:text-slate-400">
          {company.status === "suspended" ? "Suspended" : company.industryLabel}
        </span>
      </span>
      {isActive && (
        <Check className="h-5 w-5 shrink-0 text-sky-500" aria-label="Active" />
      )}
    </button>
  );
}

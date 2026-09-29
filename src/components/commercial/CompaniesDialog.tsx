"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";

import { CompanyForm } from "@/components/commercial/CompanyForm";
import { CompanyLogo } from "@/components/commercial/CompanyLogo";
import { useSwitchCompany } from "@/components/commercial/useSwitchCompany";
import {
  Badge,
  Button,
  Input,
  Modal,
  Skeleton,
  SkeletonRegion,
  useToast,
} from "@/components/ui";
import { fetchCompanyPage } from "@/lib/commercial/api";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import type { Company } from "@/lib/commercial/types";

/**
 * "Companies" - every company the person manages, in one dialog.
 *
 *   ┌──────────────────────┬──────────────────────────────────────┐
 *   │ [+ Create new company]│ (logo) Company One     [⇄ Switch to  │
 *   │ (logo) Company One ● │        Food and drink    this company]│
 *   │ (logo) Company Two   │ Company information ...              │
 *   │ (logo) CDO Rentals   │ Company description ...              │
 *   └──────────────────────┴──────────────────────────────────────┘
 *
 * The list picks which company the right side shows; it does not switch.
 * Switching is the right side's button, because editing a company and
 * working in it are different things. Any company can be edited from here,
 * active or not. On a phone the two sides take turns.
 *
 * It lists companies to manage - it is not an "All companies" view: nothing
 * here adds up campaigns, spend or leads across them (plan decision 16).
 */
export function CompaniesDialog({
  isOpen,
  initialCompanyId,
  onClose,
}: {
  isOpen: boolean;
  initialCompanyId?: number;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Companies"
      description="Manage the companies connected to your Commercial account. You can edit information, switch between companies, or create a new one."
      maxWidthClassName="max-w-5xl"
      bodyClassName="p-0"
      closeLabel="Close"
    >
      {/* Mounted only while open, so each opening starts from the company
          it was opened on. */}
      <CompaniesPanes initialCompanyId={initialCompanyId} onClose={onClose} />
    </Modal>
  );
}

type CompanyList = {
  /** Which search (and reload) these rows are for. */
  for: string;
  items: Company[];
  page: number;
  hasMore: boolean;
};

function CompaniesPanes({
  initialCompanyId,
  onClose,
}: {
  initialCompanyId?: number;
  onClose: () => void;
}) {
  const toast = useToast();
  const { company: active, companies, adopt, update } = useCompany();

  // The right side: a company, or the form for a new one. Starts on the one
  // it was opened for, else the active one, else - none yet - a new one.
  const [selected, setSelected] = useState<Company | "new">(
    () =>
      companies.find((item) => item.id === initialCompanyId) ?? active ?? "new",
  );
  // Phones show one side at a time; from md up, both.
  const [showingDetails, setShowingDetails] = useState(false);

  // The left side: ten at a time from the server, by name, narrowed by the
  // search once typing pauses.
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim(), 300);
  const [reloadToken, setReloadToken] = useState(0);
  const listKey = `${search}\u0000${reloadToken}`;
  const [list, setList] = useState<CompanyList>({
    for: "",
    items: [],
    page: 0,
    hasMore: false,
  });
  const [listError, setListError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingFirst = list.for !== listKey && listError === null;

  const scroller = useRef<HTMLUListElement>(null);
  const sentinel = useRef<HTMLLIElement>(null);

  // The first page, for each search.
  useEffect(() => {
    let cancelled = false;
    fetchCompanyPage({ search, page: 1 }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setListError(result.message);
        return;
      }
      setListError(null);
      setList({
        for: listKey,
        items: result.data.companies,
        page: 1,
        hasMore: result.data.hasMore,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [search, listKey]);

  const loadMore = useCallback(() => {
    if (loadingMore || !list.hasMore || list.for !== listKey) return;
    const forKey = list.for;
    const page = list.page + 1;
    setLoadingMore(true);
    fetchCompanyPage({ search, page }).then((result) => {
      setLoadingMore(false);
      if (!result.ok) {
        setListError(result.message);
        return;
      }
      setList((current) => {
        // A different search came back first: this page is not for it.
        if (current.for !== forKey) return current;
        const seen = new Set(current.items.map((item) => item.id));
        return {
          for: forKey,
          items: [
            ...current.items,
            ...result.data.companies.filter((item) => !seen.has(item.id)),
          ],
          page,
          hasMore: result.data.hasMore,
        };
      });
    });
  }, [list, listKey, loadingMore, search]);

  // The next ten as the bottom of the list scrolls into view - a little
  // before, so the rows are usually there by the time it arrives.
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !list.hasMore || listError) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { root: scroller.current, rootMargin: "120px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [list.hasMore, listError, loadMore]);

  function select(next: Company | "new") {
    setSelected(next);
    setShowingDetails(true);
  }

  function retry() {
    setListError(null);
    if (list.for === listKey) loadMore();
    else setReloadToken((token) => token + 1);
  }

  const creating = selected === "new";

  return (
    <div className="flex h-[min(46rem,calc(100vh-12rem))] min-h-0">
      <aside
        className={`${
          showingDetails ? "hidden md:flex" : "flex"
        } w-full shrink-0 flex-col border-slate-200 md:w-80 md:border-r dark:border-slate-800`}
      >
        <div className="space-y-3 p-4">
          <Button fullWidth size="lg" onClick={() => select("new")}>
            <Plus className="h-5 w-5" aria-hidden />
            Create new company
          </Button>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search companies"
              aria-label="Search companies"
              className="py-2.5 pr-9 pl-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <ul
          ref={scroller}
          aria-busy={loadingFirst || loadingMore}
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3"
        >
          {loadingFirst ? (
            <li>
              <SkeletonRegion label="Loading companies" className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </SkeletonRegion>
            </li>
          ) : list.for !== listKey ? null : list.items.length === 0 ? (
            // Rows only ever for the search on screen: after a failed search,
            // the previous one's are not left standing under the new words.
            <li className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {search ? `No companies match “${search}”.` : "No companies yet."}
            </li>
          ) : (
            list.items.map((item) => (
              <li key={item.id}>
                <CompanyListRow
                  company={item}
                  isActive={item.id === active?.id}
                  isSelected={!creating && item.id === selected.id}
                  onSelect={() => select(item)}
                />
              </li>
            ))
          )}

          {listError && (
            <li className="px-3 py-3 text-center text-sm text-slate-500 dark:text-slate-400">
              {listError}{" "}
              <button
                type="button"
                onClick={retry}
                className="font-semibold text-sky-600 hover:underline dark:text-sky-400"
              >
                Try again
              </button>
            </li>
          )}
          {loadingMore && (
            <li className="flex items-center justify-center gap-2 py-3 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading more…
            </li>
          )}
          {/* Seen by the observer above: reaching it loads the next ten. */}
          <li ref={sentinel} aria-hidden className="h-px" />
        </ul>
      </aside>

      <section
        className={`${
          showingDetails ? "block" : "hidden md:block"
        } min-w-0 flex-1 overflow-y-auto p-5 sm:p-6`}
      >
        <button
          type="button"
          onClick={() => setShowingDetails(false)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 md:hidden dark:text-sky-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All companies
        </button>

        {creating ? (
          <>
            <div className="mb-6 border-b border-slate-200 pb-5 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                New company
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                It gets its own campaigns, balance and billing. Nothing is
                copied from your other companies.
              </p>
            </div>
            <CompanyForm
              submitLabel="Create company"
              onCancel={
                active
                  ? () => {
                      setSelected(active);
                      setShowingDetails(false);
                    }
                  : onClose
              }
              onSaved={(created) => {
                adopt(created);
                setSelected(created);
                // Fetched again, so it takes its place by name.
                setReloadToken((token) => token + 1);
                toast({
                  title: "Company created",
                  description: `${created.name} is now your active company.`,
                });
              }}
            />
          </>
        ) : (
          <CompanyDetails
            key={selected.id}
            company={selected}
            isActive={selected.id === active?.id}
            onCancel={onClose}
            onSaved={(saved) => {
              update(saved);
              setSelected(saved);
              setList((current) => ({
                ...current,
                items: current.items.map((item) =>
                  item.id === saved.id ? saved : item,
                ),
              }));
              toast({
                title: "Changes saved",
                description: `${saved.name}'s details are up to date.`,
              });
            }}
          />
        )}
      </section>
    </div>
  );
}

function CompanyListRow({
  company,
  isActive,
  isSelected,
  onSelect,
}: {
  company: Company;
  isActive: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected ? "true" : undefined}
      className={`flex w-full items-center gap-3 rounded-xl border-l-4 px-3 py-3 text-left transition ${
        isSelected
          ? "border-sky-500 bg-sky-50 dark:bg-slate-800"
          : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60"
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
      {isActive && <Badge tone="success">Active</Badge>}
    </button>
  );
}

function CompanyDetails({
  company,
  isActive,
  onCancel,
  onSaved,
}: {
  company: Company;
  isActive: boolean;
  onCancel: () => void;
  onSaved: (company: Company) => void;
}) {
  const toast = useToast();
  const switchCompany = useSwitchCompany();
  const [switching, setSwitching] = useState(false);

  async function makeActive() {
    setSwitching(true);
    const switched = await switchCompany(company.id);
    setSwitching(false);
    if (switched) {
      toast({
        title: `Switched to ${switched.name}`,
        description: "It's now your active company for campaigns and billing.",
      });
    } else {
      toast({
        tone: "error",
        title: "Couldn't switch company",
        description: "Your companies have been reloaded. Try again.",
      });
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-4">
          <CompanyLogo
            name={company.name}
            logoUrl={company.logoUrl}
            size={80}
          />
          <div className="min-w-0">
            <h3 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">
              {company.name}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {company.industryLabel}
            </p>
            <div className="mt-2 flex gap-2">
              {isActive && <Badge tone="success">Active</Badge>}
              {company.status === "suspended" && (
                <Badge tone="warning">Suspended</Badge>
              )}
            </div>
          </div>
        </div>

        {!isActive && (
          <div className="flex max-w-[16rem] flex-col items-center gap-2 text-center">
            <Button
              variant="secondary"
              onClick={() => void makeActive()}
              disabled={switching}
              className="border-sky-300 text-sky-600 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-400"
            >
              {switching ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ArrowLeftRight className="h-4 w-4" aria-hidden />
              )}
              Switch to this company
            </Button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Make this your active company for campaigns and billing.
            </p>
          </div>
        )}
      </div>

      <CompanyForm
        company={company}
        submitLabel="Save changes"
        onCancel={onCancel}
        onSaved={onSaved}
      />
    </>
  );
}

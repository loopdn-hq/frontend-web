"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { LoadFailed } from "@/components/app/LoadFailed";
import { Alert, Skeleton, SkeletonRegion } from "@/components/ui";
import { fetchCampaign } from "@/lib/commercial/api";
import { useCampaignOptions } from "@/lib/commercial/useCampaignOptions";
import type { CampaignDetail, Company } from "@/lib/commercial/types";
import { cn } from "@/lib/ui/cn";
import { AudienceStep } from "./AudienceStep";
import { BudgetStep } from "./BudgetStep";
import { CreativesStep } from "./CreativesStep";
import { ObjectiveStep } from "./ObjectiveStep";
import { ReachStep } from "./ReachStep";
import { ReviewStep } from "./ReviewStep";
import { STEPS, type StepKey } from "./steps";

function addressOf(campaignId: number, step: StepKey): string {
  return `/campaigns/new/?id=${campaignId}&step=${step}`;
}

/**
 * The campaign builder: which step is showing, and the draft every step
 * edits. A draft saves as it goes, so leaving and coming back - by link,
 * reload, or "Edit" on the list - picks up where it was; submit is the only
 * gate (backend plan, section 7).
 *
 * `campaignId` null is a new campaign: only the first step, which creates
 * the draft for `company`, the one being shown.
 */
export function CampaignBuilder({
  campaignId,
  step,
  company,
}: {
  campaignId: number | null;
  step: StepKey;
  company: Company;
}) {
  const router = useRouter();
  const { options, error: optionsError, retry } = useCampaignOptions();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Fetched only when the address names a draft this has not loaded yet: a
  // draft just created on step 1 is already here.
  const loadedId = campaign?.id ?? null;
  useEffect(() => {
    if (campaignId === null || campaignId === loadedId) return;
    let cancelled = false;
    fetchCampaign(campaignId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setCampaign(result.data);
        setLoadError(null);
      } else {
        setLoadError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, loadedId, reloadToken]);

  const error = loadError ?? optionsError;
  if (error) {
    return (
      <LoadFailed
        what={loadError ? "this campaign" : "the campaign builder"}
        message={error}
        onRetry={() => {
          setLoadError(null);
          setReloadToken((token) => token + 1);
          retry();
        }}
      />
    );
  }

  const draft =
    campaignId !== null && campaign?.id === campaignId ? campaign : null;
  if (!options || (campaignId !== null && !draft)) return <BuilderSkeleton />;

  function goTo(next: StepKey) {
    if (draft) router.push(addressOf(draft.id, next));
  }

  if (draft && draft.companyId !== company.id) {
    return (
      <Alert variant="info">
        This draft belongs to another of your companies. Switch to it to keep
        editing.{" "}
        <Link href="/campaigns/" className="font-semibold underline">
          See {company.name}&apos;s campaigns
        </Link>
      </Alert>
    );
  }

  if (draft && draft.status !== "draft") {
    return (
      <Alert variant="info">
        {draft.status === "pending_review"
          ? "This campaign is waiting for review, so it can't be changed. Withdraw it from review to edit it."
          : "This campaign has been submitted and can't be changed here."}{" "}
        <Link
          href={`/campaigns/?id=${draft.id}`}
          className="font-semibold underline"
        >
          Open the campaign
        </Link>
      </Alert>
    );
  }

  // Without a draft there is only the first step: it is what creates one.
  const showing: StepKey = draft ? step : "objective";

  return (
    <div className="space-y-4">
      <Stepper draft={draft} showing={showing} onPick={goTo} />

      {/* Keyed by draft, so opening another draft (or "New campaign" from
          one) starts each step's form afresh. */}
      {showing === "objective" || !draft ? (
        <ObjectiveStep
          key={draft?.id ?? "new"}
          campaign={draft}
          company={company}
          onCreated={(created) => {
            setCampaign(created);
            // Replace, not push: Back from the next step should not land on
            // a blank "new campaign" and start a second draft.
            router.replace(addressOf(created.id, "audience"));
          }}
          onSaved={setCampaign}
          goTo={goTo}
        />
      ) : (
        <CurrentStep
          key={draft.id}
          step={showing}
          props={{
            campaign: draft,
            company,
            options,
            onSaved: setCampaign,
            goTo,
          }}
        />
      )}
    </div>
  );
}

function CurrentStep({
  step,
  props,
}: {
  step: Exclude<StepKey, "objective">;
  props: Parameters<typeof AudienceStep>[0];
}) {
  switch (step) {
    case "audience":
      return <AudienceStep {...props} />;
    case "reach":
      return <ReachStep {...props} />;
    case "budget":
      return <BudgetStep {...props} />;
    case "creatives":
      return <CreativesStep {...props} />;
    case "review":
      return <ReviewStep {...props} />;
  }
}

/** Whether a step has what submit will ask of it. Reach and review never block. */
function isDone(draft: CampaignDetail, step: StepKey): boolean {
  switch (step) {
    case "objective":
      return draft.name.trim() !== "";
    case "audience":
    case "reach":
      return draft.audience !== null;
    case "budget":
      return draft.totalBudgetCents !== null;
    case "creatives":
      return draft.creatives.length > 0;
    case "review":
      return false;
  }
}

/**
 * The six steps, any of which can be opened once a draft exists: a draft may
 * be finished in any order. Short names, so all six fit beside each other;
 * on a phone only the step showing is named.
 */
function Stepper({
  draft,
  showing,
  onPick,
}: {
  draft: CampaignDetail | null;
  showing: StepKey;
  onPick: (step: StepKey) => void;
}) {
  return (
    <nav aria-label="Campaign steps">
      <ol className="flex gap-1">
        {STEPS.map((item, index) => {
          const current = item.key === showing;
          const done = draft !== null && isDone(draft, item.key);
          return (
            <li
              key={item.key}
              className={cn(
                "min-w-0",
                current ? "flex-[3] sm:flex-1" : "flex-1",
              )}
            >
              <button
                type="button"
                disabled={!draft || current}
                aria-current={current ? "step" : undefined}
                onClick={() => onPick(item.key)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-medium transition disabled:cursor-default",
                  current
                    ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                    : "text-slate-500 enabled:hover:bg-slate-100 dark:text-slate-400 dark:enabled:hover:bg-slate-800",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-2xs",
                    current
                      ? "border-sky-600 bg-sky-600 text-white"
                      : done
                        ? "border-sky-200 bg-white text-sky-600 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-400"
                        : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
                  )}
                >
                  {done && !current ? (
                    <Check className="h-3.5 w-3.5" aria-label="done" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    "truncate",
                    current ? "inline" : "hidden sm:inline",
                  )}
                >
                  {item.short}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function BuilderSkeleton() {
  return (
    <SkeletonRegion label="Loading the campaign builder" className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-80 w-full" />
    </SkeletonRegion>
  );
}

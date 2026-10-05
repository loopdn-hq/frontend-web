"use client";

import { useEffect, useState } from "react";
import { LoadFailed } from "@/components/app/LoadFailed";
import { Alert, Button, Skeleton, SkeletonRegion } from "@/components/ui";
import { estimateReach } from "@/lib/commercial/api";
import { formatRange } from "@/lib/commercial/format";
import type { ReachEstimate } from "@/lib/commercial/types";
import { StepFooter, StepFrame } from "./StepFrame";
import type { StepProps } from "./steps";

/**
 * Step 3: roughly how many the saved audience reaches. Always ranges, and
 * below Loopd'n's privacy floor no number at all - a company never learns
 * which groups, or how many when there are only a few.
 */
export function ReachStep({ campaign, company, goTo }: StepProps) {
  const audience = campaign.audience;
  const [estimate, setEstimate] = useState<ReachEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (!audience) return;
    let cancelled = false;
    estimateReach(company.id, audience).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setEstimate(result.data);
        setError(null);
      } else {
        setError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [audience, company.id, token]);

  return (
    <StepFrame
      title="Estimated reach"
      description="Ranges on purpose: Loopd'n never shows which groups or which people. Only people using the Loopd'n app see ads in chat, so members who only text aren't counted."
      footer={
        <StepFooter
          onBack={() => goTo("audience")}
          primaryLabel="Continue"
          onPrimary={() => goTo("budget")}
        />
      }
    >
      {!audience ? (
        <Alert variant="info">
          Choose an audience first.{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => goTo("audience")}
          >
            Choose audience
          </button>
        </Alert>
      ) : error ? (
        <LoadFailed
          what="the reach estimate"
          message={error}
          onRetry={() => {
            setError(null);
            setToken((current) => current + 1);
          }}
        />
      ) : !estimate ? (
        <SkeletonRegion
          label="Estimating reach"
          className="grid gap-3 sm:grid-cols-2"
        >
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </SkeletonRegion>
      ) : estimate.available ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Groups" value={formatRange(estimate.groups)} />
          <Stat label="People" value={formatRange(estimate.members)} />
        </div>
      ) : (
        <div className="space-y-3">
          <Alert variant="info">
            {estimate.reason} To protect people&apos;s privacy, Loopd&apos;n
            only runs ads for audiences above a minimum size. Choose more kinds
            of group, more regions, or a wider size range.
          </Alert>
          <Button variant="secondary" onClick={() => goTo("audience")}>
            Widen the audience
          </Button>
        </div>
      )}
    </StepFrame>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </article>
  );
}

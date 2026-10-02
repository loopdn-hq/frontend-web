"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AddFundsDialog } from "@/components/commercial/AddFundsDialog";
import { AudienceSummary } from "@/components/commercial/AudienceSummary";
import { SponsoredCard } from "@/components/commercial/SponsoredCard";
import { Alert, Button, useToast } from "@/components/ui";
import { fetchPricing, submitCampaign } from "@/lib/commercial/api";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import {
  CAMPAIGN_OBJECTIVE_LABEL,
  CAMPAIGN_PACING_LABEL,
  campaignName,
  formatBudget,
  formatCents,
  formatDate,
} from "@/lib/commercial/format";
import type { Pricing } from "@/lib/commercial/types";
import { StepFooter, StepFrame } from "./StepFrame";
import { STEPS, STEP_OF_PROBLEM, type StepKey, type StepProps } from "./steps";

/**
 * Step 6: everything at once, then submit. The server checks the whole
 * campaign and, when something is missing, names every piece; each one links
 * back to the step that fixes it - or, for money, offers "Add funds".
 *
 * Submitting sets the whole budget aside from the company's available money
 * at the price in force, so this step says both before the button is pressed.
 */
export function ReviewStep({ campaign, company, options, goTo }: StepProps) {
  const router = useRouter();
  const toast = useToast();
  const { reload } = useCompany();
  const checkout = useSearchParams().get("checkout");
  const [submitting, setSubmitting] = useState(false);
  const [problems, setProblems] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPricing(company.id).then((result) => {
      if (!cancelled && result.ok) setPricing(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  // The available balance is what submit draws on: read it fresh here, and
  // again shortly after coming back from paying, when the credit lands.
  useEffect(() => {
    reload();
    if (checkout !== "success") return;
    const timers = [3_000, 8_000].map((delay) => setTimeout(reload, delay));
    return () => timers.forEach(clearTimeout);
    // `reload` is stable for the page's life; run once per arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout]);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    const result = await submitCampaign(campaign.id);
    setSubmitting(false);

    if (!result.ok) {
      if (result.fieldErrors) {
        setProblems(result.fieldErrors);
        setError(null);
      } else {
        setProblems(null);
        setError(result.message);
      }
      return;
    }

    toast({
      title: "Submitted for review",
      description: `${formatCents(campaign.totalBudgetCents ?? 0, campaign.currency)} is set aside from your balance.`,
    });
    reload();
    router.push(`/campaigns/?id=${campaign.id}`);
  }

  const money = (cents: number | null) =>
    formatBudget(cents, campaign.currency);
  const budget = campaign.totalBudgetCents;
  const shortfall =
    budget !== null && company.balanceCents < budget
      ? budget - company.balanceCents
      : 0;
  const addFunds = (
    <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
      Add funds
    </Button>
  );

  return (
    <StepFrame
      title="Review and submit"
      description="Loopd'n reviews every campaign before it runs. While it's in review it can't be changed; you can withdraw it to edit."
      error={error}
      footer={
        <StepFooter
          onBack={() => goTo("creatives")}
          primaryLabel="Submit for review"
          onPrimary={submit}
          busy={submitting}
        />
      }
    >
      {checkout === "success" && (
        <Alert variant="success">
          Payment received. Your balance updates as soon as Stripe confirms it,
          usually within a minute; then submit.
        </Alert>
      )}

      {problems && (
        <Alert variant="error">
          <p className="font-semibold">Before it can be submitted:</p>
          <ul className="mt-1 space-y-1">
            {Object.entries(problems).map(([key, message]) => {
              const step = STEP_OF_PROBLEM[key];
              return (
                <li key={key}>
                  {message}
                  {key === "funds" && <div className="mt-1">{addFunds}</div>}
                  {step && (
                    <>
                      {" "}
                      <button
                        type="button"
                        className="font-semibold underline"
                        onClick={() => goTo(step)}
                      >
                        Go to {titleOf(step)}
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Alert>
      )}

      <Section title="Objective" onEdit={() => goTo("objective")}>
        <Row label="Name" value={campaignName(campaign)} />
        <Row
          label="Objective"
          value={CAMPAIGN_OBJECTIVE_LABEL[campaign.objective]}
        />
        <Row label="Company" value={company.name} />
      </Section>

      <Section title="Audience" onEdit={() => goTo("audience")}>
        <AudienceSummary
          audience={campaign.audience}
          country={campaign.country}
          options={options}
        />
      </Section>

      <Section title="Budget and schedule" onEdit={() => goTo("budget")}>
        <Row label="Total budget" value={money(campaign.totalBudgetCents)} />
        <Row
          label="Daily cap"
          value={
            campaign.dailyBudgetCents === null
              ? "No cap"
              : money(campaign.dailyBudgetCents)
          }
        />
        <Row
          label="Starts"
          value={
            campaign.startsAt
              ? formatDate(campaign.startsAt)
              : "As soon as it's approved"
          }
        />
        <Row
          label="Ends"
          value={
            campaign.endsAt
              ? formatDate(campaign.endsAt)
              : "When the budget is spent"
          }
        />
        <Row label="Pacing" value={CAMPAIGN_PACING_LABEL[campaign.pacing]} />
      </Section>

      <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Money
        </h3>
        <Row
          label="Price"
          value={
            pricing
              ? `${formatCents(pricing.cpmCents, campaign.currency)} per 1,000 views${
                  budget
                    ? ` · about ${Math.floor((budget * 1000) / pricing.cpmCents).toLocaleString()} views`
                    : ""
                }`
              : "Not available yet"
          }
        />
        <Row label="Set aside on submit" value={money(budget)} />
        <Row
          label="Available now"
          value={formatCents(company.balanceCents, company.currency)}
        />
        {shortfall > 0 && (
          <Alert variant="info">
            <p>
              You need {formatCents(shortfall, campaign.currency)} more to
              submit this budget.
            </p>
            <div className="mt-2">{addFunds}</div>
          </Alert>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The price is fixed when you submit. Anything not spent comes back to
          your balance if you withdraw it or when it ends.
        </p>
      </section>

      <Section title="Creatives" onEdit={() => goTo("creatives")}>
        {campaign.creatives.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            None yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {campaign.creatives.map((creative) => (
              <SponsoredCard
                key={creative.id}
                companyName={company.name}
                headline={creative.headline}
                body={creative.body}
                imageUrl={creative.imageUrl}
                ctaLabel={creative.ctaLabel}
                ctaKind={creative.ctaKind}
              />
            ))}
          </div>
        )}
      </Section>

      <AddFundsDialog
        company={company}
        isOpen={adding}
        onClose={() => setAdding(false)}
        suggestedCents={shortfall || undefined}
        returnPath={`/campaigns/new/?id=${campaign.id}&step=review`}
      />
    </StepFrame>
  );
}

function titleOf(step: StepKey): string {
  return (STEPS.find((item) => item.key === step)?.title ?? step).toLowerCase();
}

function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          Edit
        </button>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-x-4 text-sm sm:grid-cols-[8rem_1fr]">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  );
}

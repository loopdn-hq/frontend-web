"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Checkbox, Field, Input, RadioGroup } from "@/components/ui";
import { fetchPricing, updateCampaign } from "@/lib/commercial/api";
import { CAMPAIGN_PACING_LABEL, formatCents } from "@/lib/commercial/format";
import type { CampaignPacing, Pricing } from "@/lib/commercial/types";
import { StepFooter, StepFrame } from "./StepFrame";
import {
  dateInputValue,
  endOfDay,
  fromCents,
  startOfDay,
  toCents,
  tomorrow,
  type StepProps,
} from "./steps";

type Errors = {
  total?: string;
  daily?: string;
  start?: string;
  end?: string;
  form?: string;
};

// The API's field names, to this form's.
const FIELD_OF: Record<string, keyof Errors> = {
  total_budget_cents: "total",
  daily_budget_cents: "daily",
  starts_at: "start",
  ends_at: "end",
  pacing: "form",
};

/**
 * Step 4: how much, and when. Amounts are in the company's currency. A
 * campaign can start as soon as it is approved and run until its budget is
 * spent; dates are for a campaign that should wait or stop.
 */
export function BudgetStep({ campaign, company, onSaved, goTo }: StepProps) {
  const id = useId();
  const currency = campaign.currency;
  const [pricing, setPricing] = useState<Pricing | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPricing(company.id).then((result) => {
      if (!cancelled && result.ok) setPricing(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  const [total, setTotal] = useState(fromCents(campaign.totalBudgetCents));
  const [capped, setCapped] = useState(campaign.dailyBudgetCents !== null);
  const [daily, setDaily] = useState(fromCents(campaign.dailyBudgetCents));
  const [startMode, setStartMode] = useState<"approval" | "date">(
    campaign.startsAt ? "date" : "approval",
  );
  const [startDate, setStartDate] = useState(dateInputValue(campaign.startsAt));
  const [endMode, setEndMode] = useState<"budget" | "date">(
    campaign.endsAt ? "date" : "budget",
  );
  const [endDate, setEndDate] = useState(dateInputValue(campaign.endsAt));
  const [pacing, setPacing] = useState<CampaignPacing>(campaign.pacing);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const earliestStart = tomorrow();
  const earliestEnd =
    startMode === "date" && startDate && startDate >= earliestStart
      ? startDate
      : earliestStart;

  function check() {
    const found: Errors = {};
    const totalCents = toCents(total);
    const dailyCents = capped ? toCents(daily) : null;

    if (Number.isNaN(totalCents) || totalCents === 0) {
      found.total = "Enter an amount, like 1500 or 1500.50.";
    }
    if (
      capped &&
      (dailyCents === null || Number.isNaN(dailyCents) || dailyCents === 0)
    ) {
      found.daily = "Enter the most to spend in one day.";
    } else if (
      totalCents !== null &&
      dailyCents !== null &&
      !found.total &&
      dailyCents > totalCents
    ) {
      found.daily = "The daily cap can't be more than the total budget.";
    }
    if (startMode === "date" && !startDate)
      found.start = "Choose a start date.";
    else if (startMode === "date" && startDate < earliestStart) {
      found.start = "Choose a day from tomorrow on.";
    }
    if (endMode === "date" && !endDate) found.end = "Choose an end date.";
    else if (endMode === "date" && endDate < earliestEnd) {
      found.end = "The campaign must end after it starts.";
    }
    return { found, totalCents, dailyCents };
  }

  async function next() {
    if (saving) return;
    const { found, totalCents, dailyCents } = check();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const result = await updateCampaign(campaign.id, {
      totalBudgetCents: totalCents,
      dailyBudgetCents: dailyCents,
      startsAt: startMode === "date" ? startOfDay(startDate) : null,
      endsAt: endMode === "date" ? endOfDay(endDate) : null,
      pacing,
    });
    setSaving(false);

    if (!result.ok) {
      const next: Errors = {};
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        const mine = FIELD_OF[field];
        if (mine) next[mine] = message;
      }
      if (Object.keys(next).length === 0) next.form = result.message;
      setErrors(next);
      return;
    }

    onSaved(result.data);
    goTo("creatives");
  }

  return (
    <StepFrame
      title="Budget and schedule"
      description={`Amounts are in ${currency}, your company's currency.`}
      error={errors.form}
      footer={
        <StepFooter
          onBack={() => goTo("reach")}
          primaryLabel="Save and continue"
          onPrimary={next}
          busy={saving}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Total budget"
          htmlFor={`${id}-total`}
          hint={budgetHint(toCents(total), pricing, currency)}
          error={errors.total}
        >
          <Amount currency={currency}>
            <Input
              id={`${id}-total`}
              inputMode="decimal"
              value={total}
              placeholder="0.00"
              className="pl-14"
              state={errors.total ? "error" : "default"}
              onChange={(event) => setTotal(event.target.value)}
            />
          </Amount>
        </Field>

        <div className="space-y-2">
          <Checkbox
            label="Limit daily spending"
            checked={capped}
            onChange={(event) => setCapped(event.target.checked)}
          />
          {capped && (
            <Field
              label="Daily cap"
              htmlFor={`${id}-daily`}
              error={errors.daily}
            >
              <Amount currency={currency}>
                <Input
                  id={`${id}-daily`}
                  inputMode="decimal"
                  value={daily}
                  placeholder="0.00"
                  className="pl-14"
                  state={errors.daily ? "error" : "default"}
                  onChange={(event) => setDaily(event.target.value)}
                />
              </Amount>
            </Field>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DateChoice
          legend="Start"
          name={`${id}-start`}
          mode={startMode}
          modes={[
            { value: "approval", label: "As soon as it's approved" },
            { value: "date", label: "On a date" },
          ]}
          onMode={(value) => setStartMode(value as "approval" | "date")}
          showDate={startMode === "date"}
          date={startDate}
          min={earliestStart}
          onDate={setStartDate}
          error={errors.start}
        />
        <DateChoice
          legend="End"
          name={`${id}-end`}
          mode={endMode}
          modes={[
            { value: "budget", label: "When the budget is spent" },
            { value: "date", label: "On a date" },
          ]}
          onMode={(value) => setEndMode(value as "budget" | "date")}
          showDate={endMode === "date"}
          date={endDate}
          min={earliestEnd}
          onDate={setEndDate}
          error={errors.end}
        />
      </div>

      <div className="space-y-2">
        <p
          id={`${id}-pacing`}
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Pacing
        </p>
        <RadioGroup
          name={`${id}-pacing`}
          aria-labelledby={`${id}-pacing`}
          value={pacing}
          onChange={setPacing}
          options={[
            {
              value: "standard",
              label: CAMPAIGN_PACING_LABEL.standard,
              description: "Spread the budget across the campaign's days.",
            },
            {
              value: "accelerated",
              label: CAMPAIGN_PACING_LABEL.accelerated,
              description:
                "Show it as often as Loopd'n's limits allow until the budget is spent.",
            },
          ]}
        />
      </div>
    </StepFrame>
  );
}

/** An amount field with the currency code in front of it. */
function Amount({
  currency,
  children,
}: {
  currency: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-500 dark:text-slate-400">
        {currency}
      </span>
      {children}
    </div>
  );
}

function DateChoice({
  legend,
  name,
  mode,
  modes,
  onMode,
  showDate,
  date,
  min,
  onDate,
  error,
}: {
  legend: string;
  name: string;
  mode: string;
  modes: { value: string; label: string }[];
  onMode: (value: string) => void;
  showDate: boolean;
  date: string;
  min: string;
  onDate: (value: string) => void;
  error?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {legend}
      </legend>
      <RadioGroup
        name={name}
        value={mode}
        onChange={onMode}
        options={modes}
        variant="plain"
      />
      {showDate && (
        <Field label={`${legend} date`} htmlFor={`${name}-date`} error={error}>
          <Input
            id={`${name}-date`}
            type="date"
            value={date}
            min={min}
            state={error ? "error" : "default"}
            onChange={(event) => onDate(event.target.value)}
          />
        </Field>
      )}
    </fieldset>
  );
}

/** "About 10,000 views at PHP 50.00 per 1,000." once there is a budget. */
function budgetHint(
  cents: number | null,
  pricing: Pricing | null,
  currency: string,
): string {
  if (!pricing || cents === null || Number.isNaN(cents) || cents <= 0) {
    return "The most this campaign will spend.";
  }
  const views = Math.floor((cents * 1000) / pricing.cpmCents);
  return `About ${views.toLocaleString()} views at ${formatCents(pricing.cpmCents, currency)} per 1,000.`;
}

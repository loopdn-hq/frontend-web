"use client";

import { useId, useState } from "react";
import { Checkbox, Field, Input } from "@/components/ui";
import { saveAudience } from "@/lib/commercial/api";
import { countryName, regionsOf } from "@/lib/commercial/useCampaignOptions";
import { StepFooter, StepFrame } from "./StepFrame";
import type { StepProps } from "./steps";

/** Above this many regions (the US), a filter box helps find one. */
const FILTER_FROM = 20;

type Errors = {
  categories?: string;
  regions?: string;
  minGroupSize?: string;
  maxGroupSize?: string;
  form?: string;
};

/** A whole number of members, or null for nothing typed; NaN otherwise. */
function toSize(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) && Number(trimmed) > 0
    ? Number(trimmed)
    : Number.NaN;
}

/**
 * Step 2: who should see it - by what groups ARE, never by what anybody in
 * them says. Kind of group, region, and size; nothing finer, and never a list
 * of groups. Choosing nothing in a part means "any".
 */
export function AudienceStep({
  campaign,
  company,
  options,
  onSaved,
  goTo,
}: StepProps) {
  const id = useId();
  const saved = campaign.audience;
  const [categories, setCategories] = useState<string[]>(
    saved?.categories ?? [],
  );
  const [regions, setRegions] = useState<string[]>(saved?.regions ?? []);
  const [minSize, setMinSize] = useState(saved?.minGroupSize?.toString() ?? "");
  const [maxSize, setMaxSize] = useState(saved?.maxGroupSize?.toString() ?? "");
  const [filter, setFilter] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const country = countryName(options, company.country);
  const allRegions = regionsOf(options, company.country);
  const shownRegions = filter.trim()
    ? allRegions.filter((region) =>
        region.name.toLowerCase().includes(filter.trim().toLowerCase()),
      )
    : allRegions;

  function toggle(list: string[], value: string): string[] {
    return list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];
  }

  async function next() {
    if (saving) return;
    const minGroupSize = toSize(minSize);
    const maxGroupSize = toSize(maxSize);

    const found: Errors = {};
    if (Number.isNaN(minGroupSize))
      found.minGroupSize = "Enter a whole number.";
    if (Number.isNaN(maxGroupSize))
      found.maxGroupSize = "Enter a whole number.";
    if (
      !found.minGroupSize &&
      !found.maxGroupSize &&
      minGroupSize !== null &&
      maxGroupSize !== null &&
      maxGroupSize < minGroupSize
    ) {
      found.maxGroupSize = "The largest size can't be below the smallest.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const result = await saveAudience(campaign.id, {
      categories,
      regions,
      minGroupSize,
      maxGroupSize,
    });
    setSaving(false);

    if (!result.ok) {
      const fields = result.fieldErrors ?? {};
      const next: Errors = {
        categories: fields.categories,
        regions: fields.regions,
        minGroupSize: fields.min_group_size,
        maxGroupSize: fields.max_group_size,
      };
      setErrors(
        Object.values(next).some(Boolean) ? next : { form: result.message },
      );
      return;
    }

    onSaved(result.data);
    goTo("reach");
  }

  return (
    <StepFrame
      title="Who should see it?"
      description="Ads appear in group chats, chosen by what kind of group it is, where it is, and how big. Loopd'n never shows you which groups or who is in them."
      error={errors.form}
      footer={
        <StepFooter
          onBack={() => goTo("objective")}
          primaryLabel="Save and continue"
          onPrimary={next}
          busy={saving}
        />
      }
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Kinds of group
        </legend>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {categories.length === 0
            ? "None chosen: any kind of group."
            : categories.length === options.categories.length
              ? "All chosen: the same as any kind of group."
              : `${categories.length} chosen.`}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.categories.map((category) => (
            <Checkbox
              key={category.slug}
              label={category.label}
              checked={categories.includes(category.slug)}
              onChange={() =>
                setCategories((current) => toggle(current, category.slug))
              }
            />
          ))}
        </div>
        {errors.categories && (
          <p className="text-xs text-rose-600">{errors.categories}</p>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Where
        </legend>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {regions.length === 0
            ? `None chosen: anywhere in ${country}.`
            : regions.length === allRegions.length
              ? `All chosen: the same as anywhere in ${country}.`
              : `${regions.length} chosen.`}
          {regions.length > 0 && (
            <>
              {" "}
              <button
                type="button"
                className="font-medium text-sky-600 hover:underline dark:text-sky-400"
                onClick={() => setRegions([])}
              >
                Clear
              </button>
            </>
          )}
        </p>
        {allRegions.length > FILTER_FROM && (
          <Input
            aria-label="Find a region"
            placeholder="Find a region"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        )}
        <div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-800">
          {shownRegions.map((region) => (
            <Checkbox
              key={region.code}
              label={region.name}
              checked={regions.includes(region.code)}
              onChange={() =>
                setRegions((current) => toggle(current, region.code))
              }
            />
          ))}
          {shownRegions.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No region matches “{filter.trim()}”.
            </p>
          )}
        </div>
        {errors.regions && (
          <p className="text-xs text-rose-600">{errors.regions}</p>
        )}
      </fieldset>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Group size
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Optional. Very small groups never show ads, whatever you choose.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="At least"
            htmlFor={`${id}-min`}
            error={errors.minGroupSize}
          >
            <Input
              id={`${id}-min`}
              inputMode="numeric"
              value={minSize}
              placeholder="Any"
              state={errors.minGroupSize ? "error" : "default"}
              onChange={(event) => setMinSize(event.target.value)}
            />
          </Field>
          <Field
            label="At most"
            htmlFor={`${id}-max`}
            error={errors.maxGroupSize}
          >
            <Input
              id={`${id}-max`}
              inputMode="numeric"
              value={maxSize}
              placeholder="Any"
              state={errors.maxGroupSize ? "error" : "default"}
              onChange={(event) => setMaxSize(event.target.value)}
            />
          </Field>
        </div>
      </div>
    </StepFrame>
  );
}

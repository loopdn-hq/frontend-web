"use client";

/**
 * What kind of Loop this is and where it is - the two things an admin
 * declares about a group for ads to be matched on, and the only two
 * (docs/campaigns_final_plan.md, slice 4). Nothing is worked out from what
 * members write.
 *
 * `region` is one value on the server: a country ("PH") or one of its regions
 * ("PH-00"). Here it is two pickers, country then region, because "the whole
 * country" is a real answer and a long flat list would hide it.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Select } from "@/components/ui";
import { fetchGroupOptions, type GroupOptions } from "@/lib/chat/groupOptions";

const NOT_SET = "";

export function LoopKindAndPlace({
  category,
  region,
  disabled,
  categoryBusy,
  regionBusy,
  onCategory,
  onRegion,
}: {
  category: string | null;
  region: string;
  disabled?: boolean;
  categoryBusy?: boolean;
  regionBusy?: boolean;
  onCategory: (slug: string | null) => void;
  onRegion: (code: string) => void;
}) {
  const [options, setOptions] = useState<GroupOptions | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchGroupOptions().then((result) => {
      if (cancelled) return;
      if (result.ok) setOptions(result.data);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const country = region.split("-")[0] ?? "";
  const regions =
    options?.countries.find((item) => item.code === country)?.regions ?? [];
  const loading = !options;

  if (failed) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Couldn&apos;t load the choices. Reopen settings to try again.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Picker label="Kind of group">
        <Select
          aria-label="Kind of group"
          value={category ?? NOT_SET}
          disabled={disabled || loading || categoryBusy}
          options={[
            { value: NOT_SET, label: "Not set" },
            ...(options?.categories ?? []).map((item) => ({
              value: item.slug,
              label: item.label,
            })),
          ]}
          onChange={(event) => onCategory(event.target.value || null)}
          className="py-2.5"
        />
      </Picker>
      <Picker label="Country">
        <Select
          aria-label="Country"
          value={country}
          disabled={disabled || loading || regionBusy}
          options={[
            { value: NOT_SET, label: "Not set" },
            ...(options?.countries ?? []).map((item) => ({
              value: item.code,
              label: item.name,
            })),
          ]}
          // A new country starts as the whole of it.
          onChange={(event) => onRegion(event.target.value)}
          className="py-2.5"
        />
      </Picker>
      <Picker label="Region">
        <Select
          aria-label="Region"
          value={region}
          disabled={disabled || loading || regionBusy || !country}
          options={
            country
              ? [
                  { value: country, label: "The whole country" },
                  ...regions.map((item) => ({
                    value: item.code,
                    label: item.name,
                  })),
                ]
              : [{ value: NOT_SET, label: "Choose a country first" }]
          }
          onChange={(event) => onRegion(event.target.value)}
          className="py-2.5"
        />
      </Picker>
    </div>
  );
}

function Picker({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span
        aria-hidden="true"
        className="mb-1.5 block text-sm text-slate-600 dark:text-slate-300"
      >
        {label}
      </span>
      {children}
    </div>
  );
}

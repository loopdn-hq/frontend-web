"use client";

import { useId, useState } from "react";
import { Alert, Field, Input, RadioGroup } from "@/components/ui";
import { createCampaign, updateCampaign } from "@/lib/commercial/api";
import {
  CAMPAIGN_OBJECTIVE_HINT,
  CAMPAIGN_OBJECTIVE_LABEL,
} from "@/lib/commercial/format";
import type {
  CampaignDetail,
  CampaignObjective,
  Company,
} from "@/lib/commercial/types";
import { StepFooter, StepFrame } from "./StepFrame";
import type { StepKey } from "./steps";

/**
 * Call and text stay hidden until each campaign can have its own tracking
 * number (backend plan, decision 3). The server refuses them too.
 */
const OFFERED: CampaignObjective[] = [
  "website",
  "lead",
  "booking",
  "group_join",
];

/** A link button or a group-join button: what an objective's ads carry. */
function buttonOf(
  objective: CampaignObjective,
): "link" | "group_join" | "other" {
  if (objective === "group_join") return "group_join";
  if (objective === "call" || objective === "text") return "other";
  return "link";
}

/**
 * Step 1: what the campaign is for, and what to call it. Continuing from here
 * the first time is what creates the draft; it belongs to the company being
 * shown, which this step names so nobody builds one for the wrong company.
 */
export function ObjectiveStep({
  campaign,
  company,
  onCreated,
  onSaved,
  goTo,
}: {
  campaign: CampaignDetail | null;
  company: Company;
  onCreated: (campaign: CampaignDetail) => void;
  onSaved: (campaign: CampaignDetail) => void;
  goTo: (step: StepKey) => void;
}) {
  const id = useId();
  const [name, setName] = useState(campaign?.name ?? "");
  const [objective, setObjective] = useState<CampaignObjective>(
    campaign?.objective ?? "website",
  );
  const [errors, setErrors] = useState<{
    name?: string;
    objective?: string;
    form?: string;
  }>({});
  const [saving, setSaving] = useState(false);

  const buttonChanges =
    campaign !== null &&
    campaign.creatives.length > 0 &&
    buttonOf(objective) !== buttonOf(campaign.objective);

  async function next() {
    if (saving) return;
    const trimmed = name.trim();

    if (
      campaign &&
      trimmed === campaign.name &&
      objective === campaign.objective
    ) {
      goTo("audience");
      return;
    }

    setSaving(true);
    const result = campaign
      ? await updateCampaign(campaign.id, { name: trimmed, objective })
      : await createCampaign({
          companyId: company.id,
          objective,
          name: trimmed,
        });
    setSaving(false);

    if (!result.ok) {
      const fields = result.fieldErrors ?? {};
      setErrors(
        fields.name || fields.objective
          ? { name: fields.name, objective: fields.objective }
          : { form: result.message },
      );
      return;
    }

    setErrors({});
    if (campaign) {
      onSaved(result.data);
      goTo("audience");
    } else {
      onCreated(result.data);
    }
  }

  return (
    <StepFrame
      title="What is this campaign for?"
      description={
        <>
          For <strong>{company.name}</strong>. To build one for another of your
          companies, switch company first.
        </>
      }
      error={errors.form}
      footer={
        <StepFooter
          primaryLabel={campaign ? "Save and continue" : "Continue"}
          onPrimary={next}
          busy={saving}
        />
      }
    >
      <Field
        label="Campaign name"
        htmlFor={`${id}-name`}
        hint="Only you see this. It's needed before you submit."
        error={errors.name}
      >
        <Input
          id={`${id}-name`}
          value={name}
          maxLength={120}
          placeholder="Lunch deal, October"
          state={errors.name ? "error" : "default"}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>

      <div className="space-y-2">
        <p
          id={`${id}-objective`}
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Objective
        </p>
        <RadioGroup
          name={`${id}-objective`}
          aria-labelledby={`${id}-objective`}
          value={objective}
          onChange={setObjective}
          options={OFFERED.map((value) => ({
            value,
            label: CAMPAIGN_OBJECTIVE_LABEL[value],
            description: CAMPAIGN_OBJECTIVE_HINT[value],
          }))}
        />
        {errors.objective && (
          <p className="text-xs text-rose-600">{errors.objective}</p>
        )}
      </div>

      {buttonChanges && (
        <Alert variant="info">
          {objective === "group_join"
            ? "A group join's button opens your Loopd'n group, so your creatives' buttons will need your group's link before you submit."
            : "This objective's button opens a web address, so your creatives' buttons will need one before you submit."}
        </Alert>
      )}
    </StepFrame>
  );
}

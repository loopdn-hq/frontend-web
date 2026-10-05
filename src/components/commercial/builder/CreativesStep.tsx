"use client";

import { useEffect, useId, useState, type ChangeEvent } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { SponsoredCard } from "@/components/sponsored/SponsoredCard";
import {
  Alert,
  Button,
  Field,
  Input,
  Modal,
  Textarea,
  useToast,
} from "@/components/ui";
import {
  addCreative,
  deleteCreative,
  updateCreative,
} from "@/lib/commercial/api";
import type {
  CampaignDetail,
  Creative,
  CreativeInput,
} from "@/lib/commercial/types";
import { StepFooter, StepFrame } from "./StepFrame";
import { withScheme, type StepProps } from "./steps";

// The backend's limits: Creative's columns, MAX_CREATIVES_PER_CAMPAIGN and
// MAX_CREATIVE_IMAGE_UPLOAD_BYTES. Checked here first so a mistake shows
// before anything is uploaded.
const MAX_HEADLINE = 80;
const MAX_BODY = 500;
const MAX_LABEL = 30;
const MAX_CREATIVES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Step 5: what the ad says and shows. Up to five versions; each is saved
 * whole - headline, text, button and where it goes - from its own form.
 */
export function CreativesStep({ campaign, company, onSaved, goTo }: StepProps) {
  const toast = useToast();
  // null: closed. "new": adding one. A creative: editing it.
  const [editing, setEditing] = useState<Creative | "new" | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function replaceCreatives(creatives: Creative[]): CampaignDetail {
    return { ...campaign, creatives };
  }

  function saved(creative: Creative) {
    const exists = campaign.creatives.some((item) => item.id === creative.id);
    onSaved(
      replaceCreatives(
        exists
          ? campaign.creatives.map((item) =>
              item.id === creative.id ? creative : item,
            )
          : [...campaign.creatives, creative],
      ),
    );
    toast({ title: exists ? "Creative saved" : "Creative added" });
    setEditing(null);
  }

  async function remove(creative: Creative) {
    setRemoving(creative.id);
    const result = await deleteCreative(creative.id);
    setRemoving(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    onSaved(
      replaceCreatives(
        campaign.creatives.filter((item) => item.id !== creative.id),
      ),
    );
  }

  const full = campaign.creatives.length >= MAX_CREATIVES;

  return (
    <StepFrame
      title="Creatives"
      description="What people see in the chat. Add up to five versions of the ad; each is reviewed before it runs."
      error={error}
      footer={
        <StepFooter
          onBack={() => goTo("budget")}
          primaryLabel="Continue"
          onPrimary={() => goTo("review")}
        />
      }
    >
      {campaign.creatives.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No creatives yet. A campaign needs at least one before you submit it.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {campaign.creatives.map((creative) => (
            <li key={creative.id} className="space-y-2">
              <SponsoredCard
                companyName={company.name}
                headline={creative.headline}
                body={creative.body}
                imageUrl={creative.imageUrl}
                ctaLabel={creative.ctaLabel}
                ctaKind={creative.ctaKind}
              />
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {creative.ctaKind === "lead_form"
                  ? "Opens a Loopd'n form"
                  : `Opens ${creative.ctaTarget}`}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing(creative)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(creative)}
                  disabled={removing === creative.id}
                  aria-label={`Remove “${creative.headline}”`}
                >
                  {removing === creative.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          That&apos;s the most a campaign can have. Remove one to add another.
        </p>
      ) : (
        <Button variant="secondary" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden />
          Add a creative
        </Button>
      )}

      {editing !== null && (
        <CreativeEditor
          key={editing === "new" ? "new" : editing.id}
          campaign={campaign}
          companyName={company.name}
          creative={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </StepFrame>
  );
}

type Errors = Partial<Record<keyof CreativeInput | "form", string>>;

const FIELD_OF: Record<string, keyof Errors> = {
  headline: "headline",
  body: "body",
  cta_label: "ctaLabel",
  cta_target: "ctaTarget",
  cta_kind: "ctaTarget",
  image: "image",
};

function CreativeEditor({
  campaign,
  companyName,
  creative,
  onClose,
  onSaved,
}: {
  campaign: CampaignDetail;
  companyName: string;
  creative: Creative | null;
  onClose: () => void;
  onSaved: (creative: Creative) => void;
}) {
  const id = useId();
  const groupJoin = campaign.objective === "group_join";
  // A lead campaign's button opens Loopd'n's own form: no address to give.
  const leadForm = campaign.objective === "lead";

  const [headline, setHeadline] = useState(creative?.headline ?? "");
  const [body, setBody] = useState(creative?.body ?? "");
  const [ctaLabel, setCtaLabel] = useState(
    creative?.ctaLabel ??
      (groupJoin ? "Join the group" : leadForm ? "Get a quote" : "Learn more"),
  );
  const [ctaTarget, setCtaTarget] = useState(creative?.ctaTarget ?? "");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  // The preview is an object URL, which lives until it is revoked.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((current) => ({
        ...current,
        image: "Keep the image under 5MB.",
      }));
      return;
    }
    setErrors((current) => ({ ...current, image: undefined }));
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setRemoveImage(false);
  }

  function dropImage() {
    setImage(null);
    setPreview(null);
    setRemoveImage(Boolean(creative?.imageUrl));
  }

  async function save() {
    if (saving) return;
    const found: Errors = {};
    if (!headline.trim()) found.headline = "Write a headline.";
    if (!body.trim()) found.body = "Write what the ad says.";
    if (!ctaLabel.trim()) found.ctaLabel = "Label the button.";
    if (!leadForm && !ctaTarget.trim()) {
      found.ctaTarget = groupJoin
        ? "Paste your group's Loopd'n link."
        : "Enter where the button goes.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const input: CreativeInput = {
      headline: headline.trim(),
      body: body.trim(),
      ctaLabel: ctaLabel.trim(),
      ctaTarget: leadForm ? "" : withScheme(ctaTarget),
    };
    if (image) input.image = image;
    else if (removeImage) input.image = null;

    setSaving(true);
    const result = creative
      ? await updateCreative(creative.id, input)
      : await addCreative(campaign.id, input);
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
  }

  const shownImage =
    preview ?? (removeImage ? null : (creative?.imageUrl ?? null));

  return (
    <Modal
      isOpen
      onClose={() => !saving && onClose()}
      title={creative ? "Edit creative" : "Add a creative"}
      maxWidthClassName="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {creative ? "Save creative" : "Add creative"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <fieldset disabled={saving} className="min-w-0 space-y-4">
          {errors.form && <Alert variant="error">{errors.form}</Alert>}

          <Field
            label="Headline"
            htmlFor={`${id}-headline`}
            hint={`${headline.length}/${MAX_HEADLINE}`}
            error={errors.headline}
          >
            <Input
              id={`${id}-headline`}
              value={headline}
              maxLength={MAX_HEADLINE}
              state={errors.headline ? "error" : "default"}
              onChange={(event) => setHeadline(event.target.value)}
            />
          </Field>

          <Field
            label="Text"
            htmlFor={`${id}-body`}
            hint={`${body.length}/${MAX_BODY}`}
            error={errors.body}
          >
            <Textarea
              id={`${id}-body`}
              value={body}
              rows={4}
              maxLength={MAX_BODY}
              state={errors.body ? "error" : "default"}
              onChange={(event) => setBody(event.target.value)}
            />
          </Field>

          <Field
            label="Image"
            htmlFor={`${id}-image`}
            hint="Optional. PNG or JPG, under 5MB. Wide images fit best."
            error={errors.image}
          >
            <div className="flex items-center gap-2">
              <label
                htmlFor={`${id}-image`}
                className="inline-flex min-h-9 cursor-pointer items-center rounded-xl bg-sky-50 px-3 text-sm font-semibold text-sky-600 transition hover:bg-sky-100 dark:bg-slate-800 dark:text-sky-400 dark:hover:bg-slate-700"
              >
                {shownImage ? "Change image" : "Upload image"}
              </label>
              <input
                id={`${id}-image`}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={chooseImage}
              />
              {shownImage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dropImage}
                  aria-label="Remove image"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Button label"
              htmlFor={`${id}-label`}
              hint={`${ctaLabel.length}/${MAX_LABEL}`}
              error={errors.ctaLabel}
            >
              <Input
                id={`${id}-label`}
                value={ctaLabel}
                maxLength={MAX_LABEL}
                state={errors.ctaLabel ? "error" : "default"}
                onChange={(event) => setCtaLabel(event.target.value)}
              />
            </Field>
            {leadForm ? (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  Opens a Loopd&apos;n form
                </p>
                <p className="mt-0.5">
                  People send their name, phone or email and a message, and
                  choose what to share. You&apos;ll find them under Leads.
                </p>
                {errors.ctaTarget && (
                  <p className="mt-1 text-rose-600 dark:text-rose-400">
                    {errors.ctaTarget}
                  </p>
                )}
              </div>
            ) : (
              <Field
                label={
                  groupJoin ? "Your group's Loopd'n link" : "Where it goes"
                }
                htmlFor={`${id}-target`}
                hint={
                  groupJoin
                    ? "The link to your group on Loopd'n."
                    : "Must start with https://."
                }
                error={errors.ctaTarget}
              >
                <Input
                  id={`${id}-target`}
                  type="url"
                  inputMode="url"
                  value={ctaTarget}
                  placeholder={
                    groupJoin
                      ? "https://loopdn.com/…"
                      : "https://www.example.com"
                  }
                  state={errors.ctaTarget ? "error" : "default"}
                  onChange={(event) => setCtaTarget(event.target.value)}
                />
              </Field>
            )}
          </div>
        </fieldset>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Preview
          </p>
          <div className="md:w-72">
            <SponsoredCard
              companyName={companyName}
              headline={headline}
              body={body}
              imageUrl={shownImage}
              ctaLabel={ctaLabel}
              ctaKind={
                groupJoin ? "group_join" : leadForm ? "lead_form" : "link"
              }
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

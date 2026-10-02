"use client";

/**
 * A sponsored card's lead form (slice 7a of
 * backend/docs/campaigns_final_plan.md): the member sends a company their
 * details without leaving the app.
 *
 * It starts from their profile - name, and the phone and email Loopd'n has
 * verified - and they change or clear anything before sending. Only what is
 * in the form when they press Send reaches the company, with the sentence
 * shown above the button; nothing about the group they saw it in. Once sent,
 * a second send to the same campaign is refused, and the form says so.
 */
import { useEffect, useId, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  Alert,
  Button,
  Field,
  Input,
  Modal,
  Skeleton,
  SkeletonRegion,
  Textarea,
} from "@/components/ui";
import {
  openLeadForm,
  sendLead,
  type LeadDetails,
  type LeadForm,
} from "@/lib/chat/sponsored";

type Errors = Partial<Record<keyof LeadDetails | "form", string>>;

export function LeadFormModal({
  formToken,
  isOpen,
  onClose,
}: {
  formToken: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const id = useId();
  const [form, setForm] = useState<LeadForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [details, setDetails] = useState<LeadDetails>({
    name: "",
    phone: "",
    email: "",
    message: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!isOpen || form) return;
    let cancelled = false;
    openLeadForm(formToken).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setForm(result.data);
      setDetails({ ...result.data.fields, message: "" });
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, form, formToken]);

  function change(field: keyof LeadDetails, value: string) {
    setDetails((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      form: undefined,
    }));
  }

  async function send() {
    if (sending) return;
    const found: Errors = {};
    if (!details.name.trim()) found.name = "Enter your name.";
    if (!details.phone.trim() && !details.email.trim()) {
      found.phone =
        "Give a phone number or an email address, so they can reach you.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSending(true);
    const result = await sendLead(formToken, details);
    setSending(false);
    if (!result.ok) {
      const next: Errors = {};
      for (const field of ["name", "phone", "email", "message"] as const) {
        const message = result.fieldErrors?.[field];
        if (message) next[field] = message;
      }
      if (Object.keys(next).length === 0) next.form = result.message;
      setErrors(next);
      return;
    }
    setSent(true);
  }

  const company = form?.companyName ?? "the company";

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !sending && onClose()}
      title={form ? form.headline : "Send your details"}
      description={form ? `To ${company}` : undefined}
      footer={
        sent || form?.alreadySent ? (
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={send} disabled={!form || sending}>
              {sending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              Send
            </Button>
          </div>
        )
      }
    >
      {loadError ? (
        <Alert variant="error">{loadError}</Alert>
      ) : !form ? (
        <SkeletonRegion label="Opening the form" className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </SkeletonRegion>
      ) : sent || form.alreadySent ? (
        <div className="flex gap-3">
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {sent
              ? `Sent. ${company} will get in touch with you.`
              : `You've already sent your details to ${company} for this.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {errors.form && <Alert variant="error">{errors.form}</Alert>}
          <Field label="Name" htmlFor={`${id}-name`} error={errors.name}>
            <Input
              id={`${id}-name`}
              value={details.name}
              maxLength={120}
              autoComplete="name"
              state={errors.name ? "error" : "default"}
              onChange={(event) => change("name", event.target.value)}
            />
          </Field>
          <Field
            label="Phone"
            htmlFor={`${id}-phone`}
            hint="International format, e.g. +639171234567. Clear it to not share it."
            error={errors.phone}
          >
            <Input
              id={`${id}-phone`}
              type="tel"
              value={details.phone}
              maxLength={32}
              autoComplete="tel"
              state={errors.phone ? "error" : "default"}
              onChange={(event) => change("phone", event.target.value)}
            />
          </Field>
          <Field
            label="Email"
            htmlFor={`${id}-email`}
            hint="Clear it to not share it."
            error={errors.email}
          >
            <Input
              id={`${id}-email`}
              type="email"
              value={details.email}
              maxLength={254}
              autoComplete="email"
              state={errors.email ? "error" : "default"}
              onChange={(event) => change("email", event.target.value)}
            />
          </Field>
          <Field
            label="Message (optional)"
            htmlFor={`${id}-message`}
            error={errors.message}
          >
            <Textarea
              id={`${id}-message`}
              value={details.message}
              maxLength={500}
              rows={3}
              onChange={(event) => change("message", event.target.value)}
            />
          </Field>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {form.consent}
          </p>
        </div>
      )}
    </Modal>
  );
}

"use client";

import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Button, Field, Input, Modal } from "@/components/ui";
import { fetchMarkets, startCheckout } from "@/lib/commercial/api";
import { formatCents } from "@/lib/commercial/format";
import type { Company } from "@/lib/commercial/types";
import { cn } from "@/lib/ui/cn";
import { fromCents, toCents } from "./builder/steps";

/**
 * "Add funds": how much, then off to Stripe Checkout to pay by card.
 *
 * Nothing is credited here or on the way back. The money arrives when
 * Stripe's webhook says the payment cleared - usually seconds later - so the
 * page it returns to says so rather than promising a balance it can't see yet.
 *
 * `returnPath` is where Stripe sends the person back to, with
 * `checkout=success` or `checkout=cancelled` added: the Billing page, or the
 * builder step that ran short.
 */
export function AddFundsDialog({
  company,
  isOpen,
  onClose,
  suggestedCents,
  returnPath = "/balance/",
}: {
  company: Company;
  isOpen: boolean;
  onClose: () => void;
  /** What to start the amount at, e.g. how much a submit was short. */
  suggestedCents?: number;
  returnPath?: string;
}) {
  const id = useId();
  const [minimum, setMinimum] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The least one payment may be, per currency, as the server sets it.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetchMarkets().then((result) => {
      if (cancelled || !result.ok) return;
      const least =
        result.data.currencies.find((item) => item.code === company.currency)
          ?.minTopUpCents ?? 0;
      setMinimum(least);
      setAmount((current) =>
        current
          ? current
          : fromCents(Math.max(least, suggestedCents ?? 0) || null),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, company.currency, suggestedCents]);

  const presets = minimum
    ? [minimum, minimum * 2, minimum * 10].filter(
        (value, index, all) => all.indexOf(value) === index,
      )
    : [];

  async function pay() {
    if (busy) return;
    const cents = toCents(amount);
    if (cents === null || Number.isNaN(cents) || cents <= 0) {
      setError("Enter an amount, like 1000 or 1000.50.");
      return;
    }
    if (minimum && cents < minimum) {
      setError(`Add at least ${formatCents(minimum, company.currency)}.`);
      return;
    }

    const back = (state: "success" | "cancelled") =>
      `${window.location.origin}${returnPath}${returnPath.includes("?") ? "&" : "?"}checkout=${state}`;

    setBusy(true);
    setError(null);
    const result = await startCheckout(company.id, {
      amountCents: cents,
      successUrl: back("success"),
      cancelUrl: back("cancelled"),
    });
    if (!result.ok) {
      setBusy(false);
      setError(result.fieldErrors?.amount_cents ?? result.message);
      return;
    }
    // Leaving for Stripe: stay "busy" so the button can't open a second one.
    window.location.assign(result.data);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title="Add funds"
      description={`Pay by card through Stripe. Funds are in ${company.currency} and go to ${company.name}'s balance.`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={pay} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Continue to payment
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <Field
          label="Amount"
          htmlFor={`${id}-amount`}
          hint={
            minimum
              ? `At least ${formatCents(minimum, company.currency)}.`
              : undefined
          }
        >
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-500 dark:text-slate-400">
              {company.currency}
            </span>
            <Input
              id={`${id}-amount`}
              inputMode="decimal"
              value={amount}
              placeholder="0.00"
              className="pl-14"
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
        </Field>
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {presets.map((cents) => (
              <button
                key={cents}
                type="button"
                onClick={() => setAmount(fromCents(cents))}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition",
                  toCents(amount) === cents
                    ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                    : "border-slate-200 text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:text-slate-300",
                )}
              >
                {formatCents(cents, company.currency)}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

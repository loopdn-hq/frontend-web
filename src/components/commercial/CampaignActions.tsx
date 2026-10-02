"use client";

import { useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { toCents } from "@/components/commercial/builder/steps";
import { Alert, Button, Field, Input, Modal, useToast } from "@/components/ui";
import {
  cancelCampaign,
  deleteCampaign,
  increaseBudget,
  pauseCampaign,
  resumeCampaign,
  withdrawCampaign,
} from "@/lib/commercial/api";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import { campaignName, formatCents } from "@/lib/commercial/format";
import type { Campaign, CampaignDetail } from "@/lib/commercial/types";

/**
 * The owner's moves a campaign list and a campaign page both offer: delete a
 * draft, withdraw one from review, pause, resume, cancel, add budget. The ones
 * that can't be taken back ask first; each says what happened. The server
 * decides whether the move is allowed; these only offer it when the status
 * says it should be.
 */

export function DeleteDraftButton({
  campaign,
  size = "sm",
  onDeleted,
}: {
  campaign: Campaign;
  size?: "sm" | "md";
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size={size} onClick={() => setOpen(true)}>
        Delete
      </Button>
      <DeleteDraftDialog
        campaign={campaign}
        isOpen={open}
        onClose={() => setOpen(false)}
        onDeleted={onDeleted}
      />
    </>
  );
}

/** The confirmation on its own, for a trigger that is not a button - a menu item. */
export function DeleteDraftDialog({
  campaign,
  isOpen,
  onClose,
  onDeleted,
}: {
  campaign: Campaign;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    const result = await deleteCampaign(campaign.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    onClose();
    toast({ title: "Draft deleted" });
    onDeleted();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (busy) return;
        setError(null);
        onClose();
      }}
      title="Delete this draft?"
      description={`“${campaignName(campaign)}” and its creatives will be gone for good.`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Keep it
          </Button>
          <Button variant="danger" onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Delete draft
          </Button>
        </div>
      }
    >
      {error && <Alert variant="error">{error}</Alert>}
    </Modal>
  );
}

export function WithdrawButton({
  campaign,
  size = "sm",
  onWithdrawn,
}: {
  campaign: Campaign;
  size?: "sm" | "md";
  onWithdrawn: (campaign: CampaignDetail) => void;
}) {
  const toast = useToast();
  const { reload } = useCompany();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    const result = await withdrawCampaign(campaign.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(false);
    toast({
      title: "Withdrawn from review",
      description:
        campaign.reservedCents > 0
          ? `${formatCents(campaign.reservedCents, campaign.currency)} is back in your balance. It's a draft again.`
          : "It's a draft again. Submit it when you're ready.",
    });
    reload();
    onWithdrawn(result.data);
  }

  return (
    <>
      <Button
        variant="secondary"
        size={size}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Withdraw
      </Button>
      <Modal
        isOpen={open}
        onClose={() => !busy && setOpen(false)}
        title="Withdraw from review?"
        description="It goes back to being a draft you can change, and its budget returns to your balance. It will need to be reviewed again once you resubmit it."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Leave it in review
            </Button>
            <Button onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Withdraw
            </Button>
          </div>
        }
      >
        {error && <Alert variant="error">{error}</Alert>}
      </Modal>
    </>
  );
}

/**
 * Raise a running or paused campaign's total budget. Only ever up: the
 * difference is set aside from the available balance straight away.
 */
export function AddBudgetButton({
  campaign,
  onRaised,
}: {
  campaign: Campaign;
  onRaised: (campaign: CampaignDetail) => void;
}) {
  const id = useId();
  const toast = useToast();
  const { company, reload } = useCompany();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = campaign.totalBudgetCents ?? 0;
  const money = (cents: number) => formatCents(cents, campaign.currency);

  async function confirm() {
    const next = toCents(amount);
    if (next === null || Number.isNaN(next) || next <= current) {
      setError(`Enter a new total above ${money(current)}.`);
      return;
    }
    setBusy(true);
    const result = await increaseBudget(campaign.id, next);
    setBusy(false);
    if (!result.ok) {
      setError(
        result.fieldErrors?.funds ??
          result.fieldErrors?.total_budget_cents ??
          result.message,
      );
      return;
    }
    setOpen(false);
    toast({
      title: "Budget raised",
      description: `${money(next - current)} more is set aside for this campaign.`,
    });
    reload();
    onRaised(result.data);
  }

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        onClick={() => {
          setError(null);
          setAmount("");
          setOpen(true);
        }}
      >
        Add budget
      </Button>
      <Modal
        isOpen={open}
        onClose={() => !busy && setOpen(false)}
        title="Add budget"
        description={`The total is ${money(current)} now. A budget can only go up; the difference is set aside from your available balance.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Raise budget
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {error && <Alert variant="error">{error}</Alert>}
          <Field
            label="New total budget"
            htmlFor={`${id}-total`}
            hint={
              company
                ? `Available: ${formatCents(company.balanceCents, company.currency)}`
                : undefined
            }
          >
            <Input
              id={`${id}-total`}
              inputMode="decimal"
              value={amount}
              placeholder={String(Math.round(current / 100) + 1000)}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}

/**
 * Pause a running campaign, or resume a paused one. No question first: both
 * are undone by the other, and the money stays set aside either way.
 */
export function PauseResumeButton({
  campaign,
  onChanged,
}: {
  campaign: Campaign;
  onChanged: (campaign: CampaignDetail) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pausing = campaign.status === "running";

  async function move() {
    setBusy(true);
    const result = await (pausing ? pauseCampaign : resumeCampaign)(
      campaign.id,
    );
    setBusy(false);
    if (!result.ok) {
      toast({
        title: pausing ? "Couldn't pause it" : "Couldn't resume it",
        description: result.message,
        tone: "error",
      });
      return;
    }
    toast(
      pausing
        ? {
            title: "Campaign paused",
            description:
              "It isn't shown while it's paused. Its budget stays set aside.",
          }
        : { title: "Campaign resumed", description: "It's running again." },
    );
    onChanged(result.data);
  }

  return (
    <Button variant="secondary" size="md" onClick={move} disabled={busy}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pausing ? "Pause" : "Resume"}
    </Button>
  );
}

/**
 * End an approved, running or paused campaign for good. Asks first: it can't
 * be undone, and says how much comes back to the balance.
 */
export function CancelCampaignButton({
  campaign,
  onCancelled,
}: {
  campaign: Campaign;
  onCancelled: (campaign: CampaignDetail) => void;
}) {
  const toast = useToast();
  const { reload } = useCompany();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const left = formatCents(campaign.reservedCents, campaign.currency);

  async function confirm() {
    setBusy(true);
    const result = await cancelCampaign(campaign.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(false);
    toast({
      title: "Campaign cancelled",
      description:
        campaign.reservedCents > 0
          ? `${left} is back in your balance.`
          : "It won't be shown again.",
    });
    reload();
    onCancelled(result.data);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="md"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Cancel campaign
      </Button>
      <Modal
        isOpen={open}
        onClose={() => !busy && setOpen(false)}
        title="Cancel this campaign?"
        description={
          campaign.reservedCents > 0
            ? `It stops for good and won't be shown again. The ${left} it hasn't spent goes back to your balance.`
            : "It stops for good and won't be shown again."
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Keep it
            </Button>
            <Button variant="danger" onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Cancel campaign
            </Button>
          </div>
        }
      >
        {error && <Alert variant="error">{error}</Alert>}
      </Modal>
    </>
  );
}

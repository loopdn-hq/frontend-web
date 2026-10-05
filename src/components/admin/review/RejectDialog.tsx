"use client";

import { useId, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Modal,
  Textarea,
} from "@/components/ui";
import { rejectCampaign } from "@/lib/admin/api";
import type { ReviewCampaign } from "@/lib/admin/types";

/**
 * "Send back": why, for the company to read, and - optionally - which
 * creatives were the problem, each with its own note. The campaign returns to
 * a draft and its reserved money to the company's balance.
 */
export function RejectDialog({
  campaign,
  isOpen,
  onClose,
  onRejected,
}: {
  campaign: ReviewCampaign;
  isOpen: boolean;
  onClose: () => void;
  onRejected: (campaign: ReviewCampaign) => void;
}) {
  const id = useId();
  const [note, setNote] = useState("");
  // Creative id -> its note; present means "this one is rejected".
  const [flagged, setFlagged] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(creativeId: number) {
    setFlagged((current) => {
      const next = { ...current };
      if (creativeId in next) delete next[creativeId];
      else next[creativeId] = "";
      return next;
    });
  }

  async function send() {
    if (busy) return;
    if (!note.trim()) {
      setError("Say why, so the company knows what to fix.");
      return;
    }
    const missing = Object.entries(flagged).some(([, text]) => !text.trim());
    if (missing) {
      setError("Add a note to each creative you marked, or unmark it.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await rejectCampaign(campaign.id, {
      note: note.trim(),
      creatives: Object.entries(flagged).map(([creativeId, text]) => ({
        id: Number(creativeId),
        note: text.trim(),
      })),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onRejected(result.data);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title="Send back to the company"
      description={`"${campaign.name}" returns to ${campaign.company.name} as a draft, with your notes, and its budget goes back to their balance.`}
      maxWidthClassName="max-w-2xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={send} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Send back
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <Field
          label="Why"
          htmlFor={`${id}-note`}
          hint="The company reads this, so say what to change."
        >
          <Textarea
            id={`${id}-note`}
            rows={3}
            value={note}
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>

        {campaign.creatives.length > 0 && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Which creatives? (optional)
            </legend>
            {campaign.creatives.map((creative) => {
              const marked = creative.id in flagged;
              return (
                <div key={creative.id} className="space-y-2">
                  <Checkbox
                    label={creative.headline}
                    checked={marked}
                    onChange={() => toggle(creative.id)}
                  />
                  {marked && (
                    <Textarea
                      aria-label={`What to change in "${creative.headline}"`}
                      placeholder="What to change in this one"
                      rows={2}
                      maxLength={2000}
                      value={flagged[creative.id]}
                      onChange={(event) =>
                        setFlagged((current) => ({
                          ...current,
                          [creative.id]: event.target.value,
                        }))
                      }
                    />
                  )}
                </div>
              );
            })}
          </fieldset>
        )}
      </div>
    </Modal>
  );
}

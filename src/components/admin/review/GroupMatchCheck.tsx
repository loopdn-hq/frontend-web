"use client";

import { useId, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Alert, Badge, Button, Input } from "@/components/ui";
import { checkGroupMatch } from "@/lib/admin/api";
import type { GroupMatch } from "@/lib/admin/types";

/**
 * "Why isn't this ad showing in that group?" - one group, by its number,
 * held against the campaign's audience with every rule named. For admins
 * only: which groups a campaign reaches is never shown to a company.
 */
export function GroupMatchCheck({ campaignId }: { campaignId: number }) {
  const id = useId();
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GroupMatch | null>(null);

  async function check(event: FormEvent) {
    event.preventDefault();
    const number = Number(groupId.trim());
    if (!Number.isInteger(number) || number <= 0) {
      setError("Enter the group's number, e.g. 42.");
      setResult(null);
      return;
    }
    setBusy(true);
    const answer = await checkGroupMatch(campaignId, number);
    setBusy(false);
    if (!answer.ok) {
      setError(answer.message);
      setResult(null);
      return;
    }
    setError(null);
    setResult(answer.data);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={check} className="flex items-end gap-2">
        <label htmlFor={`${id}-group`} className="min-w-0 flex-1">
          <span className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
            Does a group match? Its number
          </span>
          <Input
            id={`${id}-group`}
            inputMode="numeric"
            placeholder="42"
            value={groupId}
            className="h-10 py-0"
            onChange={(event) => setGroupId(event.target.value)}
          />
        </label>
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Check
        </Button>
      </form>

      {error && <Alert variant="error">{error}</Alert>}

      {result && (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {result.group.name || `Group ${result.group.id}`}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              #{result.group.id} · {result.group.memberCount} active members
            </span>
            <Badge tone={result.matches ? "success" : "danger"}>
              {result.matches ? "Matches" : "Doesn't match"}
            </Badge>
          </p>
          <ul className="space-y-1.5">
            {result.checks.map((rule) => {
              const Icon = rule.passed ? CheckCircle2 : XCircle;
              return (
                <li key={rule.code} className="flex gap-2 text-sm">
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      rule.passed
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                    aria-label={rule.passed ? "Passes" : "Fails"}
                  />
                  <span className="min-w-0">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {rule.label}
                    </span>
                    <span className="block text-slate-600 dark:text-slate-400">
                      {rule.detail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This is the audience only. Ads also need the campaign to be running
            and funded.
          </p>
        </div>
      )}
    </div>
  );
}

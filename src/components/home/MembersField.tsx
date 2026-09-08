"use client";

import { useRef, useState } from "react";
import {
  isDuplicateMember,
  parseMember,
  splitMemberInput,
  type MemberEntry,
} from "@/lib/chat/members";

type MembersFieldProps = {
  value: MemberEntry[];
  onChange: (entries: MemberEntry[]) => void;
  /**
   * Uncommitted text, mirrored up so the form can fold it in on submit.
   * Relying on the input's own blur would leave the last name typed at the
   * mercy of whether blur beats click.
   */
  onPendingChange?: (text: string) => void;
  disabled?: boolean;
};

const kindLabel: Record<MemberEntry["kind"], string> = {
  username: "Username",
  email: "Email",
  phone: "Phone",
};

const kindChip: Record<MemberEntry["kind"], string> = {
  username:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200",
  email:
    "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200",
  phone:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};

/**
 * Free-text entry for the people to invite, one chip per person.
 *
 * Committed on Enter, comma or blur rather than on every keystroke, because
 * half a typed email is not an error yet - flagging it while somebody is still
 * typing is how a field ends up shouting at its user.
 */
export function MembersField({
  value,
  onChange,
  onPendingChange,
  disabled,
}: MembersFieldProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function updateDraft(text: string) {
    setDraft(text);
    onPendingChange?.(text);
  }

  function commit(text: string): boolean {
    const candidates = splitMemberInput(text);
    if (candidates.length === 0) return true;

    // Every candidate is judged. Stopping at the first bad one would silently
    // swallow everything after it - paste "ana, !!, bo" and bo disappears.
    const accepted: MemberEntry[] = [];
    const rejected: string[] = [];
    let firstMessage = "";

    for (const candidate of candidates) {
      const result = parseMember(candidate);
      if (!result.ok) {
        rejected.push(result.raw);
        if (!firstMessage) firstMessage = result.message;
        continue;
      }
      if (
        isDuplicateMember(value, result.entry) ||
        isDuplicateMember(accepted, result.entry)
      ) {
        continue;
      }
      accepted.push(result.entry);
    }

    if (accepted.length > 0) onChange([...value, ...accepted]);
    // Whatever failed stays in the box so it can be corrected rather than
    // retyped; everything that parsed is already a chip.
    updateDraft(rejected.join(", "));
    setError(
      rejected.length > 1
        ? `${rejected.length} entries were not recognised. Fix or remove them.`
        : firstMessage,
    );
    return rejected.length === 0;
  }

  function remove(index: number) {
    onChange(value.filter((_, position) => position !== index));
    setError("");
  }

  return (
    <div>
      <label
        htmlFor="loop-members"
        className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100"
      >
        Members
      </label>
      {/* Deliberately a sibling of the label, not inside it: the chips carry
          remove buttons, and interactive elements nested in a <label> make the
          input's accessible name the entire chip list. */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={`flex w-full flex-wrap items-center gap-2 rounded-xl border px-3 py-2 transition focus-within:ring-4 focus-within:ring-sky-100 ${
          error
            ? "border-rose-300 focus-within:border-rose-500"
            : "border-slate-200 focus-within:border-sky-500"
        } ${disabled ? "cursor-not-allowed bg-slate-100" : "dark:bg-slate-800"}`}
      >
        {value.map((entry, index) => (
          <span
            key={`${entry.kind}:${entry.value}`}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium ${kindChip[entry.kind]}`}
          >
            <span className="sr-only">{kindLabel[entry.kind]}: </span>
            {entry.kind === "username" ? `@${entry.value}` : entry.value}
            <button
              type="button"
              onClick={() => remove(index)}
              disabled={disabled}
              aria-label={`Remove ${entry.raw}`}
              className="rounded text-current opacity-60 transition hover:opacity-100 disabled:cursor-not-allowed"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          id="loop-members"
          ref={inputRef}
          type="text"
          value={draft}
          disabled={disabled}
          placeholder={
            value.length === 0 ? "@username, email, or +63 917 111 1111" : ""
          }
          onChange={(event) => {
            updateDraft(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              // Enter must not submit the surrounding form while there is
              // something half-typed in here.
              event.preventDefault();
              commit(draft);
              return;
            }
            if (event.key === "Backspace" && draft === "" && value.length > 0) {
              remove(value.length - 1);
            }
          }}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            if (!/[\n,;]/.test(pasted)) return;
            // Only intercepted when the clipboard carries separators, so a
            // plain paste keeps the browser's own caret handling.
            event.preventDefault();
            const target = event.currentTarget;
            const from = target.selectionStart ?? draft.length;
            const to = target.selectionEnd ?? draft.length;
            commit(`${draft.slice(0, from)}${pasted}${draft.slice(to)}`);
          }}
          onBlur={() => commit(draft)}
          className="min-w-[12rem] flex-1 bg-transparent py-1 text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-slate-200"
        />
      </div>
      {error ? (
        <p className="mt-1 text-xs text-rose-600">{error}</p>
      ) : (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Add people by @username, email, or phone number. Press Enter after
          each one. You can add more later.
        </p>
      )}
    </div>
  );
}

/**
 * Fold any uncommitted text into the list before the form is submitted, so a
 * name that was typed but never Entered is not silently dropped.
 */
export function commitPendingMember(
  draft: string,
  entries: MemberEntry[],
): { entries: MemberEntry[]; error: string } {
  const candidates = splitMemberInput(draft);
  const next = [...entries];

  for (const candidate of candidates) {
    const result = parseMember(candidate);
    if (!result.ok) return { entries: next, error: result.message };
    if (!isDuplicateMember(next, result.entry)) next.push(result.entry);
  }

  return { entries: next, error: "" };
}

"use client";

/**
 * General: everything about how one Loop works, on one screen.
 *
 * Saves on change, like every other settings screen in the app - there is no
 * Save button, and `useOptimisticChanges` is the same hook Notifications and
 * Privacy use, so a failed save rolls the control back and says why in one
 * place rather than four.
 */
import { useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Check,
  Copy,
  CornerUpLeft,
  ImageIcon,
  Info,
  Loader2,
  MessageSquare,
  Mic,
  PenLine,
  Phone,
  Shield,
  SlidersHorizontal,
  Smile,
  Tag,
  UserPlus,
} from "lucide-react";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { Alert, Button, Select } from "@/components/ui";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";
import { SettingsError, SwitchRow } from "@/components/settings/SettingsRows";
import { useOptimisticChanges } from "@/components/settings/useOptimisticChanges";
import { LoopKindAndPlace } from "@/components/home/LoopKindAndPlace";
import {
  LoopDetailsForm,
  type LoopDetailsChange,
} from "@/components/home/LoopDetailsForm";
import type {
  ConversationMode,
  GroupMemberPermission,
  GroupNumber,
  GroupSettings,
  JoinMode,
} from "@/lib/chat/conversations";

/**
 * One choice card: what it is, and what picking it means.
 *
 * TWO descriptions, deliberately. `hint` is the one on the card and has to fit
 * on one line beside three others - the full sentences wrapped to four lines
 * each and made the row unreadable. `description` is the whole thing, behind
 * the card's "i" (see `InfoTip`), so nothing is lost by the short one.
 */
type Choice<T extends string> = {
  value: T;
  label: string;
  hint: string;
  description: string;
};

const MODE_CHOICES: Choice<ConversationMode>[] = [
  {
    value: "chat",
    label: "Chat Group",
    hint: "Everyone can post",
    description: "Members communicate with everyone",
  },
  {
    value: "broadcast",
    label: "Broadcast Group",
    hint: "Admins post only",
    description: "Admins send announcements to members",
  },
];

const JOIN_CHOICES: Choice<JoinMode>[] = [
  {
    value: "open",
    label: "Open",
    hint: "Anyone can join",
    description: "Anyone with the link can join",
  },
  {
    value: "code",
    label: "Code Required",
    hint: "Join with a code",
    description: "Members need a code to join",
  },
  {
    value: "approval",
    label: "Admin Approval",
    hint: "Requests are reviewed",
    description: "Members request access; admin approves",
  },
  {
    value: "invite",
    label: "Invite Only",
    hint: "Only invited people",
    description: "Only invited members can join",
  },
];

const WHO_OPTIONS: { value: GroupMemberPermission; label: string }[] = [
  { value: "admins", label: "Admins" },
  { value: "members", label: "All members" },
];

type LoopPanelGeneralProps = {
  settings: GroupSettings;
  onSave?: (change: Partial<GroupSettings>) => Promise<void>;
  /**
   * May change the settings below the details - `group.settings.policy`,
   * which only ever means an admin.
   */
  canEdit?: boolean;
  /** The Loop's photo, name and description, as they are now. */
  details: { name: string; description: string; imageUrl: string | null };
  /**
   * May change those three - `group.settings.edit`, which a group can open to
   * every member with "Who can edit group details?". Separate from `canEdit`
   * for that reason: a member allowed to rename the group is still not
   * allowed to change how it works.
   */
  canEditDetails?: boolean;
  onSaveDetails?: (change: LoopDetailsChange) => Promise<void>;
  /**
   * Reads this Loop's join code. Shown under "Who Can Join" while that is how
   * people get in - the design files invitations under a section that is not
   * built yet, and a code nobody can read is a join mode nobody can use.
   */
  onFetchJoinCode?: () => Promise<string>;
  /**
   * This Loop's own phone number, or null while it has not got one.
   *
   * Shown to every member, not only admins: texting it is how anybody without
   * the app takes part, so a member who cannot read it cannot invite anybody
   * that way.
   */
  smsNumber?: GroupNumber | null;
  /**
   * Buys this Loop its number, for one created without. Passed only to
   * somebody who may (`group.number.provision`), so its absence is what hides
   * the button.
   */
  onProvisionNumber?: () => Promise<void>;
};

export function LoopPanelGeneral({
  settings,
  onSave,
  canEdit = true,
  details,
  canEditDetails = canEdit,
  onSaveDetails,
  onFetchJoinCode,
  smsNumber = null,
  onProvisionNumber,
}: LoopPanelGeneralProps) {
  const { shown, isBusy, change, error } = useOptimisticChanges(
    settings,
    onSave,
  );

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {!canEdit && (
        <Alert
          variant="neutral"
          className="mb-5 border border-slate-200 px-4 py-3 dark:border-slate-700"
        >
          {canEditDetails
            ? "You can change the photo, name and description. Only admins can change the rest."
            : "Only admins can change these. You are seeing them as they are."}
        </Alert>
      )}

      {error && <SettingsError className="mb-4">{error}</SettingsError>}

      {/* First, because it is what the Loop is: the rest is how it works. */}
      <PanelSection
        icon={PenLine}
        title="Loop Details"
        description="The photo, name and description every member sees."
      >
        <LoopDetailsForm
          name={details.name}
          description={details.description}
          imageUrl={details.imageUrl}
          canEdit={canEditDetails}
          onSave={onSaveDetails}
        />
      </PanelSection>

      {/* Next, because it is the one thing on this screen somebody needs to
          give to a person who does not have the app. */}
      <PanelSection
        icon={Phone}
        title="Group number"
        description="Text this number to post in this Loop."
      >
        <GroupNumberRow number={smsNumber} onProvision={onProvisionNumber} />
      </PanelSection>

      <PanelSection
        icon={MessageSquare}
        title="Communication Mode"
        description="How do members communicate in this Loop?"
      >
        <ChoiceCards
          name="loop-mode"
          value={shown.mode}
          choices={MODE_CHOICES}
          gridClassName="sm:grid-cols-2"
          disabled={!canEdit || isBusy("mode")}
          onChange={(value) => void change("mode", value)}
        />
      </PanelSection>

      <PanelSection
        icon={UserPlus}
        title="Who Can Join"
        description="How can new members join this Loop?"
      >
        <ChoiceCards
          name="loop-join-mode"
          value={shown.join_mode}
          choices={JOIN_CHOICES}
          gridClassName="sm:grid-cols-2 lg:grid-cols-4"
          disabled={!canEdit || isBusy("join_mode")}
          onChange={(value) => void change("join_mode", value)}
        />
        {shown.join_mode === "code" && onFetchJoinCode && (
          <JoinCode onFetch={onFetchJoinCode} />
        )}
      </PanelSection>

      <PanelSection
        icon={Shield}
        title="Member Permissions"
        description="Control who can manage this Loop."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <WhoField
            label="Who can add new members?"
            value={shown.add_member_permission}
            disabled={!canEdit || isBusy("add_member_permission")}
            onChange={(value) => void change("add_member_permission", value)}
          />
          <WhoField
            label="Who can edit group details?"
            value={shown.edit_group_permission}
            disabled={!canEdit || isBusy("edit_group_permission")}
            onChange={(value) => void change("edit_group_permission", value)}
          />
        </div>
      </PanelSection>

      <PanelSection
        icon={SlidersHorizontal}
        title="Features"
        description="Choose which features are available to members."
      >
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          <SwitchRow
            icon={<MessageSquare className="h-4 w-4" />}
            label="SMS Delivery"
            description="Deliver messages to members via SMS"
            checked={shown.sms_delivery_enabled}
            busy={isBusy("sms_delivery_enabled")}
            disabled={!canEdit}
            onChange={(on) => void change("sms_delivery_enabled", on)}
          />
          {/* Replies need delivery: nobody can answer a text they were never
              sent, so this says so rather than accepting a setting that
              cannot take effect. */}
          <SwitchRow
            icon={<CornerUpLeft className="h-4 w-4" />}
            label="SMS Replies"
            description={
              shown.sms_delivery_enabled
                ? "Allow members to reply to messages via SMS"
                : "Needs SMS Delivery on - there is nothing to reply to."
            }
            checked={shown.sms_replies_enabled}
            busy={isBusy("sms_replies_enabled")}
            disabled={!canEdit || !shown.sms_delivery_enabled}
            onChange={(on) => void change("sms_replies_enabled", on)}
          />
          <SwitchRow
            icon={<Mic className="h-4 w-4" />}
            label="Voice Messages"
            description="Allow voice notes and audio files in this Loop. Off hides the microphone for everyone, admins too."
            checked={shown.voice_messages_enabled}
            busy={isBusy("voice_messages_enabled")}
            disabled={!canEdit}
            onChange={(on) => void change("voice_messages_enabled", on)}
          />
          <SwitchRow
            icon={<ImageIcon className="h-4 w-4" />}
            label="Photos & Files"
            description="Allow photos, documents and other files in this Loop. Off hides the attach button for everyone, admins too."
            checked={shown.media_enabled}
            busy={isBusy("media_enabled")}
            disabled={!canEdit}
            onChange={(on) => void change("media_enabled", on)}
          />
          <SwitchRow
            icon={<Smile className="h-4 w-4" />}
            label="Reactions"
            description="Allow emoji reactions on messages. Off stops new ones for everyone, admins too; reactions already left stay visible."
            checked={shown.reactions_enabled}
            busy={isBusy("reactions_enabled")}
            disabled={!canEdit}
            onChange={(on) => void change("reactions_enabled", on)}
          />
        </div>
      </PanelSection>

      <PanelSection
        icon={Tag}
        title="Kind and Place"
        description="What kind of Loop this is and where. Ads are matched on these two only, never on what members write."
      >
        <LoopKindAndPlace
          category={shown.category}
          region={shown.region}
          disabled={!canEdit}
          categoryBusy={isBusy("category")}
          regionBusy={isBusy("region")}
          onCategory={(slug) => void change("category", slug)}
          onRegion={(code) => void change("region", code)}
        />
      </PanelSection>
    </div>
  );
}

/**
 * This Loop's join code, on request.
 *
 * Fetched when asked for rather than with the settings: it is a secret that
 * lets somebody in, so it is not carried into the page for every admin who
 * opens General to change something else.
 */
function JoinCode({ onFetch }: { onFetch: () => Promise<string> }) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { copy, copied, error: copyError } = useCopyToClipboard();

  async function show() {
    setIsLoading(true);
    setError("");
    try {
      setCode(await onFetch());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the code.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700">
      <span className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300">
        Join code
      </span>
      {code ? (
        <>
          <code className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm tracking-widest text-slate-900 dark:bg-slate-800 dark:text-slate-100">
            {code}
          </code>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void copy(code)}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void show()}
          aria-disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Show code"}
        </Button>
      )}
      {(error || copyError) && (
        <p className="w-full text-xs text-rose-600 dark:text-rose-400">
          {error || copyError}
        </p>
      )}
    </div>
  );
}

/** A block of the screen: the glyph, what it is, then its controls. */
/**
 * The Loop's phone number, with a one-click copy.
 *
 * Read-only on purpose: the number is bought when the group is created and
 * never changes - it is on everybody's phone by then, and a group whose number
 * moved would be a group nobody could reach.
 *
 * Null is a real state. A group whose provisioning failed has no number at
 * all, and saying so plainly beats an empty box that looks broken - with the
 * way to fix it beside it, for whoever may.
 */
function GroupNumberRow({
  number,
  onProvision,
}: {
  number: GroupNumber | null;
  onProvision?: () => Promise<void>;
}) {
  const { copy, copied, error } = useCopyToClipboard();

  if (!number) {
    return <NoNumberRow onProvision={onProvision} />;
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
      <div className="min-w-0">
        <p className="font-mono text-base text-slate-900 dark:text-slate-100">
          {number.number}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {number.status === "active"
            ? "Anyone can text this number to post here."
            : `This number is ${number.status} and may not receive texts.`}
        </p>
        {error && (
          <p
            role="alert"
            className="mt-1 text-xs text-rose-600 dark:text-rose-400"
          >
            {error}
          </p>
        )}
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="shrink-0"
        onClick={() => void copy(number.number)}
      >
        {copied ? (
          <>
            <Check className="mr-1.5 h-4 w-4" /> Copied
          </>
        ) : (
          <>
            <Copy className="mr-1.5 h-4 w-4" /> Copy
          </>
        )}
      </Button>
    </div>
  );
}

/**
 * A Loop with no number, and - for an admin - the button that buys it one.
 *
 * ONE NUMBER PER LOOP, and the copy says so before it is pressed: the number
 * cannot be swapped later, so this is not a button to try twice for a nicer
 * one. The server holds the line too - pressing it on a Loop that has a number
 * just returns that number.
 *
 * It takes a few seconds (a search, an order and its confirmation at the
 * provider), so the button says it is working rather than looking dead. When
 * nothing can be bought, the server's sentence is shown as it came: it says
 * what would fix it - verify a phone, turn SMS on, try again later.
 */
function NoNumberRow({ onProvision }: { onProvision?: () => Promise<void> }) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function provision() {
    if (!onProvision) return;
    setIsBusy(true);
    setError(null);
    try {
      await onProvision();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not get a number. Try again.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
      <div className="min-w-0">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This Loop has no number yet, so it cannot be reached by text.
        </p>
        {onProvision && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Each Loop gets one number, and it stays the same for good.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-1 text-xs text-rose-600 dark:text-rose-400"
          >
            {error}
          </p>
        )}
      </div>
      {onProvision && (
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => void provision()}
          disabled={isBusy}
          aria-busy={isBusy || undefined}
        >
          {isBusy ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Phone className="mr-1.5 h-4 w-4" /> Generate number
            </>
          )}
        </Button>
      )}
    </div>
  );
}

function PanelSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="py-5 first:pt-0 last:pb-0">
      <div className="mb-3 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-slate-800 dark:text-sky-300"
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * A row of cards, one of which is picked.
 *
 * Real radio inputs rather than buttons: one tab stop for the group and the
 * arrow keys move within it, which is what somebody on a keyboard expects of a
 * choice and what a row of buttons does not give them.
 *
 * Each card is a label plus a separate "i" button, NOT one label wrapping
 * both. A button inside a label forwards its click to the label's control, so
 * reading what an option means would have picked it.
 *
 * One tip open at a time, which is why the open value lives here rather than
 * in each card.
 */
function ChoiceCards<T extends string>({
  name,
  value,
  choices,
  gridClassName,
  disabled,
  onChange,
}: {
  name: string;
  value: T;
  choices: Choice<T>[];
  gridClassName: string;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const [describing, setDescribing] = useState<T | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  // A tip opened by tapping has nothing to close it - there is no pointer to
  // move away - so anywhere else does.
  useClickOutside(grid, describing !== null, () => setDescribing(null));

  return (
    <div ref={grid} className={`grid gap-3 ${gridClassName}`}>
      {choices.map(
        ({ value: choiceValue, label, hint, description }, index) => {
          const picked = choiceValue === value;
          const descriptionId = `${name}-${choiceValue}-description`;
          return (
            <div
              key={choiceValue}
              className={`flex items-center gap-1.5 rounded-2xl border p-3 transition ${
                disabled ? "opacity-60" : ""
              } ${
                picked
                  ? "border-sky-300 bg-sky-50/70 dark:border-sky-500/60 dark:bg-sky-950/30"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
              }`}
            >
              <label
                className={`flex min-w-0 flex-1 items-center gap-2.5 ${
                  disabled ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <input
                  type="radio"
                  name={name}
                  value={choiceValue}
                  checked={picked}
                  disabled={disabled}
                  onChange={() => onChange(choiceValue)}
                  // The FULL sentence is the radio's description, so a screen
                  // reader gets it while walking the group rather than having to
                  // find the tip. The short hint below is inside the label, so
                  // it is read as part of the name.
                  aria-describedby={descriptionId}
                  className="h-4 w-4 shrink-0 accent-sky-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm leading-tight font-semibold text-slate-900 dark:text-slate-100">
                    {label}
                  </span>
                  <span className="mt-0.5 block truncate text-2xs leading-tight text-slate-500 dark:text-slate-400">
                    {hint}
                  </span>
                </span>
              </label>

              {/* Beside the label rather than centred on the card, which is
                where it sits once the card is two lines tall. */}
              <InfoTip
                id={descriptionId}
                label={label}
                description={description}
                open={describing === choiceValue}
                // Anchored away from the nearest edge, so a tip on the first
                // card does not hang off the left of the pane and one on the
                // last does not hang off the right.
                align={index >= choices.length / 2 ? "right" : "left"}
                onOpen={() => setDescribing(choiceValue)}
                onClose={() =>
                  setDescribing((current) =>
                    current === choiceValue ? null : current,
                  )
                }
              />
            </div>
          );
        },
      )}
    </div>
  );
}

/**
 * The "i" on a choice card, and the description that floats out of it.
 *
 * Opens on hover, on keyboard focus and on tap - hover alone would leave the
 * description unreachable for anybody not using a mouse. Tapping only ever
 * opens it: a tap fires a synthetic mouseenter first, so a toggle would open
 * and immediately shut again. What closes a tapped tip is a press elsewhere.
 *
 * Closed, the text is `sr-only` rather than removed, so it stays in the
 * accessibility tree for the radio that points at it.
 */
function InfoTip({
  id,
  label,
  description,
  open,
  align,
  onOpen,
  onClose,
}: {
  id: string;
  label: string;
  description: string;
  open: boolean;
  align: "left" | "right";
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <span className="relative mt-0.5 shrink-0 self-start">
      <button
        type="button"
        aria-label={`What "${label}" means`}
        aria-expanded={open}
        onMouseEnter={onOpen}
        onMouseLeave={onClose}
        onFocus={onOpen}
        onBlur={onClose}
        onClick={onOpen}
        className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={
          open
            ? `absolute top-full z-20 mt-1.5 w-44 rounded-xl bg-slate-900 px-3 py-2 text-xs leading-snug font-normal text-white shadow-lg dark:bg-slate-700 ${
                align === "right" ? "right-0" : "left-0"
              }`
            : "sr-only"
        }
      >
        {description}
      </span>
    </span>
  );
}

/** "Who can …" - a labelled dropdown, the label above it as the design has it. */
function WhoField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: GroupMemberPermission;
  disabled?: boolean;
  onChange: (value: GroupMemberPermission) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-600 dark:text-slate-300">
        {label}
      </span>
      <Select
        value={value}
        disabled={disabled}
        options={WHO_OPTIONS}
        onChange={(event) =>
          onChange(event.target.value as GroupMemberPermission)
        }
        className="py-2.5"
      />
    </label>
  );
}

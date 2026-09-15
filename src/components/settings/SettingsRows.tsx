"use client";

/**
 * The pieces every settings section is drawn from: a heading, cards of rows,
 * the rows themselves, and the view a choice row opens.
 *
 * One copy, so Security, Appearance, Messaging, Notifications and Privacy
 * cannot come to look or behave differently - a focus fix or a contrast fix
 * made here is made everywhere.
 *
 * Every row takes `busy` rather than being disabled while it saves: disabling
 * the focused control throws keyboard focus back to the top of the page.
 */
import { useEffect, useId, useRef, type ReactNode, type Ref } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Badge, Checkbox, RadioGroup, Select, Switch } from "@/components/ui";
import { cn } from "@/lib/ui/cn";
import type {
  ChoiceOption,
  ChoiceRow,
  PreferenceGroup,
  PreferenceValues,
} from "@/lib/app/localPreferences";

/**
 * A section's title. Given `onBack` it heads a second view - a picker, a list:
 * it gets a back link, and focus moves onto the heading as the view opens, so
 * a screen reader announces where the view landed instead of nothing.
 */
export function SettingsHeading({
  title,
  description,
  backLabel,
  onBack,
  id,
  descriptionId,
}: {
  title: string;
  description?: string;
  backLabel?: string;
  onBack?: () => void;
  /** For a control this heading names - a radio group's aria-labelledby. */
  id?: string;
  descriptionId?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const isSubView = onBack !== undefined;

  useEffect(() => {
    if (isSubView) heading.current?.focus();
  }, [isSubView]);

  return (
    <div>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-2 -ml-1 inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </button>
      )}
      <h2
        id={id}
        ref={heading}
        tabIndex={isSubView ? -1 : undefined}
        className="text-xl font-bold text-slate-900 focus:outline-hidden dark:text-slate-100"
      >
        {title}
      </h2>
      {description && (
        <p
          id={descriptionId}
          className="mt-1 text-sm text-slate-500 dark:text-slate-400"
        >
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * A card of rows, divided, with a small title above it or none.
 *
 * `badge` - "Not available yet" - sits INSIDE the title, so a screen reader
 * announces it as part of the section's name rather than as stray text.
 */
export function SettingsGroup({
  title,
  badge,
  children,
}: {
  title?: string | null;
  badge?: string;
  children: ReactNode;
}) {
  const titleId = useId();

  return (
    <section aria-labelledby={title ? titleId : undefined}>
      {title && (
        <h3
          id={titleId}
          // One spoken name, "Login alerts, Not available yet". Built from the
          // visible pieces instead, a hidden comma is positioned out of flow and
          // browsers read it as "Login alerts , Not available yet".
          aria-label={badge ? `${title}, ${badge}` : undefined}
          className="mb-2 flex flex-wrap items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          {title}
          {badge && (
            <Badge className="text-2xs normal-case tracking-normal">
              {badge}
            </Badge>
          )}
        </h3>
      )}
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
        {children}
      </div>
    </section>
  );
}

/**
 * A row's label and description. The label names the control and the
 * description describes it, so a screen reader hears "Messages, switch, on"
 * first and any long explanation after, rather than all of it as the name.
 * The description's id is `${controlId}-description`.
 */
function RowText({
  controlId,
  label,
  description,
  disabled,
}: {
  controlId: string;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <label
        htmlFor={controlId}
        className={cn(
          "block text-sm font-medium text-slate-900 dark:text-slate-100",
          disabled ? "cursor-default" : "cursor-pointer",
        )}
      >
        {label}
      </label>
      {description && (
        <p
          id={`${controlId}-description`}
          className="mt-0.5 text-xs text-slate-500 dark:text-slate-400"
        >
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * An on/off setting: the label, and a switch on the right. `disabled` is for a
 * setting that does not exist yet - never for one that is saving.
 */
export function SwitchRow({
  label,
  description,
  checked,
  busy,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  busy: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <RowText
        controlId={id}
        label={label}
        description={description}
        disabled={disabled}
      />
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-busy={busy || undefined}
        aria-describedby={description ? `${id}-description` : undefined}
      />
    </div>
  );
}

/** A setting the design ticks rather than flips: the box, then the label. */
export function CheckboxRow({
  label,
  description,
  checked,
  busy,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  busy: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Checkbox
        id={id}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-busy={busy || undefined}
        aria-describedby={description ? `${id}-description` : undefined}
        // Shows that an account save is still running, as a switch does.
        className="aria-busy:cursor-progress aria-busy:opacity-60"
      />
      <RowText controlId={id} label={label} description={description} />
    </div>
  );
}

/** A question answered in place, its options a plain list of radio buttons. */
export function RadioRow({
  label,
  description,
  value,
  options,
  busy,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  options: readonly ChoiceOption[];
  busy: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div
      className="px-4 py-3 aria-busy:cursor-progress aria-busy:opacity-60"
      aria-busy={busy || undefined}
    >
      <p
        id={`${id}-label`}
        className="text-sm font-medium text-slate-900 dark:text-slate-100"
      >
        {label}
      </p>
      {description && (
        <p
          id={`${id}-description`}
          className="mt-0.5 text-xs text-slate-500 dark:text-slate-400"
        >
          {description}
        </p>
      )}
      <RadioGroup
        variant="plain"
        className="mt-2"
        // Per instance, as in ChoicePicker: the page and the dialog can both
        // hold this row, and radios sharing a name are one group.
        name={`${id}-options`}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        value={value}
        onChange={onChange}
        options={options.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
      />
    </div>
  );
}

/** A dropdown with its label: side by side, stacked on a phone. */
export function SelectRow({
  label,
  description,
  value,
  options,
  busy,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  options: readonly ChoiceOption[];
  busy: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <RowText controlId={id} label={label} description={description} />
      <div className="sm:w-48">
        <Select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-busy={busy || undefined}
          aria-describedby={description ? `${id}-description` : undefined}
          className="py-2 aria-busy:cursor-progress aria-busy:opacity-60"
          options={options.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
      </div>
    </div>
  );
}

/**
 * A row that opens something: its label, the current value, a chevron.
 * `disabled` while the value is still loading, so it cannot open onto nothing.
 *
 * Focus is an INSET OUTLINE, not a ring: the card clips anything drawn outside
 * a row, and Windows High Contrast drops box-shadow rings but keeps - and
 * recolours - an outline. The corners follow the card's.
 */
export function LinkRow({
  label,
  value,
  onClick,
  disabled,
  ref,
}: {
  label: string;
  value?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition first:rounded-t-2xl last:rounded-b-2xl hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800 dark:focus-visible:outline-sky-400"
    >
      <span className="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">
        {label}
      </span>
      {value !== undefined && (
        <span className="truncate text-sm text-slate-500 dark:text-slate-400">
          {value}
        </span>
      )}
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-slate-400"
      />
    </button>
  );
}

/**
 * Every group of a screen's rows, drawn from its list (e.g. PRIVACY_GROUPS),
 * each row as its kind says. Everything saves in place except a "choice" row,
 * which opens its picker through `onOpen`.
 */
export function PreferenceGroups<T extends PreferenceValues>({
  groups,
  values,
  isBusy,
  onChange,
  onOpen,
  rowRef,
}: {
  groups: readonly PreferenceGroup<T>[];
  values: T;
  isBusy: (key: keyof T) => boolean;
  // Deliberately not generic. A section's own `change` can take keys that are
  // not rows here, and TypeScript cannot relate a generic signature over the
  // wider type to one over T. These casts, and ChoicePicker's, are where a
  // row's value meets its key.
  onChange: (key: keyof T & string, value: T[keyof T]) => void;
  /** Only needed when a group has a "choice" row. */
  onOpen?: (key: string) => void;
  rowRef?: (key: string) => Ref<HTMLButtonElement>;
}) {
  return (
    <>
      {groups.map((group) => (
        <SettingsGroup key={group.rows[0]?.key} title={group.title}>
          {group.rows.map((row) => {
            const setBoolean = (on: boolean) =>
              onChange(row.key, on as T[keyof T]);
            const setOption = (value: string) =>
              onChange(row.key, value as T[keyof T]);

            switch (row.kind) {
              case "switch":
                return (
                  <SwitchRow
                    key={row.key}
                    label={row.label}
                    description={row.description}
                    checked={values[row.key] === true}
                    busy={isBusy(row.key)}
                    onChange={setBoolean}
                  />
                );
              case "checkbox":
                return (
                  <CheckboxRow
                    key={row.key}
                    label={row.label}
                    description={row.description}
                    checked={values[row.key] === true}
                    busy={isBusy(row.key)}
                    onChange={setBoolean}
                  />
                );
              case "radio":
                return (
                  <RadioRow
                    key={row.key}
                    label={row.label}
                    description={row.description}
                    value={String(values[row.key])}
                    options={row.options}
                    busy={isBusy(row.key)}
                    onChange={setOption}
                  />
                );
              case "select":
                return (
                  <SelectRow
                    key={row.key}
                    label={row.label}
                    description={row.description}
                    value={String(values[row.key])}
                    options={row.options}
                    busy={isBusy(row.key)}
                    onChange={setOption}
                  />
                );
              case "choice":
                return (
                  <LinkRow
                    key={row.key}
                    ref={rowRef?.(row.key)}
                    label={row.label}
                    value={
                      row.options.find(
                        (option) => option.value === values[row.key],
                      )?.label
                    }
                    onClick={() => onOpen?.(row.key)}
                  />
                );
            }
          })}
        </SettingsGroup>
      ))}
    </>
  );
}

/** The view a choice row opens: its options, with a way back. */
export function ChoicePicker<T extends PreferenceValues>({
  row,
  values,
  onChange,
  backLabel,
  onBack,
}: {
  row: ChoiceRow<T>;
  values: T;
  onChange: (key: keyof T & string, value: T[keyof T]) => void;
  backLabel: string;
  onBack: () => void;
}) {
  // Per instance: the page and the dialog can both hold this picker, and two
  // radio groups sharing a name are one group to the browser.
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <div className="space-y-4">
      <SettingsHeading
        id={titleId}
        descriptionId={descriptionId}
        title={row.label}
        description={row.description}
        backLabel={backLabel}
        onBack={onBack}
      />
      <RadioGroup
        name={`${id}-${row.key}`}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        value={String(values[row.key])}
        onChange={(value) => onChange(row.key, value as T[keyof T])}
        options={row.options.map(({ value, label }) => ({ value, label }))}
      />
    </div>
  );
}

/** A save or load that failed, said plainly where it happened. */
export function SettingsError({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn("text-xs text-red-600 dark:text-red-400", className)}
      role="alert"
    >
      {children}
    </p>
  );
}

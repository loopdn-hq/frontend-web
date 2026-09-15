import * as React from "react";
import { cn } from "@/lib/ui/cn";

type SwitchProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "role" | "type"
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/**
 * An on/off control that takes effect the moment it is flipped, with no Save.
 *
 * A button with role="switch" rather than a restyled checkbox: a checkbox
 * reads as "tick this, then submit", and screen readers announce a switch as
 * on or off, which is what these are.
 *
 * The transparent borders are not decoration. Windows High Contrast throws
 * background colours away and repaints borders, so without them the track and
 * the knob vanish and nobody can tell on from off. `outline-hidden` likewise
 * keeps a focus outline there, where the ring's box-shadow is dropped.
 *
 * Name it with a `<label htmlFor>` pointing at its id, or `aria-label`.
 */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, onClick, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) onCheckedChange(!checked);
        }}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-progress aria-busy:opacity-60 dark:focus-visible:ring-sky-400 dark:focus-visible:ring-offset-slate-900",
          // Off is slate-500, not a paler grey: anything lighter falls under
          // 3:1 against the card and an off switch reads as empty space.
          checked ? "bg-sky-600" : "bg-slate-500",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-5 w-5 rounded-full border border-transparent bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    );
  },
);

Switch.displayName = "Switch";

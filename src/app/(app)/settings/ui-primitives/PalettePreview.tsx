"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, MessageCircle, RadioTower, Search, Send } from "lucide-react";
import { ChatAvatar } from "@/components/home/ChatAvatar";
import { NotificationBadge } from "@/components/home/NotificationBadge";
import {
  saveAppearancePreferences,
  THEME_OPTIONS,
  useAppearancePreferences,
} from "@/lib/app/appearance";
import { PALETTES, type Palette } from "@/lib/app/appearanceOptions";
import { useTheme } from "@/lib/theme/ThemeProvider";

/**
 * The pairs that carry text or an icon somebody needs, and what WCAG asks of
 * each: 4.5:1 for text, 3:1 for icons.
 */
const CHECKS = [
  {
    label: "Outgoing message",
    ink: "--on-bubble-out",
    surface: "--bubble-out",
    needs: 4.5,
  },
  {
    label: "Incoming message",
    ink: "--on-bubble-in",
    surface: "--bubble-in",
    needs: 4.5,
  },
  {
    label: "Sender name",
    ink: "--brand-ink",
    surface: "--bubble-in",
    needs: 4.5,
  },
  {
    label: "Preview, open chat",
    ink: "--ink-muted",
    surface: "--tint",
    needs: 4.5,
  },
  {
    label: "Placeholder",
    ink: "--placeholder",
    surface: "--field",
    needs: 4.5,
  },
  { label: "Inactive icon", ink: "--ink-faint", surface: "--rail", needs: 3 },
] as const;

/**
 * Any CSS colour as sRGB bytes, by painting it: whatever syntax a palette is
 * written in - hex today, perhaps oklch() later - the canvas resolves it.
 */
function toRgb(color: string): number[] | null {
  if (!color.trim()) return null;
  const context = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = color.trim();
  context.fillRect(0, 0, 1, 1);
  return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
}

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number | null {
  const first = toRgb(a);
  const second = toRgb(b);
  if (!first || !second) return null;
  const [light, dark] = [luminance(first), luminance(second)].sort(
    (x, y) => y - x,
  );
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Settings → UI primitives → Colours: every palette at once, in the current
 * mode, each drawn from the colour roles alone - so whatever looks wrong here
 * is the palette, not a component.
 */
export function PalettePreview() {
  const { theme, setTheme } = useTheme();
  const { palette: inUse } = useAppearancePreferences();

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Colour themes
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Each palette in the current mode. Switch the mode to see every one in
          the other; choose one to use it across the app on this device.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Mode">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={theme === option.value}
            onClick={() => setTheme(option.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              theme === option.value
                ? "bg-sky-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {PALETTES.map((palette) => (
          <PaletteTile
            key={palette.value}
            palette={palette.value}
            label={palette.label}
            inUse={palette.value === inUse}
          />
        ))}
      </div>
    </section>
  );
}

function PaletteTile({
  palette,
  label,
  inUse,
}: {
  palette: Palette;
  label: string;
  inUse: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const tile = useRef<HTMLDivElement>(null);
  const [ratios, setRatios] = useState<(number | null)[]>([]);

  // Measured rather than listed, so a palette added later is checked with no
  // change here. Again on every mode change: the values under the roles move.
  useEffect(() => {
    if (!tile.current) return;
    const style = getComputedStyle(tile.current);
    setRatios(
      CHECKS.map((check) =>
        contrast(
          style.getPropertyValue(check.ink),
          style.getPropertyValue(check.surface),
        ),
      ),
    );
  }, [resolvedTheme]);

  return (
    <div
      ref={tile}
      data-palette={palette}
      className="overflow-hidden rounded-2xl border border-line"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3">
        <p className="font-semibold text-ink">{label}</p>
        {inUse ? (
          <span className="text-xs font-semibold text-ink-muted">In use</span>
        ) : (
          <button
            type="button"
            onClick={() => saveAppearancePreferences({ palette })}
            className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-on-brand transition hover:bg-brand-hover focus-visible:ring-4 focus-visible:ring-focus focus-visible:outline-none"
          >
            Use {label.toLowerCase()}
          </button>
        )}
      </div>

      {/* A chat screen in miniature: rail, list, thread. */}
      <div
        aria-hidden
        className="grid min-h-64 grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1.3fr)]"
      >
        <div className="flex flex-col items-center gap-1.5 border-r border-line bg-rail py-3">
          <span className="rounded-lg bg-tint p-1.5 text-brand">
            <MessageCircle className="h-4 w-4" />
          </span>
          <span className="p-1.5 text-ink-faint">
            <RadioTower className="h-4 w-4" />
          </span>
          <span className="p-1.5 text-ink-faint">
            <Bell className="h-4 w-4" />
          </span>
        </div>

        <div className="space-y-2 border-r border-line bg-panel p-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-field px-2 py-1.5 text-xs text-placeholder">
            <Search className="h-3.5 w-3.5" />
            Search
          </div>
          <div className="flex gap-1">
            <span className="rounded-full border border-brand bg-brand px-2 py-0.5 text-3xs text-on-brand">
              All
            </span>
            <span className="rounded-full border border-line-soft px-2 py-0.5 text-3xs text-ink-faint">
              Unread
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-tint p-1.5">
            <ChatAvatar name="Product Team" isGroup size={28} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">
                Product Team
              </p>
              <p className="truncate text-3xs text-ink-muted">
                Rilaya: latest update
              </p>
            </div>
            <NotificationBadge count={3} />
          </div>
          <div className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-hover">
            <ChatAvatar name="Book Club" size={28} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">
                Book Club
              </p>
              <p className="truncate text-3xs text-ink-muted">
                Ref: That&apos;s awesome!
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 bg-canvas p-2">
          <span className="mx-auto rounded-full bg-panel px-2 py-0.5 text-3xs text-ink-muted">
            Today
          </span>
          <div className="max-w-[85%] rounded-xl bg-bubble-in px-2 py-1.5 text-xs text-on-bubble-in">
            <p className="text-3xs font-semibold text-brand-ink">Rilaya</p>
            Here&apos;s the latest update.
          </div>
          <div className="ml-auto max-w-[85%] rounded-xl bg-bubble-out px-2 py-1.5 text-xs text-on-bubble-out">
            Looks great!
          </div>
          <div className="mt-auto flex items-center gap-1.5 rounded-xl border border-line bg-panel p-1.5">
            <span className="flex-1 truncate rounded-full bg-canvas px-2 py-1 text-3xs text-placeholder">
              Type a message
            </span>
            <span className="rounded-lg bg-brand p-1.5 text-on-brand hover:bg-brand-hover">
              <Send className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>

      <dl className="grid gap-x-4 gap-y-1 border-t border-line bg-panel px-4 py-3 text-xs sm:grid-cols-2">
        {CHECKS.map((check, index) => {
          const ratio = ratios[index];
          const passes =
            ratio !== null && ratio !== undefined && ratio >= check.needs;
          return (
            <div key={check.label} className="flex justify-between gap-2">
              <dt className="text-ink-muted">{check.label}</dt>
              <dd className={passes ? "text-ink" : "font-semibold text-ink"}>
                {ratio === null || ratio === undefined
                  ? "-"
                  : passes
                    ? `${ratio.toFixed(1)}:1`
                    : `${ratio.toFixed(1)}:1, needs ${check.needs}`}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

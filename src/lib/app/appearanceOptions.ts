/**
 * The appearance choices as plain data - no React - so the root layout's
 * pre-paint script is built from the same lists the settings screen shows. A
 * value added here is one the script accepts and the screen offers.
 */
export const APPEARANCE_STORAGE_KEY = "loopdn_appearance";

export const TEXT_SIZES = [
  { value: "small", label: "Small" },
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
  { value: "larger", label: "Extra large" },
] as const;

export const MESSAGE_SPACINGS = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
] as const;

/**
 * Colour themes. Each value is a `[data-palette]` block pair in
 * app/globals.css - its light roles and its dark roles - and a value listed
 * here without those blocks renders as the first one, blue. Light or dark is a
 * separate choice (ThemeProvider), so every palette has both.
 *
 * Not offered on the Appearance screen while blue is the only one. Offering
 * it is one row in APPEARANCE_GROUPS (lib/app/appearance).
 */
export const PALETTES = [{ value: "blue", label: "Blue" }] as const;

export type TextSize = (typeof TEXT_SIZES)[number]["value"];
export type MessageSpacing = (typeof MESSAGE_SPACINGS)[number]["value"];
export type Palette = (typeof PALETTES)[number]["value"];

export type LocalAppearancePreferences = {
  textSize: TextSize;
  messageSpacing: MessageSpacing;
  palette: Palette;
};

export const defaultLocalAppearancePreferences: LocalAppearancePreferences = {
  textSize: "default",
  messageSpacing: "comfortable",
  palette: "blue",
};

/** `value` if it is a palette this build has, otherwise the default. */
export function knownPalette(value: string): Palette {
  return PALETTES.some((palette) => palette.value === value)
    ? (value as Palette)
    : defaultLocalAppearancePreferences.palette;
}

/**
 * Puts the saved choices on <html> before the first paint, so a large text
 * size does not flash small first, nor one palette as another. Inlined by
 * app/layout.tsx. It must never throw, and it trusts nothing it reads from
 * storage.
 */
export const appearanceInitScript = `
(function () {
  try {
    var saved = JSON.parse(localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)}) || "{}") || {};
    var sizes = ${JSON.stringify(TEXT_SIZES.map((size) => size.value))};
    var spacings = ${JSON.stringify(MESSAGE_SPACINGS.map((spacing) => spacing.value))};
    var palettes = ${JSON.stringify(PALETTES.map((palette) => palette.value))};
    var root = document.documentElement;
    root.dataset.textSize = sizes.indexOf(saved.textSize) >= 0 ? saved.textSize : ${JSON.stringify(defaultLocalAppearancePreferences.textSize)};
    root.dataset.messageSpacing = spacings.indexOf(saved.messageSpacing) >= 0 ? saved.messageSpacing : ${JSON.stringify(defaultLocalAppearancePreferences.messageSpacing)};
    root.dataset.palette = palettes.indexOf(saved.palette) >= 0 ? saved.palette : ${JSON.stringify(defaultLocalAppearancePreferences.palette)};
  } catch (e) {}
})();
`;

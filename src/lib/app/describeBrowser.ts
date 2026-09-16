/**
 * A short, human name for a browser from its user agent: "Chrome on macOS".
 *
 * Only used to describe THIS browser to the person using it (Settings →
 * Security → Active sessions), so a rough answer is enough and nothing here
 * decides anything.
 *
 * The first match wins, so order matters: Edge, Opera and Samsung Internet
 * also say "Chrome", and Chrome also says "Safari". On iPhone and Android the
 * same browsers use their own tokens (CriOS, FxiOS, EdgiOS, EdgA). iPad Safari
 * sends a desktop Mac user agent, so it reads as "Safari on macOS".
 */
const BROWSERS: [RegExp, string][] = [
  [/Edg\/|EdgiOS\/|EdgA\//, "Edge"],
  [/OPR\//, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

// Order matters here too: iPhone user agents also say "like Mac OS X", and
// Android ones also say "Linux".
const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Mac OS X/, "macOS"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"],
];

function firstMatch(table: [RegExp, string][], userAgent: string) {
  return table.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
}

export function describeBrowser(userAgent: string): string {
  const browser = firstMatch(BROWSERS, userAgent);
  const system = firstMatch(SYSTEMS, userAgent);

  if (browser && system) return `${browser} on ${system}`;
  return browser ?? (system ? `A browser on ${system}` : "This browser");
}

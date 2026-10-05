import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  APPEARANCE_GROUPS,
  saveAppearancePreferences,
  THEME_OPTIONS,
  useAppearancePreferences,
  useApplyAppearance,
} from "@/lib/app/appearance";
import {
  APPEARANCE_STORAGE_KEY,
  appearanceInitScript,
  knownPalette,
} from "@/lib/app/appearanceOptions";
import {
  createLocalPreferences,
  findChoiceRow,
  type PreferenceGroup,
} from "@/lib/app/localPreferences";
import { ThemeProvider, useTheme } from "@/lib/theme/ThemeProvider";
import { stubMatchMedia } from "@/test/helpers";

type Prefs = { sounds: boolean; density: string; note: string };

const GROUPS: PreferenceGroup<Prefs>[] = [
  {
    title: "Sound",
    rows: [{ kind: "switch", key: "sounds", label: "Play sounds" }],
  },
  {
    title: null,
    rows: [
      {
        kind: "choice",
        key: "density",
        label: "Density",
        description: "How much fits on screen.",
        options: [
          { value: "cosy", label: "Cosy" },
          { value: "tight", label: "Tight" },
        ],
      },
    ],
  },
];

const DEFAULTS: Prefs = { sounds: true, density: "cosy", note: "" };

function makeStore(storageKey = "test_prefs") {
  return createLocalPreferences<Prefs>({
    storageKey,
    defaults: DEFAULTS,
    groups: GROUPS,
  });
}

function storageEvent(key: string | null, newValue: string | null) {
  window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  const root = document.documentElement;
  root.className = "";
  root.removeAttribute("style");
  for (const key of Object.keys(root.dataset)) delete root.dataset[key];
});

describe("findChoiceRow", () => {
  it("finds a choice row by key, and only a choice row", () => {
    expect(findChoiceRow(GROUPS, "density")?.label).toBe("Density");
    expect(findChoiceRow(GROUPS, "sounds")).toBeUndefined();
    expect(findChoiceRow(GROUPS, "missing")).toBeUndefined();
    expect(findChoiceRow(GROUPS, null)).toBeUndefined();
  });
});

describe("createLocalPreferences", () => {
  it("starts from the defaults when nothing is stored", () => {
    expect(makeStore().get()).toBe(DEFAULTS);
  });

  it("reads back only what it recognises", () => {
    localStorage.setItem(
      "test_prefs",
      JSON.stringify({
        sounds: false,
        density: "tight",
        note: "hello",
        renamed: "dropped",
      }),
    );
    expect(makeStore().get()).toEqual({
      sounds: false,
      density: "tight",
      note: "hello",
    });
  });

  it("falls back per key for a wrong type or an option no longer offered", () => {
    localStorage.setItem(
      "test_prefs",
      JSON.stringify({ sounds: "yes", density: "enormous", note: 4 }),
    );
    expect(makeStore().get()).toEqual(DEFAULTS);
  });

  it("falls back entirely for storage that is not an object", () => {
    localStorage.setItem("test_prefs", "{not json");
    expect(makeStore().get()).toBe(DEFAULTS);
    localStorage.setItem("test_prefs", "3");
    expect(makeStore().get()).toBe(DEFAULTS);
    localStorage.setItem("test_prefs", "null");
    expect(makeStore().get()).toBe(DEFAULTS);
  });

  it("saves the keys given, leaves the rest, and tells every listener", () => {
    const store = makeStore();
    const listener = vi.fn();
    const stop = store.subscribe(listener);

    store.save({ density: "tight" });
    expect(store.get()).toEqual({ ...DEFAULTS, density: "tight" });
    expect(JSON.parse(localStorage.getItem("test_prefs")!)).toEqual({
      ...DEFAULTS,
      density: "tight",
    });
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
    store.save({ sounds: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("holds a save in memory when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const store = makeStore();
    expect(store.get()).toBe(DEFAULTS);
    expect(() => store.save({ sounds: false })).not.toThrow();
    expect(store.get().sounds).toBe(false);
  });

  it("follows another tab's save, and ignores other keys", () => {
    const store = makeStore();
    const listener = vi.fn();
    const stop = store.subscribe(listener);

    storageEvent("someone_else", "{}");
    expect(listener).not.toHaveBeenCalled();

    storageEvent("test_prefs", JSON.stringify({ sounds: false }));
    expect(store.get().sounds).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    // A null key is storage being cleared outright.
    storageEvent(null, null);
    expect(store.get()).toBe(DEFAULTS);

    stop();
    storageEvent("test_prefs", JSON.stringify({ sounds: false }));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("re-reads storage when listening starts again, in case a save went unheard", () => {
    const store = makeStore();
    expect(store.get().density).toBe("cosy");
    localStorage.setItem("test_prefs", JSON.stringify({ density: "tight" }));
    store.subscribe(() => {})();
    expect(store.get().density).toBe("tight");
  });

  it("gives every component the same values", () => {
    const store = makeStore();
    const first = renderHook(() => store.useValues());
    const second = renderHook(() => store.useValues());
    act(() => store.save({ note: "shared" }));
    expect(first.result.current.note).toBe("shared");
    expect(second.result.current).toBe(first.result.current);
  });
});

describe("appearance", () => {
  it("describes the three rows the screen shows", () => {
    expect(APPEARANCE_GROUPS.map((group) => group.title)).toEqual([
      "Theme",
      "Text size",
      "Message spacing",
    ]);
    expect(THEME_OPTIONS.map((option) => option.value)).toEqual([
      "light",
      "dark",
      "system",
    ]);
  });

  it("keeps <html> in step with the saved choices", () => {
    const { unmount } = renderHook(() => useApplyAppearance());
    const root = document.documentElement;
    expect(root.dataset.textSize).toBe("default");
    expect(root.dataset.messageSpacing).toBe("comfortable");
    expect(root.dataset.palette).toBe("blue");

    act(() =>
      saveAppearancePreferences({
        textSize: "large",
        messageSpacing: "compact",
      }),
    );
    expect(root.dataset.textSize).toBe("large");
    expect(root.dataset.messageSpacing).toBe("compact");

    unmount();
    act(() => saveAppearancePreferences({ textSize: "small" }));
    expect(root.dataset.textSize).toBe("large");
  });

  it("hands the saved choices to the settings screen", () => {
    const { result } = renderHook(() => useAppearancePreferences());
    act(() => saveAppearancePreferences({ textSize: "larger" }));
    expect(result.current.textSize).toBe("larger");
  });

  it("falls back to blue for a palette this build does not have", () => {
    expect(knownPalette("blue")).toBe("blue");
    expect(knownPalette("magenta")).toBe("blue");
  });
});

describe("appearanceInitScript", () => {
  function run() {
    new Function(appearanceInitScript)();
    return { ...document.documentElement.dataset };
  }

  it("applies what was saved before the first paint", () => {
    localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({ textSize: "large", messageSpacing: "compact" }),
    );
    expect(run()).toEqual({
      textSize: "large",
      messageSpacing: "compact",
      palette: "blue",
    });
  });

  it("trusts nothing it reads, and never throws", () => {
    localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({ textSize: "huge", palette: "<script>" }),
    );
    expect(run()).toEqual({
      textSize: "default",
      messageSpacing: "comfortable",
      palette: "blue",
    });

    localStorage.setItem(APPEARANCE_STORAGE_KEY, "{broken");
    expect(() => new Function(appearanceInitScript)()).not.toThrow();
  });
});

describe("ThemeProvider", () => {
  function Probe() {
    const { theme, resolvedTheme, setTheme } = useTheme();
    return (
      <>
        <output>{`${theme}/${resolvedTheme}`}</output>
        <button onClick={() => setTheme("dark")}>dark</button>
        <button onClick={() => setTheme("light")}>light</button>
        <button onClick={() => setTheme("system")}>system</button>
      </>
    );
  }

  function mount() {
    return render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
  }

  it("follows the device until told otherwise", () => {
    const media = stubMatchMedia(true);
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("system/dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    act(() => media.set(false));
    expect(screen.getByRole("status")).toHaveTextContent("system/light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("remembers an explicit choice and stops following the device", () => {
    const media = stubMatchMedia(false);
    mount();

    act(() => screen.getByText("dark").click());
    expect(screen.getByRole("status")).toHaveTextContent("dark/dark");
    expect(localStorage.getItem("loopdn_theme")).toBe("dark");
    expect(media.listeners.size).toBe(0);

    act(() => screen.getByText("system").click());
    expect(screen.getByRole("status")).toHaveTextContent("system/light");
    expect(media.listeners.size).toBe(1);
  });

  it("starts from the stored theme, ignoring a value it does not know", () => {
    stubMatchMedia(true);
    localStorage.setItem("loopdn_theme", "light");
    const first = mount();
    expect(screen.getByRole("status")).toHaveTextContent("light/light");
    first.unmount();

    localStorage.setItem("loopdn_theme", "sepia");
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("system/dark");
  });

  it("refuses to be used outside its provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      "useTheme must be used within ThemeProvider",
    );
  });
});

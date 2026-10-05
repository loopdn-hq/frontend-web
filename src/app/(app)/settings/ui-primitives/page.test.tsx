import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setTheme = vi.fn();
let theme = "light";
let paletteInUse = "";

vi.mock("@/lib/theme/ThemeProvider", () => ({
  useTheme: () => ({ theme, resolvedTheme: theme, setTheme }),
}));
vi.mock("@/lib/app/appearance", async () => {
  const actual = await vi.importActual<typeof import("@/lib/app/appearance")>(
    "@/lib/app/appearance",
  );
  return {
    ...actual,
    saveAppearancePreferences: vi.fn(),
    useAppearancePreferences: () => ({ palette: paletteInUse }),
  };
});

import UiPrimitivesPage from "@/app/(app)/settings/ui-primitives/page";
import { PalettePreview } from "@/app/(app)/settings/ui-primitives/PalettePreview";
import { saveAppearancePreferences, THEME_OPTIONS } from "@/lib/app/appearance";
import { PALETTES } from "@/lib/app/appearanceOptions";

const GREY: Record<string, number> = {
  "#000": 0,
  "#777": 119,
  "#888": 136,
  "#fff": 255,
};

/** jsdom has no canvas; this one paints the single pixel the page reads back. */
function stubCanvas(available = true) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
    if (!available) return null;
    const context = {
      fillStyle: "",
      fillRect: () => {},
      getImageData: () => {
        const level = GREY[context.fillStyle] ?? 0;
        return { data: new Uint8ClampedArray([level, level, level, 255]) };
      },
    };
    return context as never;
  });
}

/** The colours each tile resolves its tokens to. */
function stubTokens(tokens: Record<string, string>) {
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    () =>
      ({
        getPropertyValue: (name: string) => tokens[name] ?? "",
      }) as CSSStyleDeclaration,
  );
}

function tile(label: string) {
  return screen
    .getByText(label, { selector: "p" })
    .closest("[data-palette]") as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  theme = "light";
  paletteInUse = PALETTES[0].value;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PalettePreview", () => {
  it("shows every palette, marking the one in use", () => {
    stubCanvas();
    stubTokens({});
    render(<PalettePreview />);
    for (const palette of PALETTES) {
      expect(tile(palette.label)).toHaveAttribute(
        "data-palette",
        palette.value,
      );
    }
    expect(
      within(tile(PALETTES[0].label)).getByText("In use"),
    ).toBeInTheDocument();
  });

  it("offers to use a palette that is not the one in use", async () => {
    stubCanvas();
    stubTokens({});
    paletteInUse = "another";
    render(<PalettePreview />);
    const palette = PALETTES[0];
    await userEvent.click(
      within(tile(palette.label)).getByRole("button", {
        name: `Use ${palette.label.toLowerCase()}`,
      }),
    );
    expect(saveAppearancePreferences).toHaveBeenCalledWith({
      palette: palette.value,
    });
  });

  it("switches the mode the palettes are shown in", async () => {
    stubCanvas();
    stubTokens({});
    render(<PalettePreview />);
    const modes = within(screen.getByRole("group", { name: "Mode" }));
    expect(modes.getAllByRole("button")).toHaveLength(THEME_OPTIONS.length);
    expect(modes.getByRole("button", { pressed: true })).toHaveTextContent(
      THEME_OPTIONS.find((option) => option.value === "light")!.label,
    );

    const dark = THEME_OPTIONS.find((option) => option.value === "dark")!;
    await userEvent.click(modes.getByRole("button", { name: dark.label }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("measures the contrast of each pairing, flagging the ones that fall short", () => {
    stubCanvas();
    stubTokens({
      "--on-bubble-out": "#fff",
      "--bubble-out": "#000",
      "--on-bubble-in": "#000",
      "--bubble-in": "#fff",
      "--brand-ink": " #000 ",
      "--ink-muted": "#777",
      "--tint": "#888",
      "--placeholder": "#777",
      "--field": "#fff",
      "--ink-faint": "#777",
      "--rail": "#fff",
    });
    render(<PalettePreview />);
    const first = within(tile(PALETTES[0].label));
    const row = (label: string) =>
      first.getByText(label).parentElement as HTMLElement;

    expect(row("Outgoing message")).toHaveTextContent("21.0:1");
    expect(row("Incoming message")).toHaveTextContent("21.0:1");
    expect(row("Sender name")).toHaveTextContent("21.0:1");
    expect(row("Preview, open chat")).toHaveTextContent(/1\.\d:1, needs 4\.5/);
    expect(row("Placeholder")).toHaveTextContent(/4\.\d:1, needs 4\.5/);
    // The same pairing passes where only 3:1 is asked of it.
    expect(row("Inactive icon")).toHaveTextContent(/^Inactive icon4\.\d:1$/);
  });

  it("shows a dash where a colour cannot be read", () => {
    stubCanvas();
    stubTokens({ "--on-bubble-out": "#fff" });
    const first = render(<PalettePreview />);
    expect(
      within(tile(PALETTES[0].label)).getByText("Outgoing message")
        .parentElement,
    ).toHaveTextContent(/-$/);
    first.unmount();

    stubCanvas(false);
    stubTokens({ "--on-bubble-out": "#fff", "--bubble-out": "#000" });
    render(<PalettePreview />);
    expect(
      within(tile(PALETTES[0].label)).getByText("Outgoing message")
        .parentElement,
    ).toHaveTextContent(/-$/);
  });
});

describe("UiPrimitivesPage", () => {
  beforeEach(() => {
    stubCanvas();
    stubTokens({});
  });

  it("opens on the form controls, each of which responds", async () => {
    render(<UiPrimitivesPage />);
    expect(
      screen.getByRole("heading", { name: "UI Primitive Preview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to settings" }),
    ).toHaveAttribute("href", expect.stringMatching(/^\/settings\/?$/));
    expect(screen.getByText("This field is required")).toBeInTheDocument();

    const select = screen.getByLabelText("Select");
    expect(select).toHaveValue("admins");
    await userEvent.selectOptions(select, "members");
    expect(select).toHaveValue("members");

    const checkbox = screen.getByRole("checkbox", {
      name: /Enable notifications/,
    });
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    const toggle = screen.getByRole("switch");
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();

    const broadcast = screen.getByRole("radio", { name: /Broadcast/ });
    await userEvent.click(broadcast);
    expect(broadcast).toBeChecked();
  });

  it("shows the buttons, and opens and closes the demo modal", async () => {
    render(<UiPrimitivesPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Actions" }));
    expect(screen.getByRole("button", { name: "Danger" })).toBeInTheDocument();

    for (const close of ["Cancel", "Confirm", "Close demo modal"]) {
      await userEvent.click(screen.getByRole("button", { name: "Open Modal" }));
      const dialog = screen.getByRole("dialog", { name: "Demo Modal" });
      await userEvent.click(
        within(dialog).getByRole("button", { name: close }),
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
  });

  it("opens the context menu where the box was right-clicked", async () => {
    render(<UiPrimitivesPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Actions" }));
    fireEvent.contextMenu(
      screen.getByText("Right-click anywhere in this box"),
      {
        clientX: 30,
        clientY: 40,
      },
    );
    const menu = screen.getByRole("menu", { name: "Demo actions" });
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(3);

    for (const item of ["Copy", "Details", "Destructive action"]) {
      if (!screen.queryByRole("menu")) {
        fireEvent.contextMenu(
          screen.getByText("Right-click anywhere in this box"),
        );
      }
      await userEvent.click(screen.getByRole("menuitem", { name: item }));
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    }
  });

  it("shows each kind of alert, and the palettes", async () => {
    render(<UiPrimitivesPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Feedback" }));
    expect(screen.getByText("Neutral status message")).toBeInTheDocument();
    expect(
      screen.getByText("Error state when a request fails"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Colours" }));
    expect(
      screen.getByRole("heading", { name: "Colour themes" }),
    ).toBeInTheDocument();
  });
});

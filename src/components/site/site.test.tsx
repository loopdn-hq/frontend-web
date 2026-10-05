import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const router = { replace };
const setTheme = vi.fn();
let pathname = "/";
let session: string | null = null;

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));
vi.mock("@/lib/auth/client", () => ({
  useAuth: () => ({ session, isLoaded: true }),
  displayNameForSession: (value: string | null) => value ?? "New Member",
}));
vi.mock("@/lib/theme/ThemeProvider", () => ({
  useTheme: () => ({ theme: "system", resolvedTheme: "light", setTheme }),
}));

import { LegalLayout } from "@/components/legal/LegalLayout";
import { DownloadHero } from "@/components/site/DownloadHero";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteRedirect } from "@/components/site/SiteRedirect";
import { SiteTopNav } from "@/components/site/SiteTopNav";
import { stubLocation } from "@/test/helpers";

/** Outside Next's build the Link drops the trailing slash; either is the page. */
function hrefOf(name: string | RegExp) {
  return screen
    .getAllByRole("link", { name })[0]
    .getAttribute("href")!
    .replace(/\/$/, "");
}

beforeEach(() => {
  vi.clearAllMocks();
  pathname = "/";
  session = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("SiteFooter", () => {
  it("links to the product and company pages, dated this year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    render(<SiteFooter />);

    expect(hrefOf("Pricing")).toBe("/pricing");
    expect(hrefOf("Downloads")).toBe("/downloads");
    expect(hrefOf("Contact")).toBe("/contact");
    expect(hrefOf("Privacy")).toBe("/privacy");
    expect(hrefOf("Terms & Conditions")).toBe("/terms");
    expect(hrefOf("How It Works")).toBe("/#how-it-works");
    expect(screen.getByText(/© 2026 Loopd'n/)).toBeInTheDocument();
    expect(screen.getByAltText("Loopd'n")).toBeInTheDocument();
  });
});

describe("SiteTopNav", () => {
  it("offers sign-up and log-in to a visitor", () => {
    render(<SiteTopNav />);
    expect(hrefOf("Sign Up")).toBe("/signup");
    expect(hrefOf("Log In")).toBe("/login");
    expect(hrefOf("Pricing")).toBe("/pricing");
    expect(hrefOf("Who It's For")).toBe("/#who-its-for");
  });

  it("offers the way into the app to somebody signed in", () => {
    session = "sam";
    render(<SiteTopNav />);
    expect(hrefOf("sam")).toBe("/chats");
    expect(
      screen.queryByRole("link", { name: "Log In" }),
    ).not.toBeInTheDocument();
  });

  it("switches the theme", () => {
    render(<SiteTopNav />);
    fireEvent.click(screen.getByRole("button", { name: "Enable dark mode" }));
    expect(setTheme).toHaveBeenLastCalledWith("dark");
    fireEvent.click(screen.getByRole("button", { name: "Enable light mode" }));
    expect(setTheme).toHaveBeenLastCalledWith("light");
  });
});

describe("LegalLayout", () => {
  it("frames a legal page with its title, date and the site chrome", () => {
    render(
      <LegalLayout title="Privacy Policy" lastUpdated="October 1, 2026">
        <p>We collect very little.</p>
      </LegalLayout>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Last Updated: October 1, 2026"),
    ).toBeInTheDocument();
    expect(screen.getByText("We collect very little.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });
});

describe("DownloadHero", () => {
  function withUserAgent(userAgent: string) {
    vi.stubGlobal("navigator", { userAgent });
  }

  const MAC =
    "https://downloads.loopdn.com/desktop/stable/Loopdn_universal.dmg";
  const WINDOWS =
    "https://downloads.loopdn.com/desktop/stable/Loopdn_x64-setup.exe";

  it("offers this visitor's own installer first, and marks it", () => {
    withUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    render(<DownloadHero />);

    expect(
      screen.getByRole("link", { name: "Download for Desktop" }),
    ).toHaveAttribute("href", WINDOWS);
    expect(
      screen.getByRole("link", { name: /windows.*yours/i }),
    ).toHaveAttribute("href", WINDOWS);
    // The other one is always reachable: a wrong guess costs a click.
    expect(screen.getByRole("link", { name: "Mac" })).toHaveAttribute(
      "href",
      MAC,
    );
  });

  it("marks the Mac installer on a Mac", () => {
    withUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
    render(<DownloadHero />);
    expect(screen.getByRole("link", { name: /mac.*yours/i })).toHaveAttribute(
      "href",
      MAC,
    );
    expect(screen.getByRole("link", { name: "Windows" })).toBeInTheDocument();
  });

  it("defaults to the Mac installer, marking neither, when it cannot tell", () => {
    withUserAgent("Mozilla/5.0 (X11; Linux x86_64)");
    render(<DownloadHero />);
    expect(
      screen.getByRole("link", { name: "Download for Desktop" }),
    ).toHaveAttribute("href", MAC);
    expect(screen.queryByText("(yours)")).not.toBeInTheDocument();
    expect(
      screen.getByAltText(
        "The Loopd'n desktop app showing a group conversation",
      ),
    ).toBeInTheDocument();
  });
});

describe("SiteRedirect", () => {
  function visit(href: string) {
    const location = stubLocation(href);
    pathname = location.pathname;
    render(<SiteRedirect />);
    return location;
  }

  it("leaves the chat site's own pages alone", () => {
    visit("https://loopdn.com/chats/");
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends an admin page on the chat site over to the admin site, query and all", () => {
    const location = visit("https://loopdn.com/admin/campaigns/?status=all");
    expect(location.replace).toHaveBeenCalledWith(
      "https://admin.loopdn.com/admin/campaigns/?status=all",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a dashboard page on the chat site home", () => {
    visit("https://loopdn.com/campaigns/");
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("keeps the commercial site to its own pages", () => {
    visit("https://commercial.loopdn.com/campaigns/");
    expect(replace).not.toHaveBeenCalled();
    visit("https://commercial.loopdn.com/chats/");
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("keeps the admin site to its own pages", () => {
    visit("https://admin.loopdn.com/admin/permissions/");
    expect(replace).not.toHaveBeenCalled();
    visit("https://admin.loopdn.com/signup/");
    expect(replace).toHaveBeenCalledWith("/admin/");
  });
});

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let search = "";
let pathname = "/";
let session: string | null = null;

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/lib/auth/client", () => ({
  useAuth: () => ({ session, isLoaded: true }),
  displayNameForSession: (value: string | null) => value ?? "New Member",
}));
vi.mock("@react-oauth/google", () => ({
  GoogleOAuthProvider: ({
    clientId,
    children,
  }: {
    clientId: string;
    children: React.ReactNode;
  }) => <div data-google-client={clientId}>{children}</div>,
}));
// The commercial dashboard has its own tests; here it only has to be chosen.
vi.mock("@/components/commercial/CommercialFrame", () => ({
  CommercialFrame: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="commercial-frame">{children}</div>
  ),
}));
vi.mock("@/components/commercial/CommercialDashboard", () => ({
  CommercialDashboard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="commercial-dashboard">{children}</div>
  ),
}));
vi.mock("@/components/commercial/CommercialOverview", () => ({
  CommercialOverview: () => <div data-testid="commercial-overview" />,
}));

import BillingCancelPage from "@/app/billing/cancel/page";
import DownloadsPage, { metadata as downloadsMetadata } from "@/app/downloads/page";
import EnterpriseCheckoutCancelPage from "@/app/enterprise/checkout/cancel/page";
import EnterpriseCheckoutSuccessPage from "@/app/enterprise/checkout/success/page";
import RootLayout, { metadata as rootMetadata } from "@/app/layout";
import manifest, { dynamic } from "@/app/manifest";
import NotFound from "@/app/not-found";
import RootPage from "@/app/page";
import PrivacyPage, { metadata as privacyMetadata } from "@/app/privacy/page";
import TermsPage, { metadata as termsMetadata } from "@/app/terms/page";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { stubLocation, stubMatchMedia } from "@/test/helpers";

function withTheme(node: React.ReactNode) {
  return render(<ThemeProvider>{node}</ThemeProvider>);
}

function hrefOf(name: string | RegExp) {
  return screen
    .getAllByRole("link", { name })[0]
    .getAttribute("href")!
    .replace(/\/$/, "");
}

beforeEach(() => {
  search = "";
  pathname = "/";
  session = null;
  localStorage.clear();
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  const root = document.documentElement;
  root.className = "";
  root.removeAttribute("style");
});

describe("the root page", () => {
  it("is the marketing home on the chat site", () => {
    stubLocation("https://loopdn.com/");
    withTheme(<RootPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /one connected group/i }),
    ).toBeInTheDocument();
    expect(hrefOf(/create your loopd'n/i)).toBe("/signup");
    for (const heading of [
      /three simple steps/i,
      /every way\s*to stay connected/i,
      /made for the people/i,
      /start free\. stay connected\./i,
      /bring everyone into the loop/i,
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByAltText("Loopd'n app chat preview")).toBeInTheDocument();
    expect(screen.getByText("Up to 50 members")).toBeInTheDocument();
    expect(screen.queryByTestId("commercial-frame")).not.toBeInTheDocument();
  });

  it("is the dashboard on the commercial site", () => {
    stubLocation("https://commercial.loopdn.com/");
    withTheme(<RootPage />);
    expect(screen.getByTestId("commercial-frame")).toContainElement(
      screen.getByTestId("commercial-overview"),
    );
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("is nothing on the admin site, which redirects to /admin/", () => {
    stubLocation("https://admin.loopdn.com/");
    const { container } = withTheme(<RootPage />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("not found", () => {
  it("says so and offers the way home", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

describe("the web app manifest", () => {
  it("installs as a standalone app that opens on the chats", () => {
    const value = manifest();
    expect(dynamic).toBe("force-static");
    expect(value).toMatchObject({
      name: "Loopd'n",
      start_url: "/chats/",
      scope: "/",
      display: "standalone",
    });
    expect(value.icons?.map((icon) => `${icon.sizes} ${icon.purpose}`)).toEqual([
      "192x192 any",
      "512x512 any",
      "512x512 maskable",
    ]);
  });
});

describe("the downloads page", () => {
  it("offers the installers, the reasons and the requirements", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });
    withTheme(<DownloadsPage />);

    expect(screen.getByRole("link", { name: "Download for Desktop" })).toHaveAttribute(
      "href",
      expect.stringContaining("setup.exe"),
    );
    expect(
      screen.getByRole("heading", { name: "Built for the whole screen" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Windows 10 or 11, 64-bit.")).toBeInTheDocument();
    expect(
      screen.getByText("macOS 11 Big Sur or later. Apple silicon and Intel."),
    ).toBeInTheDocument();
    expect(hrefOf(/open loopd'n on the web/i)).toBe("/chats");
    expect(downloadsMetadata.title).toBe("Download Loopd'n for Desktop | Loopd'n");
  });
});

describe("the legal pages", () => {
  it("renders the terms", () => {
    withTheme(<TermsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Terms & Conditions" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Last Updated:/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "1. About Loopd'n" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(5);
    expect(termsMetadata.title).toBe("Terms & Conditions | Loopd'n");
  });

  it("renders the privacy policy", () => {
    withTheme(<PrivacyPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "1. Information We Collect" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(5);
    expect(privacyMetadata.title).toBe("Privacy Policy | Loopd'n");
  });
});

describe("billing checkout cancelled", () => {
  it("says no payment was taken, and what was being bought", () => {
    search = "flow=plan&plan=premium";
    render(<BillingCancelPage />);
    expect(
      screen.getByRole("heading", { name: "Checkout Cancelled" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Selected plan was PREMIUM.")).toBeInTheDocument();
    expect(hrefOf("Back to Billing Settings")).toBe("/settings");
    expect(hrefOf("View Pricing")).toBe("/pricing");
  });

  it("names a credit package, or nothing when it does not know", () => {
    search = "flow=credits&package=3";
    const first = render(<BillingCancelPage />);
    expect(screen.getByText("Selected credit package was 3.")).toBeInTheDocument();
    first.unmount();

    for (const query of ["", "flow=plan", "flow=credits", "flow=other&plan=x"]) {
      search = query;
      const view = render(<BillingCancelPage />);
      expect(screen.queryByText(/^Selected/)).not.toBeInTheDocument();
      view.unmount();
    }
  });
});

describe("enterprise checkout result pages", () => {
  it("confirms a payment, with the contract when there is one", () => {
    search = "contract=ENT-0001";
    render(<EnterpriseCheckoutSuccessPage />);
    expect(
      screen.getByRole("heading", { name: "Payment Successful" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Contract reference: ENT-0001.")).toBeInTheDocument();
    expect(hrefOf("Go to Chats")).toBe("/chats");
    expect(hrefOf("Back to Billing Settings")).toBe("/settings");
  });

  it("confirms without a contract reference when there is none", () => {
    render(<EnterpriseCheckoutSuccessPage />);
    expect(screen.queryByText(/Contract reference/)).not.toBeInTheDocument();
  });

  it("reports a cancelled checkout and keeps the way back to the builder", () => {
    search = "contract=ENT-0001";
    const first = render(<EnterpriseCheckoutCancelPage />);
    expect(
      screen.getByRole("heading", { name: "Checkout Cancelled" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Contract reference: ENT-0001.")).toBeInTheDocument();
    expect(hrefOf("Back to Plan Builder")).toBe("/enterprise/builder");
    expect(hrefOf("Talk to Sales")).toBe("/contact");
    first.unmount();

    search = "";
    render(<EnterpriseCheckoutCancelPage />);
    expect(screen.queryByText(/Contract reference/)).not.toBeInTheDocument();
  });
});

describe("the root layout", () => {
  function markup() {
    return renderToStaticMarkup(
      <RootLayout>
        <main>page</main>
      </RootLayout>,
    );
  }

  /** The inline scripts, in order: the theme, then the appearance choices. */
  function scripts() {
    return [...markup().matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) =>
      match[1]
        .replaceAll("&quot;", '"')
        .replaceAll("&#x27;", "'")
        .replaceAll("&amp;", "&")
        .replaceAll("&gt;", ">")
        .replaceAll("&lt;", "<"),
    );
  }

  it("wraps every page in the providers, in English", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client-1");
    const html = markup();
    expect(html).toMatch(/^<html lang="en"/);
    expect(html).toContain('data-google-client="google-client-1"');
    expect(html).toContain("<main>page</main>");
    expect(rootMetadata).toMatchObject({
      title: "Loopd'n",
      manifest: "/manifest.webmanifest",
    });
  });

  it("falls back to no Google client id rather than failing to render", () => {
    expect(markup()).toContain('data-google-client=""');
  });

  it("applies a stored dark theme before the first paint", () => {
    localStorage.setItem("loopdn_theme", "dark");
    new Function(scripts()[0])();
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("follows the device when no theme was chosen, and never throws", () => {
    stubMatchMedia(true);
    new Function(scripts()[0])();
    expect(document.documentElement).toHaveClass("dark");

    document.documentElement.className = "";
    stubMatchMedia(false);
    new Function(scripts()[0])();
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");

    // A browser with no matchMedia at all: the script swallows it.
    const themeScript = scripts()[0];
    vi.stubGlobal("matchMedia", undefined);
    expect(() => new Function(themeScript)()).not.toThrow();
  });

  it("inlines the appearance script after the theme one", () => {
    expect(scripts()).toHaveLength(2);
    expect(scripts()[1]).toContain("loopdn_appearance");
  });
});

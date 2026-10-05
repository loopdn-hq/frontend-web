"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  ChevronRight,
  HelpCircle,
  House,
  LogOut,
  Megaphone,
  MessageSquare,
  PanelLeft,
  Settings,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuOrigin,
} from "@/components/ui";
import { CompanySwitcher } from "@/components/commercial/CompanySwitcher";
import { logout, useAuth } from "@/lib/auth/client";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Whether a pathname belongs to this item, for the active highlight. */
  matches: (pathname: string) => boolean;
};

type NavSection = { heading?: string; items: NavItem[] };

// The dashboard is the root of the commercial site. None of these paths may
// contain "ads" or "advert": ad blockers drop them. Three labels differ from
// their paths on purpose: /analytics/, /billing/ and /settings/ are already chat
// pages in the same build, so Analytics, Billing and Settings live at
// /reports/, /balance/ and /account/.
//
// No "Audiences" section: §11 of the product plan allows targeting only on
// aggregate facts about groups, chosen inside each campaign, and §13 forbids
// giving advertisers member lists - which is what "audiences" means elsewhere.
//
// No "Company" item either: companies are managed from the company dropdown in
// the top bar (CompanySwitcher) - "View all companies" opens the Companies
// dialog, where any of them can be edited or switched to.
const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        href: "/",
        label: "Overview",
        icon: House,
        matches: (path) => path === "/",
      },
    ],
  },
  {
    heading: "Advertising",
    items: [
      {
        href: "/campaigns/",
        label: "Campaigns",
        icon: Megaphone,
        // /campaigns/new/ makes one, and /campaign/ is the old address of
        // one: both are still "Campaigns".
        matches: (path) => /^\/campaigns?(\/|$)/.test(path),
      },
    ],
  },
  {
    heading: "Results",
    items: [
      {
        href: "/leads/",
        label: "Leads",
        icon: MessageSquare,
        matches: (path) => path.startsWith("/leads"),
      },
      {
        href: "/reports/",
        label: "Analytics",
        icon: BarChart3,
        matches: (path) => path.startsWith("/reports"),
      },
    ],
  },
  {
    heading: "Manage",
    items: [
      {
        href: "/balance/",
        label: "Billing",
        icon: Wallet,
        matches: (path) => path.startsWith("/balance"),
      },
      {
        href: "/account/",
        label: "Settings",
        icon: Settings,
        matches: (path) => path.startsWith("/account"),
      },
    ],
  },
];

const SUPPORT_MAILTO =
  "mailto:support@loopdn.com?subject=Loopd%27n%20Commercial%20support";

// Its own key, not the chat rail's: the two sites are different products, and
// on different hosts the storage is separate anyway.
const COLLAPSED_KEY = "loopdn_commercial_nav_collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // The toggle still works for this visit.
  }
}

const NavDrawerContext = createContext<(() => void) | null>(null);

/**
 * Opens the sidebar as a drawer below md, where it is hidden. In the blue bar,
 * as the chat app does with NavDrawerButton.
 */
function CommercialDrawerButton({ className = "" }: { className?: string }) {
  const openDrawer = useContext(NavDrawerContext);
  if (!openDrawer) return null;

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label="Open navigation"
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition md:hidden ${className}`}
    >
      <PanelLeft className="h-5 w-5" />
    </button>
  );
}

/**
 * The commercial dashboard's frame, laid out like the chat app's: a dark
 * sidebar that collapses to icons, grouped menu items, and the account at the
 * foot. The same look, deliberately not the same components - the chat rail
 * carries unread counts, a socket and a call layer, and the lint boundary keeps
 * the two products from importing each other.
 */
export function CommercialShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Safe to read storage here: the frame renders nothing during prerendering.
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      writeCollapsed(!current);
      return !current;
    });
  }, []);

  return (
    <NavDrawerContext.Provider value={openDrawer}>
      <div className="flex h-screen w-full overflow-hidden bg-[#f7fbff] dark:bg-slate-900">
        {drawerOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={closeDrawer}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
          />
        )}

        <nav
          aria-label="Commercial"
          className={`${
            drawerOpen ? "flex" : "hidden md:flex"
          } fixed inset-y-0 left-0 z-50 w-[260px] flex-col bg-slate-900 text-slate-300 md:static md:z-auto md:h-full ${
            collapsed ? "md:w-[72px]" : "md:w-[260px]"
          }`}
        >
          <div
            className={`flex items-center gap-2 px-4 py-4 ${
              collapsed ? "md:justify-center md:px-2" : "justify-between"
            }`}
          >
            {!collapsed && (
              <Link
                href="/"
                onClick={closeDrawer}
                className="flex min-w-0 items-center gap-2"
              >
                <span className="text-xl font-bold text-white">
                  Loopd&apos;n
                </span>
                <span className="rounded-full bg-sky-500 px-2 py-0.5 text-3xs font-bold tracking-wide text-white uppercase">
                  Commercial
                </span>
              </Link>
            )}

            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={
                collapsed ? "Expand navigation" : "Collapse navigation"
              }
              aria-pressed={collapsed}
              title={collapsed ? "Expand navigation" : "Collapse navigation"}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white md:inline-flex"
            >
              <PanelLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close navigation"
              className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300 md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {NAV_SECTIONS.map((section, index) => (
              <div key={section.heading ?? `section-${index}`} className="mb-2">
                {section.heading && !collapsed && (
                  <p className="px-3 pt-4 pb-2 text-2xs font-semibold tracking-[0.15em] text-slate-500 uppercase">
                    {section.heading}
                  </p>
                )}
                {section.heading && collapsed && (
                  <div className="my-2 border-t border-slate-800" />
                )}

                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.matches(pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeDrawer}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        collapsed ? "md:justify-center md:px-0" : ""
                      } ${
                        active
                          ? "bg-slate-700/70 text-white"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 shrink-0 ${active ? "text-sky-400" : ""}`}
                      />
                      {!collapsed && (
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>

          <AccountRow collapsed={collapsed} onNavigate={closeDrawer} />
        </nav>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* The dashboard's bar, not a page's: the company every page is
              about, and the drawer button on small screens. Each page's own
              title sits under it (CommercialPageHeader). */}
          <header className="flex h-[68px] shrink-0 items-center gap-2 bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 sm:px-6">
            <CommercialDrawerButton className="-ml-2 text-white hover:bg-white/20" />
            <CompanySwitcher />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </NavDrawerContext.Provider>
  );
}

/**
 * The foot of the sidebar: who is signed in. The company is at the top, in the
 * switcher. The whole row opens the account menu - as in the chat rail, there
 * is no separate log-out icon to mis-hit.
 */
function AccountRow({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const { session } = useAuth();
  const [menu, setMenu] = useState<ContextMenuOrigin | null>(null);

  const name = session ?? "";
  const initial = name.charAt(0).toUpperCase() || "?";

  function openMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    // Anchored to the row, like the chat rail's, so the menu opens just above
    // the control that owns it.
    const box = event.currentTarget.getBoundingClientRect();
    setMenu({ x: box.left, y: box.top - 8 });
  }

  const items: ContextMenuItem[] = [
    {
      id: "company",
      label: "Company",
      description: "Details of the company you're working in",
      icon: <Building2 className="h-4 w-4" />,
      onSelect: () => {
        onNavigate();
        router.push("/company/");
      },
    },
    {
      id: "settings",
      label: "Settings",
      description: "Email, password and notifications",
      icon: <Settings className="h-4 w-4" />,
      onSelect: () => {
        onNavigate();
        router.push("/account/");
      },
    },
    {
      id: "help",
      label: "Help",
      description: "Get in touch with support",
      icon: <HelpCircle className="h-4 w-4" />,
      onSelect: () => {
        window.location.href = SUPPORT_MAILTO;
      },
    },
    { kind: "separator", id: "account-separator" },
    {
      id: "logout",
      label: "Log out",
      description: "Sign out of your account",
      icon: <LogOut className="h-4 w-4" />,
      tone: "danger",
      onSelect: () => {
        void logout().finally(() => router.replace("/login/"));
      },
    },
  ];

  return (
    <div className="border-t border-slate-800 p-2">
      <button
        type="button"
        data-ignore-click-outside
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        aria-label="Account menu"
        onClick={openMenu}
        title={name}
        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-slate-800 ${
          collapsed ? "md:justify-center md:px-0" : ""
        }`}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-500 text-sm font-semibold text-white">
          {initial}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">
              {name}
            </span>
            <span className="block truncate text-xs text-slate-400">
              Commercial account
            </span>
          </span>
        )}
        {!collapsed && (
          <ChevronRight
            className="h-4 w-4 shrink-0 text-slate-500"
            aria-hidden
          />
        )}
      </button>

      <ContextMenu
        origin={menu}
        items={items}
        onClose={() => setMenu(null)}
        label="Account"
      />
    </div>
  );
}

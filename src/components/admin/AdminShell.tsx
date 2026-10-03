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
  ChevronRight,
  House,
  LogOut,
  Megaphone,
  MessageCircle,
  PanelLeft,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuOrigin,
} from "@/components/ui";
import { logout, useAuth } from "@/lib/auth/client";
import { chatSiteUrl } from "@/lib/config/site";
import { useAdminFeatures } from "@/components/admin/AdminFrame";
import { meets, type Requirement } from "@/lib/rbac";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Whether a pathname belongs to this item, for the active highlight. */
  matches: (pathname: string) => boolean;
  /** Shown only to whoever meets it; the server checks again regardless. */
  requires?: Requirement;
};

type NavSection = { heading?: string; items: NavItem[] };

// Every admin page is under /admin/: the three sites share one build and so
// one set of addresses (lib/config/site.ts, ADMIN_PATH_PREFIX).
const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        href: "/admin/",
        label: "Overview",
        icon: House,
        matches: (path) => path === "/admin" || path === "/admin/",
      },
    ],
  },
  {
    heading: "Advertising",
    items: [
      {
        href: "/admin/campaigns/",
        label: "Campaign review",
        icon: Megaphone,
        matches: (path) => path.startsWith("/admin/campaigns"),
        requires: { account: "platform.campaign.review" },
      },
    ],
  },
  {
    heading: "Access",
    items: [
      {
        href: "/admin/permissions/",
        label: "Permissions",
        icon: ShieldCheck,
        matches: (path) => path.startsWith("/admin/permissions"),
        requires: { account: "platform.permissions.view" },
      },
    ],
  },
];

// Its own key: on its own host the storage is separate anyway.
const COLLAPSED_KEY = "loopdn_admin_nav_collapsed";

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

/** Opens the sidebar as a drawer below md, where it is hidden. */
function AdminDrawerButton({ className = "" }: { className?: string }) {
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
 * The admin site's frame, laid out like the commercial dashboard's: a dark
 * sidebar that collapses to icons, grouped items, the account at the foot.
 * The same look on purpose, in violet rather than blue, so an admin can
 * always tell which site they are on. Its own components, because the lint
 * boundary keeps the three products from importing each other.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { features, loading } = useAdminFeatures();
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

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.requires || meets(item.requires, { features, loading }),
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <NavDrawerContext.Provider value={openDrawer}>
      <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        {drawerOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={closeDrawer}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
          />
        )}

        <nav
          aria-label="Admin"
          className={`${
            drawerOpen ? "flex" : "hidden md:flex"
          } fixed inset-y-0 left-0 z-50 w-[260px] flex-col bg-slate-950 text-slate-300 md:static md:z-auto md:h-full ${
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
                href="/admin/"
                onClick={closeDrawer}
                className="flex min-w-0 items-center gap-2"
              >
                <span className="text-xl font-bold text-white">
                  Loopd&apos;n
                </span>
                <span className="rounded-full bg-violet-500 px-2 py-0.5 text-3xs font-bold tracking-wide text-white uppercase">
                  Admin
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
            {sections.map((section, index) => (
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
                          ? "bg-slate-800 text-white"
                          : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 shrink-0 ${active ? "text-violet-400" : ""}`}
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

          <AccountRow collapsed={collapsed} />
        </nav>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-[68px] shrink-0 items-center gap-2 bg-[linear-gradient(130deg,#4f46e5_0%,#7c3aed_100%)] px-4 sm:px-6">
            <AdminDrawerButton className="-ml-2 text-white hover:bg-white/20" />
            <p className="text-sm font-semibold text-white">
              Loopd&apos;n admin
            </p>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </NavDrawerContext.Provider>
  );
}

/** The foot of the sidebar: who is signed in, and the way out. */
function AccountRow({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const { session } = useAuth();
  const [menu, setMenu] = useState<ContextMenuOrigin | null>(null);

  const name = session ?? "";
  const initial = name.charAt(0).toUpperCase() || "?";

  function openMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    setMenu({ x: box.left, y: box.top - 8 });
  }

  const items: ContextMenuItem[] = [
    {
      id: "chat",
      label: "Open Loopd'n chat",
      description: "The chat app, in its own tab",
      icon: <MessageCircle className="h-4 w-4" />,
      onSelect: () => {
        window.open(chatSiteUrl("/chats/"), "_blank", "noopener");
      },
    },
    { kind: "separator", id: "account-separator" },
    {
      id: "logout",
      label: "Log out",
      description: "Sign out of the admin site",
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
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-500 text-sm font-semibold text-white">
          {initial}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">
              {name}
            </span>
            <span className="block truncate text-xs text-slate-400">
              Admin account
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

/** A page's title, under the violet bar, lined up with the page's content. */
export function AdminPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {description}
        </p>
      )}
    </header>
  );
}

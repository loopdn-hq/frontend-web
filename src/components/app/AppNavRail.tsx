"use client";

import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  CirclePlus,
  Contact,
  CreditCard,
  HelpCircle,
  Image as ImageIcon,
  LogOut,
  MessageCircle,
  PanelLeft,
  Phone,
  RadioTower,
  Search,
  Settings,
  Sparkles,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuOrigin,
} from "@/components/ui";
import { settingsHref } from "@/components/settings/UserSettingsPanel";
import { useAppShell } from "@/lib/app/AppShellProvider";
import { fetchBillingSummary } from "@/lib/billing";
import { readNavCollapsed, writeNavCollapsed } from "@/lib/app/navCollapse";
import type { SettingsTab } from "@/components/settings/UserSettingsPanel";

const SUPPORT_MAILTO = "mailto:support@loopdn.com?subject=Loopd%27n%20support";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Rendered as the small pill on the right of the row, e.g. "NEW".
  tag?: string;
};

type NavSection = {
  heading?: string;
  items: NavItem[];
};

// Destinations that exist but are not ready to be offered yet. Kept in
// NAV_SECTIONS rather than deleted so bringing one back is removing one line,
// and so the href, icon and label stay in step with the route that serves it.
// The routes themselves still resolve - this hides the door, not the room.
const HIDDEN_DESTINATIONS = new Set([
  "/communities/",
  "/media/",
  "/contacts/",
  "/ai-assistant/",
]);

// Creating a group is still reachable from the Chats screen; this is only the
// nav rail's shortcut to it.
const SHOW_CREATE_GROUP = false;

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/chats/", label: "Chats", icon: MessageCircle },
      { href: "/broadcast/", label: "Broadcast", icon: RadioTower },
      { href: "/activity/", label: "Activity", icon: Bell },
      { href: "/communities/", label: "Communities", icon: Users },
      { href: "/calls/", label: "Calls", icon: Phone },
      { href: "/media/", label: "Media", icon: ImageIcon },
      { href: "/contacts/", label: "Contacts", icon: Contact },
      {
        href: "/ai-assistant/",
        label: "AI Assistant",
        icon: Sparkles,
        tag: "NEW",
      },
    ],
  },
  {
    heading: "Discover",
    items: [
      { href: "/find-groups/", label: "Find groups", icon: Search },
      { href: "/analytics/", label: "Analytics", icon: BarChart3 },
    ],
  },
];

function hasAnalyticsFeature(features: string[]): boolean {
  return features.some((feature) => {
    const normalized = feature.trim().toLowerCase();
    return (
      normalized.includes("basic analytics") ||
      normalized.includes("advanced analytics")
    );
  });
}

export function AppNavRail() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    unreadByMode,
    activityUnread,
    userProfile,
    logOut,
    requestCreateLoop,
    isNavDrawerOpen,
    closeNavDrawer,
  } = useAppShell();
  const [collapsed, setCollapsed] = useState(readNavCollapsed);
  const [hasAnalyticsAccess, setHasAnalyticsAccess] = useState(false);
  const [accountMenu, setAccountMenu] = useState<ContextMenuOrigin | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    fetchBillingSummary().then((result) => {
      if (cancelled || !result.ok) return;
      setHasAnalyticsAccess(
        hasAnalyticsFeature(result.data.subscription.plan.features),
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      writeNavCollapsed(next);
      return next;
    });
  }, []);

  const closeAccountMenu = useCallback(() => setAccountMenu(null), []);

  const openAccountMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      // Anchored to the row, never to the pointer. ContextMenu was written for
      // a right-click, where the cursor IS the anchor; here the trigger is a
      // fixed control at the foot of the rail, and a menu that opened wherever
      // the cursor happened to be would drift away from the button that owns
      // it. Passing the row's own top means the menu's flip-when-it-overflows
      // rule lands it just above the row, which is where it belongs.
      const box = event.currentTarget.getBoundingClientRect();
      setAccountMenu({ x: box.left, y: box.top - 8 });
    },
    [],
  );

  const openSettings = useCallback(
    (tab?: SettingsTab) => {
      closeNavDrawer();
      router.push(settingsHref(tab));
    },
    [closeNavDrawer, router],
  );

  const accountItems: ContextMenuItem[] = [
    {
      id: "profile",
      label: "Profile",
      description: "View your profile",
      icon: <User className="h-4 w-4" />,
      onSelect: () => openSettings("profile"),
    },
    {
      id: "settings",
      label: "Settings",
      description: "App preferences",
      icon: <Settings className="h-4 w-4" />,
      onSelect: () => openSettings(),
    },
    {
      id: "upgrade",
      label: "Upgrade plan",
      description: "More groups and members",
      icon: <CreditCard className="h-4 w-4" />,
      // Billing is where a plan is actually bought - the pricing page only
      // describes them, and sends a signed-in person back here anyway.
      onSelect: () => openSettings("billing"),
    },
    {
      id: "help",
      label: "Help",
      description: "Get in touch with support",
      icon: <HelpCircle className="h-4 w-4" />,
      // A mailto, following the same convention as the legal, privacy and
      // sales addresses elsewhere in the app. There is no help centre to
      // link to yet, and pointing this at /contact/ would be worse than
      // nothing: that page is an enterprise SALES form.
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
      onSelect: () => void logOut(),
    },
  ];

  const handleCreateGroup = useCallback(() => {
    closeNavDrawer();
    requestCreateLoop();
    router.push("/chats/");
  }, [closeNavDrawer, requestCreateLoop, router]);

  const profileInitial =
    userProfile.displayName.trim().charAt(0).toUpperCase() || "U";

  function isActive(href: string) {
    return pathname === href || pathname === href.replace(/\/$/, "");
  }

  return (
    <>
      {isNavDrawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeNavDrawer}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      <nav
        aria-label="Primary"
        className={`${
          isNavDrawerOpen ? "flex" : "hidden md:flex"
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
              href="/chats/"
              onClick={closeNavDrawer}
              className="text-xl font-bold text-white"
            >
              Loopd&apos;n
            </Link>
          )}

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-pressed={collapsed}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white md:inline-flex"
          >
            <PanelLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={closeNavDrawer}
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
                <p className="px-3 pt-4 pb-2 text-[11px] font-semibold tracking-[0.15em] text-slate-500 uppercase">
                  {section.heading}
                </p>
              )}
              {section.heading && collapsed && (
                <div className="my-2 border-t border-slate-800" />
              )}

              {section.items
                .filter(
                  (item) =>
                    !HIDDEN_DESTINATIONS.has(item.href) &&
                    (item.href !== "/analytics/" || hasAnalyticsAccess),
                )
                .map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  const badge =
                    item.href === "/chats/"
                      ? unreadByMode.chat
                      : item.href === "/broadcast/"
                        ? unreadByMode.broadcast
                        : item.href === "/activity/"
                          ? activityUnread
                          : 0;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeNavDrawer}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={`relative mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        collapsed ? "md:justify-center md:px-0" : ""
                      } ${
                        active
                          ? "bg-slate-700/70 text-white"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />

                      {!collapsed && (
                        <>
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                          {item.tag && (
                            <span className="shrink-0 rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-bold text-white">
                              {item.tag}
                            </span>
                          )}
                          {badge > 0 && (
                            <span className="shrink-0 rounded-full bg-[#168CFF] px-2 py-0.5 text-[11px] font-bold text-white">
                              {badge}
                            </span>
                          )}
                        </>
                      )}

                      {collapsed && badge > 0 && (
                        <span className="absolute top-1.5 right-3 rounded-full bg-[#168CFF] px-1.5 text-[10px] font-bold text-white">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}

              {/* Create group opens the existing modal on the Chats route, so
                  it is an action rather than a destination of its own. */}
              {SHOW_CREATE_GROUP && section.heading === "Discover" && (
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  title={collapsed ? "Create group" : undefined}
                  className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white ${
                    collapsed ? "md:justify-center md:px-0" : ""
                  }`}
                >
                  <CirclePlus className="h-5 w-5 shrink-0" />
                  {!collapsed && (
                    <span className="min-w-0 flex-1 truncate text-left">
                      Create group
                    </span>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 p-2">
          {/* The whole row is the trigger, and there is no separate log-out
              icon beside it. One press used to sign you out with no warning
              and no way back - a destructive action given the largest, most
              easily mis-hit target in the rail. It is now one item in this
              menu, where it reads as a choice among three. */}
          <button
            type="button"
            data-ignore-click-outside
            aria-haspopup="menu"
            aria-expanded={accountMenu !== null}
            aria-label="Account menu"
            onClick={openAccountMenu}
            title={userProfile.displayName}
            className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-slate-800 ${
              collapsed ? "md:justify-center md:px-0" : ""
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
              {profileInitial}
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">
                  {userProfile.displayName}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {userProfile.phone || userProfile.email || "Open settings"}
                </span>
              </span>
            )}
          </button>
        </div>
      </nav>

      <ContextMenu
        origin={accountMenu}
        items={accountItems}
        onClose={closeAccountMenu}
        label="Account"
      />
    </>
  );
}

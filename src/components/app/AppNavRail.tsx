"use client";

import {
  useCallback,
  useEffect,
  useMemo,
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
  ShieldCheck,
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
import { ChatAvatar } from "@/components/home/ChatAvatar";
import { EditProfileModal } from "@/components/settings/EditProfileModal";
import {
  SETTINGS_MODAL_TABS,
  UserSettingsModal,
} from "@/components/settings/UserSettingsModal";
import { useUserSettingsProps } from "@/components/settings/useUserSettingsProps";
import { useAppShell } from "@/lib/app/AppShellProvider";
import { fetchBillingSummary } from "@/lib/billing";
import { platform } from "@/lib/platform";
import { readNavCollapsed, writeNavCollapsed } from "@/lib/app/navCollapse";
import { meets, useFeatures, type Requirement } from "@/lib/rbac";
import type { SettingsTab } from "@/components/settings/UserSettingsPanel";

const SUPPORT_MAILTO = "mailto:support@loopdn.com?subject=Loopd%27n%20support";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Rendered as the small pill on the right of the row, e.g. "NEW".
  tag?: string;
  // What the viewer needs before this is offered. One shape for every reason
  // a row is hidden - a missing feature, or a route that is not ready yet.
  requires?: Requirement;
};

type NavSection = {
  heading?: string;
  items: NavItem[];
};

// Creating a group is still reachable from the Chats screen; this is only the
// nav rail's shortcut to it.
const SHOW_CREATE_GROUP = false;

// `requires` replaces three different mechanisms that did not know about each
// other: a hardcoded hidden-route set, a plan check, and role booleans passed
// down through props. `unreleased` still hides the door rather than the room -
// the routes themselves resolve - and bringing one back is still one line.
const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        href: "/chats/",
        label: "Chats",
        icon: MessageCircle,
        requires: { account: "chat.access" },
      },
      {
        href: "/broadcast/",
        label: "Broadcast",
        icon: RadioTower,
        requires: { account: "broadcast.access" },
      },
      {
        href: "/activity/",
        label: "Activity",
        icon: Bell,
        requires: { account: "activity.access" },
      },
      {
        href: "/communities/",
        label: "Communities",
        icon: Users,
        requires: { unreleased: true },
      },
      {
        href: "/calls/",
        label: "Calls",
        icon: Phone,
        // Real route, but the page itself is a ComingSoon placeholder, so
        // there is no server-side feature to gate it on yet.
      },
      {
        href: "/media/",
        label: "Media",
        icon: ImageIcon,
        requires: { unreleased: true },
      },
      {
        href: "/contacts/",
        label: "Contacts",
        icon: Contact,
        requires: { unreleased: true },
      },
      {
        href: "/ai-assistant/",
        label: "AI Assistant",
        icon: Sparkles,
        tag: "NEW",
        requires: { unreleased: true },
      },
    ],
  },
  {
    heading: "Discover",
    items: [
      {
        href: "/find-groups/",
        label: "Find groups",
        icon: Search,
        requires: { account: "find_groups.access" },
      },
      {
        href: "/analytics/",
        label: "Analytics",
        icon: BarChart3,
        requires: { account: "analytics.access" },
      },
    ],
  },
  {
    // Loopd'n's own team. The whole section disappears for everybody else -
    // `platform.permissions.view` is granted to the account admin role alone,
    // and the server refuses the page regardless of what is rendered here.
    heading: "Platform",
    items: [
      {
        href: "/admin/permissions/",
        label: "Permissions",
        icon: ShieldCheck,
        requires: { account: "platform.permissions.view" },
      },
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
  const { features, loading: featuresLoading } = useFeatures();
  const [hasAnalyticsAccess, setHasAnalyticsAccess] = useState(false);
  const [accountMenu, setAccountMenu] = useState<ContextMenuOrigin | null>(
    null,
  );
  // Both dialogs open over whatever is on screen rather than navigating away
  // from it, so a glance at a setting does not cost the reader their place in
  // a conversation. `null` is closed; the tab is which one to land on.
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);

  // The panel and its save handlers, shared with the /settings/ page so there
  // is one description of what saving means.
  const settingsProps = useUserSettingsProps();

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

  // Filtered once, so a section whose every row is hidden renders nothing at
  // all - otherwise "Platform" would sit there as a heading over emptiness for
  // everybody who is not an account admin.
  const visibleSections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            meets(item.requires, { features, loading: featuresLoading }) &&
            // Analytics needs the plan as well as the role: the role says
            // whether the area exists for this person, the plan says whether
            // they have paid for it. Two questions, and billing is out of
            // scope for rbac - see docs/rbac_plan.md.
            (item.href !== "/analytics/" || hasAnalyticsAccess),
        ),
      })).filter((section) => section.items.length > 0),
    [features, featuresLoading, hasAnalyticsAccess],
  );

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
    (tab: SettingsTab) => {
      closeNavDrawer();
      setSettingsTab(tab);
    },
    [closeNavDrawer],
  );

  const accountItems: ContextMenuItem[] = [
    {
      id: "profile",
      label: "Profile",
      description: "View your profile",
      icon: <User className="h-4 w-4" />,
      onSelect: () => {
        closeNavDrawer();
        setIsEditingProfile(true);
      },
    },
    {
      id: "settings",
      label: "Settings",
      description: "App preferences",
      icon: <Settings className="h-4 w-4" />,
      // The dialog's first section, not Profile - that has its own dialog.
      onSelect: () => openSettings(SETTINGS_MODAL_TABS[0]),
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
        // Setting location does nothing in a Tauri webview; the adapter
        // hands mailto: to the OS there.
        void platform.openExternal(SUPPORT_MAILTO);
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
        } fixed inset-y-0 left-0 z-50 w-[260px] flex-col border-r border-line bg-rail text-ink-muted md:static md:z-auto md:h-full ${
          collapsed ? "md:w-[70px]" : "md:w-[260px]"
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
              className="text-xl font-bold text-brand-ink"
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
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-tint text-ink-muted transition hover:text-ink md:inline-flex"
          >
            <PanelLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={closeNavDrawer}
            aria-label="Close navigation"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint text-ink-muted md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {visibleSections.map((section, index) => (
            <div key={section.heading ?? `section-${index}`} className="mb-2">
              {section.heading && !collapsed && (
                <p className="px-3 pt-4 pb-2 text-2xs font-semibold tracking-[0.15em] text-ink-muted uppercase">
                  {section.heading}
                </p>
              )}
              {section.heading && collapsed && (
                <div className="mx-2 my-2 border-t border-line" />
              )}

              {section.items.map((item) => {
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
                    className={`relative mb-1 flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition ${
                      collapsed ? "md:justify-center md:px-0" : ""
                    } ${
                      active
                        ? "bg-tint text-ink"
                        : "text-ink-muted hover:bg-hover hover:text-ink"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 ${
                        active ? "text-brand-ink" : "text-ink-faint"
                      }`}
                    />

                    {!collapsed && (
                      <>
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>
                        {item.tag && (
                          <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-3xs font-bold text-on-brand">
                            {item.tag}
                          </span>
                        )}
                        {badge > 0 && (
                          <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-2xs font-bold text-on-brand">
                            {badge}
                          </span>
                        )}
                      </>
                    )}

                    {collapsed && badge > 0 && (
                      <span className="absolute top-1.5 right-3 rounded-full bg-brand px-1.5 text-3xs font-bold text-on-brand">
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
                  className={`mb-1 flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-hover hover:text-ink ${
                    collapsed ? "md:justify-center md:px-0" : ""
                  }`}
                >
                  <CirclePlus className="h-5 w-5 shrink-0 text-ink-faint" />
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

        <div className="border-t border-line p-2">
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
            className={`flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition hover:bg-hover ${
              collapsed ? "md:justify-center md:px-0" : ""
            }`}
          >
            {/* ChatAvatar rather than a hand-rolled initial: it already
                knows to show the picture when there is one, and uses the same
                name-derived tint as this person's avatar everywhere else, so
                one account is one colour across the app. */}
            <ChatAvatar
              name={userProfile.displayName || "?"}
              imageUrl={userProfile.avatarUrl}
              size={36}
            />
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {userProfile.displayName}
                </span>
                <span className="block truncate text-xs text-ink-muted">
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

      {/* Mounted per open, NOT once with the rail. The editors seed their
          fields from `profile` with useState, and the rail outlives every
          dialog it opens - so left mounted they would still be holding the
          placeholder the shell starts with (the login name, no bio) long
          after the real profile had loaded, and Save would write that over
          the top of it. Modal returning null while closed unmounts the
          inputs, not the state above them. */}
      {isEditingProfile && (
        <EditProfileModal
          isOpen
          onClose={() => setIsEditingProfile(false)}
          profile={settingsProps.profile}
          onSave={settingsProps.onSaveProfile}
        />
      )}

      {settingsTab !== null && (
        <UserSettingsModal
          {...settingsProps}
          isOpen
          initialTab={settingsTab}
          onClose={() => setSettingsTab(null)}
        />
      )}
    </>
  );
}

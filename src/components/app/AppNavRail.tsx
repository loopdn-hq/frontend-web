"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CirclePlus,
  Contact,
  Image as ImageIcon,
  LogOut,
  MessageCircle,
  PanelLeft,
  Phone,
  RadioTower,
  Search,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAppShell } from "@/lib/app/AppShellProvider";
import { readNavCollapsed, writeNavCollapsed } from "@/lib/app/navCollapse";

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
    items: [{ href: "/find-groups/", label: "Find groups", icon: Search }],
  },
];

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

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      writeNavCollapsed(next);
      return next;
    });
  }, []);

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
              {section.heading === "Discover" && (
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
          <div
            className={`flex items-center gap-3 rounded-xl px-2 py-2 ${
              collapsed ? "md:justify-center md:px-0" : ""
            }`}
          >
            <Link
              href="/settings/"
              onClick={closeNavDrawer}
              title={userProfile.displayName}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                {profileInitial}
              </span>
              {!collapsed && (
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">
                    {userProfile.displayName}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {userProfile.phone || userProfile.email || "Open settings"}
                  </span>
                </span>
              )}
            </Link>

            {!collapsed && (
              <button
                type="button"
                onClick={() => void logOut()}
                aria-label="Log out"
                title="Log out"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}

import type { ReactNode } from "react";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Every admin page: signed in, an admin account (`platform.access`, which the
 * admin role holds), and the
 * sidebar. The admin site is admin.loopdn.com (admin.localhost in
 * development), and all of it is under /admin/ - the three sites share one
 * build and so one set of addresses. See docs/admin-site.md.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminFrame>
      <AdminShell>{children}</AdminShell>
    </AdminFrame>
  );
}

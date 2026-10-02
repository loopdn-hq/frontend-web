import type { ReactNode } from "react";
import { CommercialDashboard } from "@/components/commercial/CommercialDashboard";
import { CommercialFrame } from "@/components/commercial/CommercialFrame";

/**
 * Every commercial page: signed in, a commercial account, which company is
 * active (CommercialFrame), and the sidebar around it (CommercialDashboard).
 *
 * A route group, so none of this is in the URL: the dashboard is the root of
 * commercial.loopdn.com. `/` itself is not in here - it is also loopdn.com's
 * homepage in the same build, so src/app/page.tsx frames it by hostname.
 *
 * Every page has the sidebar. A page that ever needs the frame without it - a
 * full-screen onboarding, a printable invoice - would go in a route group of
 * its own beside the pages, with only the frame.
 */
export default function CommercialLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CommercialFrame>
      <CommercialDashboard>{children}</CommercialDashboard>
    </CommercialFrame>
  );
}

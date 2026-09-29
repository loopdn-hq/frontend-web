import type { ReactNode } from "react";

import { CommercialFrame } from "@/components/commercial/CommercialFrame";

/**
 * Every commercial page: signed in, a commercial account, and which company
 * is active. The pages themselves are in (dashboard), which adds the sidebar.
 *
 * Route groups, so none of this is in the URL: the dashboard is the root of
 * commercial.loopdn.com. `/` itself is not in here - it is also loopdn.com's
 * homepage in the same build, so src/app/page.tsx frames it by hostname.
 */
export default function CommercialLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <CommercialFrame>{children}</CommercialFrame>;
}

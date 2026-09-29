import type { ReactNode } from "react";

import { CommercialDashboard } from "@/components/commercial/CommercialDashboard";

/** The dashboard's pages, inside the sidebar: /campaigns/, /company/, ... */
export default function CommercialDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <CommercialDashboard>{children}</CommercialDashboard>;
}

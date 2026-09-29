"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { CompaniesDialog } from "@/components/commercial/CompaniesDialog";
import { CompanyForm } from "@/components/commercial/CompanyForm";
import { belongsToOneCompany } from "@/components/commercial/useSwitchCompany";
import { Modal, useToast } from "@/components/ui";
import { useCompany } from "@/lib/commercial/CompanyProvider";

type CompanyDialogs = {
  openCreateCompany: () => void;
  /** "View all companies", showing `companyId` (the active one by default). */
  openCompanies: (companyId?: number) => void;
};

const CompanyDialogsContext = createContext<CompanyDialogs | null>(null);

/**
 * The dashboard's two company dialogs, openable from anywhere under it:
 *
 *   "Create company"  a short form, from the dropdown and every "you have no
 *                     company yet" notice
 *   "Companies"       every company, one on the right to edit or switch to
 *                     ("View all companies" in the dropdown)
 *
 * A new company becomes the active one as soon as it exists - the server makes
 * it so - and the page that was open shows it.
 */
export function CompanyDialogsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { companies, adopt } = useCompany();
  const [creating, setCreating] = useState(false);
  // Which company the Companies dialog opens on; undefined while it is shut.
  const [browsing, setBrowsing] = useState<{ companyId?: number }>();

  const openCreateCompany = useCallback(() => setCreating(true), []);
  const openCompanies = useCallback(
    (companyId?: number) => setBrowsing({ companyId }),
    [],
  );
  const value = useMemo(
    () => ({ openCreateCompany, openCompanies }),
    [openCreateCompany, openCompanies],
  );

  const first = companies.length === 0;

  return (
    <CompanyDialogsContext.Provider value={value}>
      {children}

      <Modal
        isOpen={creating}
        onClose={() => setCreating(false)}
        title={first ? "Set up your company" : "Create a company"}
        description={
          first
            ? "Create a company to start advertising on Loopd'n. You can change any of this later."
            : "It gets its own campaigns, balance and billing. Nothing is copied from your other companies."
        }
        maxWidthClassName="max-w-2xl"
        bodyClassName="max-h-[calc(100vh-12rem)] overflow-y-auto"
        closeLabel="Close"
      >
        <CompanyForm
          submitLabel="Create company"
          onCancel={() => setCreating(false)}
          onSaved={(company) => {
            adopt(company);
            setCreating(false);
            toast({
              title: "Company created",
              description: `${company.name} is now your active company.`,
            });
            if (belongsToOneCompany(pathname)) router.push("/campaigns/");
          }}
        />
      </Modal>

      <CompaniesDialog
        isOpen={browsing !== undefined}
        initialCompanyId={browsing?.companyId}
        onClose={() => setBrowsing(undefined)}
      />
    </CompanyDialogsContext.Provider>
  );
}

function useCompanyDialogs(): CompanyDialogs {
  const value = useContext(CompanyDialogsContext);
  if (!value) {
    throw new Error(
      "Company dialogs must be used under CompanyDialogsProvider.",
    );
  }
  return value;
}

/** Opens the "Create company" modal. */
export function useCreateCompany(): () => void {
  return useCompanyDialogs().openCreateCompany;
}

/** Opens "Companies" - every company, one of them selected. */
export function useCompaniesDialog(): (companyId?: number) => void {
  return useCompanyDialogs().openCompanies;
}

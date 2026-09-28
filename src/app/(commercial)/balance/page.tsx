"use client";

import { CompanyNotice } from "@/components/commercial/CompanyNotice";
import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import { formatCents } from "@/lib/commercial/format";

/**
 * /balance/, labelled "Billing" - the company's ad balance and its ledger. Not
 * /billing/: that is the chat plans' Stripe return page in the same build.
 *
 * This is NOT /settings/#billing. That page is the person's plan and their
 * Communication Wallet (prepaid SMS/voice credit, billing.Wallet). This is
 * the company's ad money (commercial.Company.balance_cents). Two meanings of
 * "wallet" is how a refund ends up paying for somebody's SMS, so the two
 * never share a component, a type or a word on screen.
 */
export default function CommercialBalancePage() {
  const { company } = useCompany();

  return (
    <>
      <CommercialPageHeader
        title="Billing"
        description={
          company
            ? `Ad balance: ${formatCents(company.balanceCents)}`
            : "Your ad balance and payments"
        }
      />
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6">
        <CompanyNotice />
        <NotBuiltYet
          title="Add funds"
          endpoint="POST /commercial/companies/{id}/checkout/"
        >
          Stripe checkout on the company&apos;s own Stripe customer, so receipts
          carry the company&apos;s name. Returns to /balance/?checkout=success.
        </NotBuiltYet>
        <NotBuiltYet
          title="Transactions"
          endpoint="GET /commercial/companies/{id}/transactions/"
        >
          Every credit purchase, spend per campaign, refund and adjustment, with
          the balance after each.
        </NotBuiltYet>
      </div>
    </>
  );
}

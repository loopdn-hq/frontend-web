"use client";

import { NotBuiltYet } from "@/components/commercial/NotBuiltYet";
import { CommercialPageHeader } from "@/components/commercial/CommercialPageHeader";
import { useCompany } from "@/lib/commercial/CompanyProvider";
import { formatCents } from "@/lib/commercial/format";

/**
 * /commercial/billing/ - the company's ad balance and its ledger.
 *
 * This is NOT /settings/#billing. That page is the person's plan and their
 * Communication Wallet (prepaid SMS/voice credit, billing.Wallet). This is
 * the company's ad money (ads.Advertiser.balance_cents). Two meanings of
 * "wallet" is how a refund ends up paying for somebody's SMS, so the two
 * never share a component, a type or a word on screen.
 */
export default function CommercialBillingPage() {
  const { company } = useCompany();

  return (
    <>
      <CommercialPageHeader
        title="Billing"
        description={`Ad balance: ${formatCents(company.balanceCents)}`}
      />
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6">
        <NotBuiltYet
          title="Add funds"
          endpoint="POST /promote/advertisers/{id}/checkout/"
        >
          Stripe checkout on the company&apos;s own Stripe customer, so receipts
          carry the company&apos;s name. Returns to
          /commercial/billing/?checkout=success.
        </NotBuiltYet>
        <NotBuiltYet
          title="Transactions"
          endpoint="GET /promote/advertisers/{id}/transactions/"
        >
          Every credit purchase, spend per campaign, refund and adjustment, with
          the balance after each.
        </NotBuiltYet>
      </div>
    </>
  );
}

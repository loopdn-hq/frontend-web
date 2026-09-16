import { Button, Modal } from "@/components/ui";
import type { EnterpriseInvoicePreview } from "@/lib/enterprise/api";

function formatMoney(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const INTERVAL_LABEL: Record<
  EnterpriseInvoicePreview["billingInterval"],
  string
> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

type InvoicePreviewModalProps = {
  isOpen: boolean;
  invoice: EnterpriseInvoicePreview | null;
  isRedirecting: boolean;
  onClose: () => void;
  onProceedToCheckout: () => void;
};

/**
 * Shows the backend's authoritative invoice - not the frontend's own
 * estimate - once /enterprise/drafts/{id}/checkout/ has calculated it.
 * Nothing is charged by opening this; Stripe Checkout only runs once the
 * admin presses "Proceed to checkout".
 */
export function InvoicePreviewModal({
  isOpen,
  invoice,
  isRedirecting,
  onClose,
  onProceedToCheckout,
}: InvoicePreviewModalProps) {
  if (!invoice) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review your invoice"
      description={`${INTERVAL_LABEL[invoice.billingInterval]} billing, calculated by Loopd'n.`}
      closeLabel="Close invoice review"
      maxWidthClassName="max-w-lg"
      footer={
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isRedirecting}
            fullWidth
          >
            Back to builder
          </Button>
          <Button
            type="button"
            onClick={onProceedToCheckout}
            disabled={isRedirecting}
            fullWidth
          >
            {isRedirecting ? "Redirecting..." : "Proceed to checkout"}
          </Button>
        </div>
      }
    >
      <dl className="space-y-2 text-sm">
        {invoice.lineItems.map((item, index) => (
          <div
            key={`${item.description}-${index}`}
            className="flex items-center justify-between gap-3"
          >
            <dt className="text-slate-600 dark:text-slate-300">
              {item.description}
            </dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {formatMoney(item.amountCents, invoice.currency)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-600 dark:text-slate-300">Subtotal</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100">
            {formatMoney(invoice.subtotalCents, invoice.currency)}
          </dd>
        </div>
        {invoice.discountCents > 0 && (
          <div className="flex items-center justify-between gap-3 text-emerald-700 dark:text-emerald-400">
            <dt>Discount</dt>
            <dd className="font-medium">
              -{formatMoney(invoice.discountCents, invoice.currency)}
            </dd>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Total due
        </span>
        <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
          {formatMoney(invoice.totalCents, invoice.currency)}
        </span>
      </div>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        This is the final, backend-calculated price for your configuration - no
        changes have been billed yet. You&apos;ll complete payment on
        Stripe&apos;s secure checkout page.
      </p>
    </Modal>
  );
}

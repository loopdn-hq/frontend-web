/**
 * Money, from minor units. Integer cents on the wire everywhere in this app,
 * so the only place a decimal ever appears is here.
 *
 * The currency is required: every amount belongs to a company, a plan or a
 * wallet with its own, and a default would print pesos as dollars without a
 * word.
 */
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}

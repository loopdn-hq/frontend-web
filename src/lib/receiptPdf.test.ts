import { describe, expect, it } from "vitest";

import type { BillingTransaction } from "@/lib/billingTransactions";
import { buildReceiptPdf, receiptFileName } from "@/lib/receiptPdf";

function receipt(
  overrides: Partial<BillingTransaction> = {},
): BillingTransaction {
  return {
    id: 17,
    kind: "plan_subscription",
    kindLabel: "Plan subscription",
    amountCents: 999,
    currency: "usd",
    description: "Premium plan",
    stripeReference: "in_1Q",
    receiptUrl: "https://invoice.stripe.com/i/abc",
    paidAt: "2026-10-01T14:03:22-05:00",
    ...overrides,
  };
}

/** The file as text, one character a byte, the way it was written. */
function read(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

describe("buildReceiptPdf", () => {
  it("is a PDF from its first byte to its last", () => {
    const pdf = read(buildReceiptPdf(receipt(), "en-US"));
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.endsWith("%%EOF\n")).toBe(true);
  });

  it("points every cross-reference entry at the object it names", () => {
    // A reader finds objects by these offsets alone. One byte out and the
    // file opens blank, or not at all.
    const pdf = read(buildReceiptPdf(receipt({ description: "Café €5" })));

    const xrefAt = Number(/startxref\n(\d+)\n%%EOF/.exec(pdf)?.[1]);
    expect(pdf.slice(xrefAt, xrefAt + 5)).toBe("xref\n");

    const entries = [...pdf.slice(xrefAt).matchAll(/(\d{10}) 00000 n \n/g)];
    expect(entries).toHaveLength(6);
    entries.forEach((entry, index) => {
      const offset = Number(entry[1]);
      const header = `${index + 1} 0 obj\n`;
      expect(pdf.slice(offset, offset + header.length)).toBe(header);
    });
  });

  it("declares the content stream's exact length", () => {
    const pdf = read(buildReceiptPdf(receipt(), "en-US"));
    const match = /<< \/Length (\d+) >>\nstream\n([\s\S]*)\nendstream/.exec(
      pdf,
    );
    expect(match?.[2].length).toBe(Number(match?.[1]));
  });

  it("carries the payment: amount with its currency code, what, when and the references", () => {
    const pdf = read(buildReceiptPdf(receipt(), "en-US"));
    expect(pdf).toMatch(/\(USD.9\.99\)/);
    expect(pdf).toContain("(Premium plan)");
    expect(pdf).toContain("(Plan subscription)");
    expect(pdf).toContain("Oct 1, 2026");
    expect(pdf).toContain("(17)");
    expect(pdf).toContain("(in_1Q)");
    expect(pdf).toContain("(https://invoice.stripe.com/i/abc)");
  });

  it("leaves out a line that has nothing to say", () => {
    const pdf = read(
      buildReceiptPdf(
        receipt({ description: "", stripeReference: "", receiptUrl: "" }),
        "en-US",
      ),
    );
    expect(pdf).not.toContain("(Description)");
    expect(pdf).not.toContain("(Stripe reference)");
    expect(pdf).not.toContain("(Stripe receipt)");
    expect(pdf).toContain("(Type)");
  });

  it("escapes what would end a string early, and never writes past one byte", () => {
    const bytes = buildReceiptPdf(
      receipt({ description: "Plan (annual) \\ 日本 — €" }),
      "en-US",
    );
    const pdf = read(bytes);
    // Parentheses and the backslash escaped; the dash and euro in WinAnsi;
    // what the font has no glyph for as "?".
    expect(pdf).toContain("(Plan \\(annual\\) \\\\ ?? \x97 \x80)");
    expect(pdf.length).toBe(bytes.length);
  });

  it("wraps a long value onto further lines instead of off the page", () => {
    const url = `https://invoice.stripe.com/i/${"a".repeat(120)}`;
    const pdf = read(buildReceiptPdf(receipt({ receiptUrl: url }), "en-US"));
    expect(pdf).not.toContain(`(${url})`);
    expect(pdf).toContain(`(${url.slice(0, 58)})`);
    expect(pdf).toContain(`(${url.slice(58, 116)})`);
  });
});

describe("receiptFileName", () => {
  it("names the file after the payment", () => {
    expect(receiptFileName(receipt())).toBe("receipt-17.pdf");
  });
});

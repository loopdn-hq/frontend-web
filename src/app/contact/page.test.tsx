import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import ContactPage from "@/app/contact/page";
import { PlanComparison } from "@/components/site/PlanComparison";

function field(label: RegExp) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function fill(values: Record<string, string>) {
  const labels: Record<string, RegExp> = {
    name: /full name/i,
    email: /work email/i,
    company: /company/i,
    size: /expected team size/i,
    message: /requirements|tell us/i,
  };
  for (const [key, value] of Object.entries(values)) {
    const control =
      key === "message"
        ? screen.getByPlaceholderText(/tell us your regions/i)
        : field(labels[key]);
    fireEvent.change(control, { target: { value } });
  }
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Submit Enterprise Request" }));
}

describe("ContactPage", () => {
  it("asks for the three things sales needs, and says which are required", () => {
    render(<ContactPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Enterprise Plan Inquiry" }),
    ).toBeInTheDocument();
    expect(screen.getByText("All fields marked with * are required.")).toBeInTheDocument();
    expect(field(/full name/i)).toBeRequired();
    expect(field(/work email/i)).toBeRequired();
    expect(field(/company/i)).toBeRequired();
    expect(field(/expected team size/i)).not.toBeRequired();
    expect(screen.getByRole("link", { name: "sales@loopdn.com" })).toHaveAttribute(
      "href",
      "mailto:sales@loopdn.com",
    );
    expect(
      screen.getByRole("link", { name: "Back to Pricing" }).getAttribute("href"),
    ).toMatch(/^\/pricing\/?$/);
  });

  it("names each problem beside its field instead of submitting", () => {
    render(<ContactPage />);
    submit();

    expect(screen.getByText("Full name must be at least 2 characters.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid work email address.")).toBeInTheDocument();
    expect(
      screen.getByText("Company name must be at least 2 characters."),
    ).toBeInTheDocument();
    expect(field(/full name/i)).toHaveAttribute("aria-invalid", "true");
    expect(field(/full name/i)).toHaveAccessibleDescription(
      "Full name must be at least 2 characters.",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("clears a field's error as soon as it is edited, leaving the others", () => {
    render(<ContactPage />);
    submit();
    fill({ name: "Sam Wren" });

    expect(
      screen.queryByText("Full name must be at least 2 characters."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Enter a valid work email address.")).toBeInTheDocument();
    expect(field(/full name/i)).not.toHaveAttribute("aria-invalid");
  });

  it("tidies what was typed before judging it", () => {
    render(<ContactPage />);
    fill({
      name: "  Sam \u0007  Wren ",
      email: "  Sam@Example.COM ",
      company: " Acme   Ltd ",
      size: "about 800 people",
      message: " lots   of\n  needs ",
    });
    submit();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Our team will reach out at sam@example.com.",
    );
  });

  it("holds the team size and the message to their limits", () => {
    render(<ContactPage />);
    fill({ name: "Sam Wren", email: "sam@example.com", company: "Acme" });

    fill({ size: "0" });
    submit();
    expect(screen.getByText("Team size must be greater than 0.")).toBeInTheDocument();

    fill({ size: "5000000" });
    submit();
    expect(screen.getByText("Team size is too large.")).toBeInTheDocument();

    fill({ size: "800", message: "x".repeat(2001) });
    submit();
    expect(
      screen.getByText("Requirements must be 2000 characters or less."),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/tell us your regions/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    fill({ message: "Fine." });
    submit();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Thanks. Your enterprise request has been recorded.",
    );
  });

  it("refuses names and addresses that are too long", () => {
    render(<ContactPage />);
    fill({
      name: "n".repeat(101),
      email: `${"e".repeat(250)}@example.com`,
      company: "c".repeat(121),
    });
    submit();
    expect(
      screen.getByText("Full name must be 100 characters or less."),
    ).toBeInTheDocument();
    expect(screen.getByText("Email must be 254 characters or less.")).toBeInTheDocument();
    expect(
      screen.getByText("Company name must be 120 characters or less."),
    ).toBeInTheDocument();
  });

  it("can be filled in by typing", async () => {
    const user = userEvent.setup();
    render(<ContactPage />);
    await user.type(field(/full name/i), "Sam Wren");
    await user.type(field(/work email/i), "sam@example.com");
    await user.type(field(/company/i), "Acme");
    await user.click(screen.getByRole("button", { name: "Submit Enterprise Request" }));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("PlanComparison", () => {
  const free = {
    code: "free",
    name: "Free",
    features: [
      "Web messaging",
      "SMS requires PAYG credits or sponsored campaign funding",
    ],
  };
  const premium = {
    code: "premium",
    name: "Premium",
    features: ["Search", "Ad-free", "Voice rooms"],
  };
  const enterprise = {
    code: "enterprise",
    name: "Enterprise",
    features: ["SSO", "SLA", "SMS requires a contract"],
  };

  /** Row label -> "Included"/"Not included" per plan, in column order. */
  function cells(feature: string) {
    const row = screen.getByRole("rowheader", { name: feature }).closest("tr")!;
    return [...row.querySelectorAll("td")].map(
      (cell) => cell.querySelector(".sr-only")?.textContent,
    );
  }

  it("renders nothing without plans", () => {
    const { container } = render(<PlanComparison plans={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has a column per plan and groups the features into sections", () => {
    render(<PlanComparison plans={[free, premium, enterprise]} />);
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "Feature",
      "Free",
      "Premium",
      "Enterprise",
      "Communication",
      "Management & moderation",
      "Billing & account",
      "More",
    ]);
  });

  it("carries a feature up to every plan above the one that adds it", () => {
    render(<PlanComparison plans={[free, premium, enterprise]} />);
    expect(cells("Search")).toEqual(["Not included", "Included", "Included"]);
    expect(cells("SLA")).toEqual(["Not included", "Not included", "Included"]);
    // The baseline is everybody's, whether or not a plan lists it.
    expect(cells("Reactions")).toEqual(["Included", "Included", "Included"]);
  });

  it("keeps a plan's own SMS caveat to that plan alone", () => {
    render(<PlanComparison plans={[free, premium, enterprise]} />);
    expect(
      cells("SMS requires PAYG credits or sponsored campaign funding"),
    ).toEqual(["Included", "Not included", "Not included"]);
    // A caveat the list does not know still lands under Communication.
    expect(cells("SMS requires a contract")).toEqual([
      "Not included",
      "Not included",
      "Included",
    ]);
  });

  it("puts an unlisted feature under More, and hides the internal ones", () => {
    render(<PlanComparison plans={[free, premium, enterprise]} />);
    expect(cells("Voice rooms")).toEqual(["Not included", "Included", "Included"]);
    expect(screen.queryByRole("rowheader", { name: "SSO" })).not.toBeInTheDocument();
  });

  it("marks the viewer's own plan, whatever the case of its code", () => {
    const { rerender } = render(
      <PlanComparison plans={[free, premium]} currentPlanCode="PREMIUM" />,
    );
    expect(screen.getByRole("columnheader", { name: /premium/i })).toHaveTextContent(
      "Your plan",
    );
    expect(screen.getByRole("columnheader", { name: "Free" })).not.toHaveTextContent(
      "Your plan",
    );

    rerender(<PlanComparison plans={[free, premium]} currentPlanCode="unknown" />);
    expect(screen.queryByText("Your plan")).not.toBeInTheDocument();
  });
});

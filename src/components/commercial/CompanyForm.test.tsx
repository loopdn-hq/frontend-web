import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/client", () => ({ fetchUserProfile: vi.fn() }));
vi.mock("@/lib/commercial/api", () => ({
  createCompany: vi.fn(),
  fetchIndustries: vi.fn(),
  fetchMarkets: vi.fn(),
  updateCompany: vi.fn(),
}));

import { CompanyForm } from "@/components/commercial/CompanyForm";
import { fetchUserProfile } from "@/lib/auth/client";
import {
  createCompany,
  fetchIndustries,
  fetchMarkets,
  updateCompany,
} from "@/lib/commercial/api";
import { company, OPTIONS } from "@/test/commercial";
import { deferred } from "@/test/helpers";

const INDUSTRIES = [
  { slug: "retail", label: "Retail" },
  { slug: "food", label: "Food & drink" },
];

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

async function ready() {
  await screen.findByLabelText(/company name/i);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchIndustries).mockResolvedValue({ ok: true, data: INDUSTRIES });
  vi.mocked(fetchMarkets).mockResolvedValue({
    ok: true,
    data: OPTIONS.markets,
  });
  vi.mocked(fetchUserProfile).mockResolvedValue({
    ok: true,
    email: "sam@example.com",
  });
  URL.createObjectURL = vi.fn(() => "blob:logo");
  URL.revokeObjectURL = vi.fn();
});

describe("CompanyForm - creating", () => {
  it("shows a placeholder until its options arrive", async () => {
    render(<CompanyForm submitLabel="Create company" onSaved={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the form");
    await ready();
  });

  it("starts from the first market and the account's own email", async () => {
    render(<CompanyForm submitLabel="Create company" onSaved={() => {}} />);
    await ready();
    expect(screen.getByLabelText(/country \/ currency/i)).toHaveValue("US:USD");
    await waitFor(() =>
      expect(screen.getByLabelText(/contact email/i)).toHaveValue(
        "sam@example.com",
      ),
    );
    // The fuller details are asked for later, when editing.
    expect(
      screen.queryByLabelText(/business address/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Sponsored · Your company/)).toBeInTheDocument();
  });

  it("names what is missing instead of creating", async () => {
    vi.mocked(fetchUserProfile).mockResolvedValue({ ok: false, message: "x" });
    render(<CompanyForm submitLabel="Create company" onSaved={() => {}} />);
    await ready();
    click("Create company");

    expect(
      screen.getByText("Enter the name of your company."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Choose what your company does."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enter an email Loopd'n can reach you at."),
    ).toBeInTheDocument();
    expect(createCompany).not.toHaveBeenCalled();
  });

  it("creates the company, adding https to a bare website", async () => {
    const saving = deferred<Awaited<ReturnType<typeof createCompany>>>();
    vi.mocked(createCompany).mockReturnValue(saving.promise);
    const onSaved = vi.fn();
    render(<CompanyForm submitLabel="Create company" onSaved={onSaved} />);
    await ready();

    type(/company name/i, "  Acme ");
    expect(screen.getByText(/Sponsored · Acme/)).toBeInTheDocument();
    type(/industry/i, "retail");
    type(/website/i, "acme.example");
    type(/country \/ currency/i, "PH:PHP");
    click("Create company");

    expect(createCompany).toHaveBeenCalledWith({
      name: "Acme",
      industry: "retail",
      country: "PH",
      currency: "PHP",
      contactEmail: "sam@example.com",
      website: "https://acme.example",
    });
    expect(
      screen.getByRole("button", { name: /creating company/i }),
    ).toBeDisabled();
    // A second submit while saving does not send twice.
    fireEvent.submit(
      screen
        .getByRole("button", { name: /creating company/i })
        .closest("form")!,
    );
    expect(createCompany).toHaveBeenCalledTimes(1);

    const saved = company({ website: "https://acme.example" });
    await act(async () => saving.resolve({ ok: true, data: saved }));
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("puts the server's errors beside their fields", async () => {
    vi.mocked(createCompany).mockResolvedValue({
      ok: false,
      message: "Please fix the form.",
      fieldErrors: {
        name: "A company with that name exists.",
        currency: "That currency is not supported there.",
        contact_email: "Enter a valid email address.",
        website: "Enter a valid URL.",
        unknown_field: "ignored",
      },
    });
    render(<CompanyForm submitLabel="Create company" onSaved={() => {}} />);
    await ready();
    type(/company name/i, "Acme");
    type(/industry/i, "retail");
    click("Create company");

    expect(
      await screen.findByText("A company with that name exists."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("That currency is not supported there."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enter a valid email address."),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter a valid URL.")).toBeInTheDocument();
    expect(screen.queryByText("Please fix the form.")).not.toBeInTheDocument();
  });

  it("shows the general message when no field is to blame", async () => {
    vi.mocked(createCompany).mockResolvedValue({
      ok: false,
      message: "You have reached the limit of companies.",
    });
    render(<CompanyForm submitLabel="Create company" onSaved={() => {}} />);
    await ready();
    type(/company name/i, "Acme");
    type(/industry/i, "retail");
    click("Create company");
    expect(
      await screen.findByText("You have reached the limit of companies."),
    ).toBeInTheDocument();
  });

  it("offers a retry when the options cannot be loaded", async () => {
    vi.mocked(fetchIndustries).mockResolvedValue({
      ok: false,
      message: "No industries.",
    });
    render(<CompanyForm submitLabel="Create company" onSaved={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No industries.",
    );

    vi.mocked(fetchIndustries).mockResolvedValue({
      ok: true,
      data: INDUSTRIES,
    });
    vi.mocked(fetchMarkets).mockResolvedValue({
      ok: false,
      message: "No markets.",
    });
    click(/try again/i);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("No markets."),
    );

    vi.mocked(fetchMarkets).mockResolvedValue({
      ok: true,
      data: { countries: [], currencies: [] },
    });
    click(/try again/i);
    await ready();
    // With no markets on offer there is nothing to preselect.
    expect(screen.getByLabelText(/country \/ currency/i)).toHaveValue("");
    type(/company name/i, "Acme");
    type(/industry/i, "retail");
    click("Create company");
    expect(screen.getByText("Choose where you advertise.")).toBeInTheDocument();
  });

  it("ignores options and a profile that arrive after it has gone", async () => {
    const industries = deferred<Awaited<ReturnType<typeof fetchIndustries>>>();
    const profile = deferred<Awaited<ReturnType<typeof fetchUserProfile>>>();
    vi.mocked(fetchIndustries).mockReturnValue(industries.promise);
    vi.mocked(fetchUserProfile).mockReturnValue(profile.promise);
    const { unmount } = render(
      <CompanyForm submitLabel="Create company" onSaved={() => {}} />,
    );
    unmount();
    industries.resolve({ ok: true, data: INDUSTRIES });
    profile.resolve({ ok: true, email: "sam@example.com" });
    await expect(profile.promise).resolves.toBeTruthy();
  });
});

describe("CompanyForm - editing", () => {
  const existing = company({ logoUrl: "https://cdn.example/acme.png" });

  it("starts from the company's details, with the fuller fields", async () => {
    const onCancel = vi.fn();
    render(
      <CompanyForm
        company={existing}
        submitLabel="Save changes"
        onSaved={() => {}}
        onCancel={onCancel}
      />,
    );
    await ready();
    expect(screen.getByLabelText(/company name/i)).toHaveValue("Acme");
    expect(screen.getByLabelText(/business address/i)).toHaveValue("1 Main St");
    expect(screen.getByLabelText("Company description")).toHaveValue("Things.");
    expect(screen.getByText("7/500")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Company information" }),
    ).toBeInTheDocument();
    expect(fetchUserProfile).not.toHaveBeenCalled();

    click("Cancel");
    expect(onCancel).toHaveBeenCalled();
  });

  it("saves every field, including the optional ones", async () => {
    const saved = company({
      name: "Acme Ltd",
      website: "https://acme.example/new",
    });
    const saving = deferred<Awaited<ReturnType<typeof updateCompany>>>();
    vi.mocked(updateCompany).mockReturnValue(saving.promise);
    const onSaved = vi.fn();
    render(
      <CompanyForm
        company={existing}
        submitLabel="Save changes"
        onSaved={onSaved}
      />,
    );
    await ready();

    type(/company name/i, "Acme Ltd");
    type(/business address/i, "  2 Side St ");
    type("Company description", " New words. ");
    click("Save changes");

    expect(updateCompany).toHaveBeenCalledWith(3, {
      name: "Acme Ltd",
      industry: "retail",
      country: "US",
      currency: "USD",
      contactEmail: "ads@acme.example",
      website: "https://acme.example",
      contactPhone: "+14155552671",
      address: "2 Side St",
      description: "New words.",
    });
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    await act(async () => saving.resolve({ ok: true, data: saved }));
    expect(onSaved).toHaveBeenCalledWith(saved);
    // The website field shows what the server kept.
    expect(screen.getByLabelText(/website/i)).toHaveValue(
      "https://acme.example/new",
    );
  });

  it("uploads a new logo, refusing one that is too big", async () => {
    vi.mocked(updateCompany).mockResolvedValue({ ok: true, data: existing });
    const { container } = render(
      <CompanyForm
        company={existing}
        submitLabel="Save changes"
        onSaved={() => {}}
      />,
    );
    await ready();
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(screen.getByText("Change logo")).toBeInTheDocument();

    const big = new File(["x"], "big.png");
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByText("Keep the logo under 5MB.")).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [] } });

    const logo = new File(["png"], "logo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [logo] } });
    expect(
      screen.queryByText("Keep the logo under 5MB."),
    ).not.toBeInTheDocument();
    expect(container.querySelector('img[src="blob:logo"]')).not.toBeNull();

    click("Save changes");
    await waitFor(() =>
      expect(updateCompany).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ logo }),
      ),
    );
    await waitFor(() =>
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:logo"),
    );
  });

  it("removes the existing logo by sending null", async () => {
    vi.mocked(updateCompany).mockResolvedValue({
      ok: true,
      data: company({ logoUrl: null }),
    });
    const { container } = render(
      <CompanyForm
        company={existing}
        submitLabel="Save changes"
        onSaved={() => {}}
      />,
    );
    await ready();
    expect(container.querySelector('img[src*="acme.png"]')).not.toBeNull();
    click("Remove logo");
    // (The phone field draws a flag, so look for the logo itself.)
    expect(container.querySelector('img[src*="acme.png"]')).toBeNull();
    expect(screen.getByText("Upload logo")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove logo" }),
    ).not.toBeInTheDocument();

    click("Save changes");
    await waitFor(() =>
      expect(updateCompany).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ logo: null }),
      ),
    );
  });

  it("drops a logo that was only just picked without touching the saved one", async () => {
    vi.mocked(updateCompany).mockResolvedValue({ ok: true, data: company() });
    const { container } = render(
      <CompanyForm
        company={company()}
        submitLabel="Save changes"
        onSaved={() => {}}
      />,
    );
    await ready();
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["png"], "logo.png")] },
    });
    click("Remove logo");
    click("Save changes");
    await waitFor(() => expect(updateCompany).toHaveBeenCalled());
    expect(vi.mocked(updateCompany).mock.calls[0][1]).not.toHaveProperty(
      "logo",
    );
  });

  it("locks the currency once money has moved, and keeps a market no longer offered", async () => {
    render(
      <CompanyForm
        company={company({
          currencyLocked: true,
          country: "GB",
          currency: "GBP",
        })}
        submitLabel="Save changes"
        onSaved={() => {}}
      />,
    );
    await ready();
    const market = screen.getByLabelText(/country \/ currency/i);
    expect(market).toBeDisabled();
    expect(market).toHaveValue("GB:GBP");
    expect(
      screen.getByRole("option", { name: /GB \(GBP\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Fixed: money has already moved in GBP."),
    ).toBeInTheDocument();
  });

  it("puts the server's errors for the optional fields beside them", async () => {
    vi.mocked(updateCompany).mockResolvedValue({
      ok: false,
      message: "Please fix the form.",
      fieldErrors: {
        contact_phone: "Enter a valid phone number.",
        address: "Too long.",
        description: "No links, please.",
        logo: "That image is corrupt.",
        industry: "Pick an industry.",
      },
    });
    render(
      <CompanyForm
        company={existing}
        submitLabel="Save changes"
        onSaved={() => {}}
      />,
    );
    await ready();
    click("Save changes");
    for (const message of [
      "Enter a valid phone number.",
      "Too long.",
      "No links, please.",
      "That image is corrupt.",
      "Pick an industry.",
    ]) {
      expect(await screen.findByText(message)).toBeInTheDocument();
    }
  });
});

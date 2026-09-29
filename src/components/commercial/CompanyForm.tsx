"use client";

import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { Loader2, Trash2 } from "lucide-react";
import type { Country as PhoneCountry } from "react-phone-number-input";

import { LoadFailed } from "@/components/app/LoadFailed";
import { CompanyLogo } from "@/components/commercial/CompanyLogo";
import {
  Alert,
  Button,
  Field,
  Input,
  InternationalPhoneInput,
  Select,
  Skeleton,
  SkeletonRegion,
  Textarea,
} from "@/components/ui";
import { fetchUserProfile } from "@/lib/auth/client";
import {
  createCompany,
  fetchIndustries,
  fetchMarkets,
  updateCompany,
} from "@/lib/commercial/api";
import type {
  Company,
  CompanyInput,
  Industry,
  Markets,
} from "@/lib/commercial/types";

// The backend's ceiling (MAX_AVATAR_UPLOAD_BYTES), checked here first so a
// large photo fails before it is uploaded rather than after.
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const MAX_DESCRIPTION = 500;

type Errors = Partial<Record<keyof CompanyInput | "market" | "form", string>>;

// The API's field names, to this form's. Country and currency are one control
// here, so an error on either lands on it.
const FIELD_OF: Record<string, keyof Errors> = {
  name: "name",
  industry: "industry",
  country: "market",
  currency: "market",
  contact_email: "contactEmail",
  contact_phone: "contactPhone",
  website: "website",
  address: "address",
  description: "description",
  logo: "logo",
};

/** "luna.example" is what people type; the API wants a whole address. */
function withScheme(website: string): string {
  const trimmed = website.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** 🇵🇭 from "PH": regional indicator letters. */
function flagOf(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
}

// One control for both, as "Philippines (PHP)": a company pays in its
// country's currency. The value carries both halves.
function marketValue(country: string, currency: string): string {
  return country && currency ? `${country}:${currency}` : "";
}

const INPUT_HEIGHT = "h-[46px] px-4 text-sm";

/**
 * A company's details, as a form.
 *
 * Creating (no `company`): the short version the plan asks for (decision 20)
 * - logo, name, industry, website, contact email, country and currency.
 * Editing: the same, plus the optional contact phone, address and
 * description, under "Company information" and "Company description".
 */
export function CompanyForm({
  company,
  submitLabel,
  onSaved,
  onCancel,
}: {
  company?: Company;
  submitLabel: string;
  onSaved: (company: Company) => void;
  onCancel?: () => void;
}) {
  const creating = !company;
  const id = useId();

  const [industries, setIndustries] = useState<Industry[] | null>(null);
  const [markets, setMarkets] = useState<Markets | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsToken, setOptionsToken] = useState(0);

  const [name, setName] = useState(company?.name ?? "");
  const [industry, setIndustry] = useState(company?.industry ?? "");
  const [country, setCountry] = useState(company?.country ?? "");
  const [currency, setCurrency] = useState(company?.currency ?? "");
  const [contactEmail, setContactEmail] = useState(company?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(company?.contactPhone ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");
  const [address, setAddress] = useState(company?.address ?? "");
  const [description, setDescription] = useState(company?.description ?? "");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchIndustries(), fetchMarkets()]).then(
      ([industryList, marketList]) => {
        if (cancelled) return;
        if (!industryList.ok) {
          setOptionsError(industryList.message);
          return;
        }
        if (!marketList.ok) {
          setOptionsError(marketList.message);
          return;
        }
        setIndustries(industryList.data);
        setMarkets(marketList.data);
        // A new company starts in the first market, in its currency.
        const first = marketList.data.countries[0];
        if (first) {
          setCountry((current) => current || first.code);
          setCurrency((current) => current || first.defaultCurrency);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [optionsToken]);

  // Starts as the account's own email: most people set up their own business.
  useEffect(() => {
    if (!creating) return;
    let cancelled = false;
    fetchUserProfile().then((profile) => {
      if (!cancelled && profile.ok && profile.email) {
        const email = profile.email;
        setContactEmail((current) => current || email);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [creating]);

  // The preview is an object URL, which lives until it is revoked.
  useEffect(() => {
    if (!logoPreview) return;
    return () => URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  function chooseMarket(value: string) {
    const [nextCountry, nextCurrency] = value.split(":");
    setCountry(nextCountry ?? "");
    setCurrency(nextCurrency ?? "");
  }

  function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setErrors((current) => ({
        ...current,
        logo: "Keep the logo under 5MB.",
      }));
      return;
    }
    setErrors((current) => ({ ...current, logo: undefined }));
    setLogo(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  }

  function dropLogo() {
    setLogo(null);
    setLogoPreview(null);
    setRemoveLogo(Boolean(company?.logoUrl));
  }

  function check(): Errors {
    const found: Errors = {};
    if (!name.trim()) found.name = "Enter the name of your company.";
    if (!industry) found.industry = "Choose what your company does.";
    if (!country || !currency) found.market = "Choose where you advertise.";
    if (!contactEmail.trim()) {
      found.contactEmail = "Enter an email Loopd'n can reach you at.";
    }
    return found;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const found = check();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const input: CompanyInput = {
      name: name.trim(),
      industry,
      country,
      currency,
      contactEmail: contactEmail.trim(),
      website: withScheme(website),
    };
    if (!creating) {
      input.contactPhone = contactPhone;
      input.address = address.trim();
      input.description = description.trim();
    }
    if (logo) input.logo = logo;
    else if (removeLogo) input.logo = null;

    setSaving(true);
    const result = company
      ? await updateCompany(company.id, input)
      : await createCompany(input);
    setSaving(false);

    if (!result.ok) {
      const next: Errors = {};
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        const mine = FIELD_OF[field];
        if (mine) next[mine] = message;
      }
      if (Object.keys(next).length === 0) next.form = result.message;
      setErrors(next);
      return;
    }

    setLogo(null);
    setLogoPreview(null);
    setRemoveLogo(false);
    setWebsite(result.data.website);
    // The caller confirms it - a toast - so the form says nothing itself.
    onSaved(result.data);
  }

  if (optionsError) {
    return (
      <LoadFailed
        what="the company form"
        message={optionsError}
        onRetry={() => {
          setOptionsError(null);
          setOptionsToken((token) => token + 1);
        }}
      />
    );
  }

  if (!industries || !markets) {
    return (
      <SkeletonRegion label="Loading the form" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </SkeletonRegion>
    );
  }

  const shownLogo =
    logoPreview ?? (removeLogo ? null : (company?.logoUrl ?? null));
  const labelName = name.trim() || "Your company";

  // Every market, as "Philippines (PHP)", and the company's own pairing if it
  // is not one of those - so an existing company always shows what it has.
  const marketOptions = markets.countries.map((item) => ({
    value: marketValue(item.code, item.defaultCurrency),
    label: `${flagOf(item.code)} ${item.name} (${item.defaultCurrency})`,
  }));
  const current = marketValue(country, currency);
  if (current && !marketOptions.some((option) => option.value === current)) {
    const named = markets.countries.find((item) => item.code === country);
    marketOptions.push({
      value: current,
      label: `${flagOf(country)} ${named?.name ?? country} (${currency})`,
    });
  }

  return (
    <form onSubmit={submit} noValidate aria-busy={saving} className="space-y-6">
      {errors.form && <Alert variant="error">{errors.form}</Alert>}

      {/* Locked while saving, so what is sent is what is on screen. */}
      <fieldset disabled={saving} className="min-w-0 space-y-6">
        <section className="space-y-5">
          {!creating && (
            <SectionHeading
              title="Company information"
              description="This information will be used for your campaigns, billing and communication."
            />
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Logo"
              htmlFor={`${id}-logo`}
              hint="PNG or JPG, under 5MB."
              error={errors.logo}
            >
              <div className="flex items-center gap-3">
                <CompanyLogo name={labelName} logoUrl={shownLogo} size={56} />
                <label
                  htmlFor={`${id}-logo`}
                  className="inline-flex min-h-9 cursor-pointer items-center rounded-xl bg-sky-50 px-3 text-sm font-semibold text-sky-600 transition hover:bg-sky-100 dark:bg-slate-800 dark:text-sky-400 dark:hover:bg-slate-700"
                >
                  {shownLogo ? "Change logo" : "Upload logo"}
                </label>
                <input
                  id={`${id}-logo`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={chooseLogo}
                />
                {shownLogo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={dropLogo}
                    aria-label="Remove logo"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                )}
              </div>
            </Field>

            <Field
              label={<Required>Company name</Required>}
              htmlFor={`${id}-name`}
              hint={`Every ad is labelled “Sponsored · ${labelName}”.`}
              error={errors.name}
            >
              <Input
                id={`${id}-name`}
                value={name}
                maxLength={120}
                autoComplete="organization"
                state={errors.name ? "error" : "default"}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>

            <Field
              label={<Required>Industry</Required>}
              htmlFor={`${id}-industry`}
              error={errors.industry}
            >
              <Select
                id={`${id}-industry`}
                value={industry}
                placeholder="Choose an industry"
                options={industries.map((item) => ({
                  value: item.slug,
                  label: item.label,
                }))}
                state={errors.industry ? "error" : "default"}
                onChange={(event) => setIndustry(event.target.value)}
              />
            </Field>

            <Field
              label="Website"
              htmlFor={`${id}-website`}
              error={errors.website}
            >
              <Input
                id={`${id}-website`}
                type="url"
                inputMode="url"
                value={website}
                placeholder="https://www.example.com"
                autoComplete="url"
                state={errors.website ? "error" : "default"}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </Field>

            <Field
              label={<Required>Contact email</Required>}
              htmlFor={`${id}-email`}
              error={errors.contactEmail}
            >
              <Input
                id={`${id}-email`}
                type="email"
                value={contactEmail}
                autoComplete="email"
                state={errors.contactEmail ? "error" : "default"}
                onChange={(event) => setContactEmail(event.target.value)}
              />
            </Field>

            {!creating && (
              <Field
                label="Contact phone (optional)"
                htmlFor={`${id}-phone`}
                error={errors.contactPhone}
              >
                <InternationalPhoneInput
                  id={`${id}-phone`}
                  value={contactPhone}
                  onChange={setContactPhone}
                  defaultCountry={(country || "PH") as PhoneCountry}
                  autoComplete="tel"
                  className={`${INPUT_HEIGHT} rounded-xl border-slate-200 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`}
                />
              </Field>
            )}

            <Field
              label={<Required>Country / Currency</Required>}
              htmlFor={`${id}-market`}
              hint={
                company?.currencyLocked
                  ? `Fixed: money has already moved in ${company.currency}.`
                  : "Every amount for this company is in this currency. It can't change once money has moved."
              }
              error={errors.market}
            >
              <Select
                id={`${id}-market`}
                value={current}
                placeholder="Choose a country"
                disabled={company?.currencyLocked}
                options={marketOptions}
                state={errors.market ? "error" : "default"}
                onChange={(event) => chooseMarket(event.target.value)}
              />
            </Field>

            {!creating && (
              <Field
                label="Business address (optional)"
                htmlFor={`${id}-address`}
                error={errors.address}
              >
                <Input
                  id={`${id}-address`}
                  value={address}
                  maxLength={255}
                  placeholder="Enter your business address"
                  autoComplete="street-address"
                  state={errors.address ? "error" : "default"}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </Field>
            )}
          </div>
        </section>

        {!creating && (
          <section className="space-y-4 border-t border-slate-200 pt-6 dark:border-slate-800">
            <SectionHeading
              title="Company description"
              description="Tell us about your business. This helps with campaign review and targeting."
            />
            <Field htmlFor={`${id}-description`} error={errors.description}>
              <Textarea
                id={`${id}-description`}
                value={description}
                rows={4}
                maxLength={MAX_DESCRIPTION}
                aria-label="Company description"
                state={errors.description ? "error" : "default"}
                onChange={(event) => setDescription(event.target.value)}
              />
              <p className="text-right text-xs text-slate-500 dark:text-slate-400">
                {description.length}/{MAX_DESCRIPTION}
              </p>
            </Field>
          </section>
        )}
      </fieldset>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {saving ? (creating ? "Creating company…" : "Saving…") : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

function Required({ children }: { children: ReactNode }) {
  return (
    <>
      {children}{" "}
      <span aria-hidden className="text-rose-500">
        *
      </span>
    </>
  );
}

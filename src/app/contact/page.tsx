"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";

type ContactForm = {
  name: string;
  workEmail: string;
  company: string;
  teamSize: string;
  message: string;
};

const initialForm: ContactForm = {
  name: "",
  workEmail: "",
  company: "",
  teamSize: "",
  message: "",
};

type ContactFieldErrors = Partial<Record<keyof ContactForm, string>>;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripControlChars(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "");
}

function sanitizeText(value: string) {
  return normalizeWhitespace(stripControlChars(value));
}

function sanitizeEmail(value: string) {
  return normalizeWhitespace(stripControlChars(value)).toLowerCase();
}

function sanitizeNumeric(value: string) {
  return value.replace(/[^\d]/g, "");
}

const contactFormSchema = z.object({
  name: z
    .string()
    .min(2, "Full name must be at least 2 characters.")
    .max(100, "Full name must be 100 characters or less."),
  workEmail: z
    .string()
    .email("Enter a valid work email address.")
    .max(254, "Email must be 254 characters or less."),
  company: z
    .string()
    .min(2, "Company name must be at least 2 characters.")
    .max(120, "Company name must be 120 characters or less."),
  teamSize: z
    .string()
    .regex(/^\d*$/, "Team size can only include numbers.")
    .refine((value) => value === "" || Number(value) > 0, {
      message: "Team size must be greater than 0.",
    })
    .refine((value) => value === "" || Number(value) <= 1000000, {
      message: "Team size is too large.",
    }),
  message: z
    .string()
    .max(2000, "Requirements must be 2000 characters or less."),
});

export default function ContactPage() {
  const [form, setForm] = useState<ContactForm>(initialForm);
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setErrors((current) => {
      if (!current[key]) return current;
      return { ...current, [key]: undefined };
    });
    setSubmitted(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function sanitizeForm(values: ContactForm): ContactForm {
    return {
      name: sanitizeText(values.name),
      workEmail: sanitizeEmail(values.workEmail),
      company: sanitizeText(values.company),
      teamSize: sanitizeNumeric(values.teamSize),
      message: sanitizeText(values.message),
    };
  }

  function toFieldErrors(result: z.SafeParseError<ContactForm>) {
    const mapped: ContactFieldErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field !== "string") continue;
      if (!(field in initialForm)) continue;
      if (!mapped[field as keyof ContactForm]) {
        mapped[field as keyof ContactForm] = issue.message;
      }
    }
    return mapped;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sanitized = sanitizeForm(form);
    setForm(sanitized);

    const result = contactFormSchema.safeParse(sanitized);
    if (!result.success) {
      setErrors(toFieldErrors(result));
      return;
    }

    setErrors({});
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(170deg,#e6f4ff_0%,#f7fcff_45%,#eef8ff_100%)] px-6 py-10 text-slate-900 dark:bg-[linear-gradient(170deg,#0f172a_0%,#0b1220_45%,#060b17_100%)] dark:text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-cyan-700 uppercase dark:text-cyan-300">
            Contact Sales
          </p>
          <h1
            id="contact-title"
            className="mt-2 text-4xl font-black tracking-tight sm:text-5xl"
          >
            Enterprise Plan Inquiry
          </h1>
          <p
            id="contact-subtitle"
            className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-700 dark:text-slate-300 sm:text-base"
          >
            Share your requirements and we will propose a custom Enterprise plan
            with the right group limits, support level, and rollout path.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <section
            aria-labelledby="contact-title"
            aria-describedby="contact-subtitle"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8"
          >
            {submitted ? (
              <div
                role="status"
                aria-live="polite"
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                Thanks. Your enterprise request has been recorded.
                <br />
                Our team will reach out at {form.workEmail || "your email"}.
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={handleSubmit}
                noValidate
                aria-describedby="contact-form-help"
              >
                <p
                  id="contact-form-help"
                  className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  All fields marked with * are required.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Full name"
                    id="name"
                    value={form.name}
                    onChange={(value) => update("name", value)}
                    autoComplete="name"
                    error={errors.name}
                    required
                  />
                  <Field
                    label="Work email"
                    id="work-email"
                    type="email"
                    value={form.workEmail}
                    onChange={(value) => update("workEmail", value)}
                    autoComplete="email"
                    error={errors.workEmail}
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Company"
                    id="company"
                    value={form.company}
                    onChange={(value) => update("company", value)}
                    autoComplete="organization"
                    error={errors.company}
                    required
                  />
                  <Field
                    label="Expected team size"
                    id="team-size"
                    value={form.teamSize}
                    onChange={(value) => update("teamSize", value)}
                    placeholder="Example: 800"
                    inputMode="numeric"
                    error={errors.teamSize}
                  />
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Requirements
                  </span>
                  <textarea
                    id="requirements"
                    value={form.message}
                    onChange={(event) => update("message", event.target.value)}
                    placeholder="Tell us your regions, compliance needs, integrations, and support expectations."
                    rows={6}
                    aria-invalid={errors.message ? "true" : undefined}
                    aria-describedby={
                      errors.message
                        ? "requirements-help requirements-error"
                        : "requirements-help"
                    }
                    className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-sky-400 dark:focus:ring-sky-900/60 ${
                      errors.message
                        ? "border-rose-500 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-400 dark:focus:border-rose-300 dark:focus:ring-rose-900/60"
                        : ""
                    }`}
                  />
                  <span
                    id="requirements-help"
                    className="mt-1 block text-xs text-slate-500 dark:text-slate-400"
                  >
                    Include deployment timeline, integrations, and compliance.
                  </span>
                  {errors.message && (
                    <p
                      id="requirements-error"
                      className="mt-1 text-xs text-rose-600"
                    >
                      {errors.message}
                    </p>
                  )}
                </label>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(130deg,#0284c7_0%,#0f766e_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(14,116,144,0.32)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
                >
                  Submit Enterprise Request
                </button>
              </form>
            )}
          </section>

          <aside
            aria-label="Guidance for enterprise inquiry"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8"
          >
            <h2 className="text-xl font-extrabold tracking-tight">
              What to include
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-800 dark:text-slate-200">
              <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                Number of groups and expected members per group
              </li>
              <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                Admin roles, moderation workflow, and governance model
              </li>
              <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                Integration needs for WhatsApp, Telegram, and SMS volume
              </li>
              <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                Security, compliance, or data residency requirements
              </li>
            </ul>

            <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
              Prefer email? Reach us at
              <a
                href="mailto:sales@loopdn.com"
                className="ml-1 font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
              >
                sales@loopdn.com
              </a>
            </div>

            <nav
              aria-label="Contact page actions"
              className="mt-5 flex flex-col gap-2"
            >
              <Link
                href="/pricing/"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
              >
                Back to Pricing
              </Link>
              <Link
                href="/signup/"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
              >
                Start Free While You Wait
              </Link>
            </nav>
          </aside>
        </div>
      </div>
    </main>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
};

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  required,
  autoComplete,
  inputMode,
}: FieldProps) {
  const errorId = `${id}-error`;

  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-required={required ? "true" : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-sky-400 dark:focus:ring-sky-900/60 ${
          error
            ? "border-rose-500 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-400 dark:focus:border-rose-300 dark:focus:ring-rose-900/60"
            : ""
        }`}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      )}
    </label>
  );
}

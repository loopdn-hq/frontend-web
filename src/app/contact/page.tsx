"use client";

import { useState } from "react";
import Link from "next/link";

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

export default function ContactPage() {
  const [form, setForm] = useState<ContactForm>(initialForm);
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(170deg,#e6f4ff_0%,#f7fcff_45%,#eef8ff_100%)] px-6 py-10 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-cyan-700 uppercase">
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
            className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-700 sm:text-base"
          >
            Share your requirements and we will propose a custom Enterprise plan
            with the right group limits, support level, and rollout path.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <section
            aria-labelledby="contact-title"
            aria-describedby="contact-subtitle"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            {submitted ? (
              <div
                role="status"
                aria-live="polite"
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
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
                  className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"
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
                    required
                  />
                  <Field
                    label="Work email"
                    id="work-email"
                    type="email"
                    value={form.workEmail}
                    onChange={(value) => update("workEmail", value)}
                    autoComplete="email"
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
                    required
                  />
                  <Field
                    label="Expected team size"
                    id="team-size"
                    value={form.teamSize}
                    onChange={(value) => update("teamSize", value)}
                    placeholder="Example: 800"
                    inputMode="numeric"
                  />
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Requirements
                  </span>
                  <textarea
                    id="requirements"
                    value={form.message}
                    onChange={(event) => update("message", event.target.value)}
                    placeholder="Tell us your regions, compliance needs, integrations, and support expectations."
                    rows={6}
                    aria-describedby="requirements-help"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-200"
                  />
                  <span
                    id="requirements-help"
                    className="mt-1 block text-xs text-slate-500"
                  >
                    Include deployment timeline, integrations, and compliance.
                  </span>
                </label>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(130deg,#0284c7_0%,#0f766e_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(14,116,144,0.32)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                >
                  Submit Enterprise Request
                </button>
              </form>
            )}
          </section>

          <aside
            aria-label="Guidance for enterprise inquiry"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <h2 className="text-xl font-extrabold tracking-tight">
              What to include
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-800">
              <li className="rounded-xl bg-slate-50 p-3">
                Number of groups and expected members per group
              </li>
              <li className="rounded-xl bg-slate-50 p-3">
                Admin roles, moderation workflow, and governance model
              </li>
              <li className="rounded-xl bg-slate-50 p-3">
                Integration needs for WhatsApp, Telegram, and SMS volume
              </li>
              <li className="rounded-xl bg-slate-50 p-3">
                Security, compliance, or data residency requirements
              </li>
            </ul>

            <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
              Prefer email? Reach us at
              <a
                href="mailto:sales@loopdn.com"
                className="ml-1 font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
              >
                sales@loopdn.com
              </a>
            </div>

            <nav aria-label="Contact page actions" className="mt-5 flex flex-col gap-2">
              <Link
                href="/pricing/"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
              >
                Back to Pricing
              </Link>
              <Link
                href="/signup/"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
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
  type = "text",
  placeholder,
  required,
  autoComplete,
  inputMode,
}: FieldProps) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
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
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-200"
      />
    </label>
  );
}

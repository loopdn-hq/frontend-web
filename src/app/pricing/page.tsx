import Link from "next/link";

type Plan = {
  code: "free" | "premium" | "business" | "enterprise";
  name: string;
  price: string;
  summary: string;
  limits: Array<{ label: string; value: string }>;
  features: string[];
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    code: "free",
    name: "Free",
    price: "$0/mo",
    summary: "For small groups getting started with Loopdn.",
    limits: [
      { label: "Max groups", value: "3" },
      { label: "Members per group", value: "20" },
      { label: "Admins per group", value: "1" },
      { label: "Storage", value: "1 GB" },
    ],
    features: [
      "Web + SMS group messaging",
      "Join by open link, invite, or approval",
      "Core moderation controls",
    ],
  },
  {
    code: "premium",
    name: "Premium",
    price: "$12/mo",
    summary: "For active teams and communities with growth needs.",
    highlighted: true,
    limits: [
      { label: "Max groups", value: "25" },
      { label: "Members per group", value: "250" },
      { label: "Admins per group", value: "5" },
      { label: "Storage", value: "10 GB" },
    ],
    features: [
      "Everything in Free",
      "WhatsApp and Telegram connectors",
      "Priority support",
    ],
  },
  {
    code: "business",
    name: "Business",
    price: "$39/mo",
    summary: "For operations-heavy organizations running many groups.",
    limits: [
      { label: "Max groups", value: "100" },
      { label: "Members per group", value: "1000" },
      { label: "Admins per group", value: "10+" },
      { label: "Storage", value: "50 GB" },
    ],
    features: [
      "Everything in Premium",
      "Stronger admin delegation",
      "Faster support response",
    ],
  },
  {
    code: "enterprise",
    name: "Enterprise",
    price: "Custom",
    summary: "For large organizations requiring custom contracts and limits.",
    limits: [
      { label: "Max groups", value: "Custom" },
      { label: "Members per group", value: "Custom" },
      { label: "Admins per group", value: "Custom" },
      { label: "Storage", value: "Custom" },
    ],
    features: [
      "Custom rollout and support model",
      "Custom security and compliance terms",
      "Dedicated success channel",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_15%,#d7efff_0%,#f0f8ff_45%,#f8fbff_100%)] px-6 py-10 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-sky-700 uppercase">
              Pricing
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              Plans Built For Every Loop
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Choose a plan based on how many groups you run and how large your
              communities are. Limits are enforced to keep plans predictable,
              and you can upgrade anytime.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/contact/"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Contact Sales
            </Link>
            <Link
              href="/signup/"
              className="rounded-xl bg-[linear-gradient(130deg,#0ea5e9_0%,#2563eb_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(14,165,233,0.3)] transition hover:brightness-110"
            >
              Start Free
            </Link>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.code}
              className={`rounded-3xl border p-5 shadow-sm backdrop-blur-sm ${
                plan.highlighted
                  ? "border-sky-300 bg-white shadow-[0_12px_32px_rgba(14,165,233,0.18)]"
                  : "border-slate-200 bg-white/90"
              }`}
            >
              {plan.highlighted && (
                <p className="mb-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-[11px] font-bold tracking-wide text-sky-800 uppercase">
                  Most Popular
                </p>
              )}

              <h2 className="text-2xl font-extrabold">{plan.name}</h2>
              <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                {plan.price}
              </p>
              <p className="mt-3 text-sm text-slate-600">{plan.summary}</p>

              <ul className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-xs">
                {plan.limits.map((limit) => (
                  <li
                    key={limit.label}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-slate-500">{limit.label}</span>
                    <span className="font-semibold text-slate-800">
                      {limit.value}
                    </span>
                  </li>
                ))}
              </ul>

              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="mt-[2px] h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {plan.code === "enterprise" ? (
                  <Link
                    href="/contact/"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Contact Sales
                  </Link>
                ) : (
                  <Link
                    href="/signup/"
                    className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                  >
                    Choose {plan.name}
                  </Link>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-center">
            <div>
              <h3 className="text-2xl font-extrabold tracking-tight">
                Enterprise Needs A Custom Buildout
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
                Enterprise includes custom group and member limits, onboarding,
                support SLAs, and contract terms. Tell us your community size,
                compliance requirements, and rollout timeline.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href="/contact/"
                className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(130deg,#0284c7_0%,#0f766e_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(14,116,144,0.32)] transition hover:brightness-110"
              >
                Request Enterprise Quote
              </Link>
              <Link
                href="/login/"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                I already have an account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

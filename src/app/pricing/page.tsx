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
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_15%,#d7efff_0%,#f0f8ff_45%,#f8fbff_100%)] px-6 py-10 text-slate-900 dark:bg-[radial-gradient(circle_at_20%_15%,#0f172a_0%,#0b1220_45%,#060b17_100%)] dark:text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-sky-700 uppercase dark:text-sky-300">
              Pricing
            </p>
            <h1
              id="pricing-title"
              className="mt-2 text-4xl font-black tracking-tight sm:text-5xl"
            >
              Plans Built For Every Loop
            </h1>
            <p
              id="pricing-subtitle"
              className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-700 dark:text-slate-300 sm:text-base"
            >
              Choose a plan based on how many groups you run and how large your
              communities are. Limits are enforced to keep plans predictable,
              and you can upgrade anytime.
            </p>
          </div>
          <nav aria-label="Pricing actions" className="flex gap-2">
            <Link
              href="/contact/"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
            >
              Contact Sales
            </Link>
            <Link
              href="/signup/"
              className="rounded-xl bg-[linear-gradient(130deg,#0ea5e9_0%,#2563eb_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(14,165,233,0.3)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
            >
              Start Free
            </Link>
          </nav>
        </header>

        <section
          aria-labelledby="pricing-title"
          aria-describedby="pricing-subtitle"
          className="grid gap-5 lg:grid-cols-4"
        >
          {plans.map((plan) => (
            <article
              key={plan.code}
              aria-label={`${plan.name} plan`}
              className={`rounded-3xl border p-5 relative shadow-sm backdrop-blur-sm ${
                plan.highlighted
                  ? "border-sky-300 bg-white shadow-[0_12px_32px_rgba(14,165,233,0.18)] dark:border-sky-700 dark:bg-slate-900 dark:shadow-[0_12px_32px_rgba(2,132,199,0.28)]"
                  : "border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/90"
              }`}
            >
              {plan.highlighted && (
                <p
                  aria-label="Most popular plan"
                  className="mb-3 inline-flex  absolute -top-2 right-3 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-bold tracking-wide text-sky-800 uppercase dark:bg-sky-950/50 border dark:text-sky-300"
                >
                  Most Popular
                </p>
              )}

              <h2 className="text-2xl font-extrabold">{plan.name}</h2>
              <p className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                {plan.price}
              </p>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                {plan.summary}
              </p>

              <dl className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/80">
                {plan.limits.map((limit) => (
                  <div
                    key={limit.label}
                    className="flex items-center justify-between gap-3"
                  >
                    <dt className="text-slate-600 dark:text-slate-300">
                      {limit.label}
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-100">
                      {limit.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <ul
                aria-label={`${plan.name} features`}
                className="mt-4 space-y-2 text-sm text-slate-800 dark:text-slate-200"
              >
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-[2px] h-2 w-2 shrink-0 rounded-full bg-sky-500"
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {plan.code === "enterprise" ? (
                  <Link
                    href="/contact/"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
                  >
                    Contact Sales
                  </Link>
                ) : (
                  <Link
                    href="/signup/"
                    className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
                  >
                    Choose {plan.name}
                  </Link>
                )}
              </div>
            </article>
          ))}
        </section>

        <section
          aria-labelledby="enterprise-section-title"
          className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8"
        >
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-center">
            <div>
              <h2
                id="enterprise-section-title"
                className="text-2xl font-extrabold tracking-tight"
              >
                Enterprise Needs A Custom Buildout
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300 sm:text-base">
                Enterprise includes custom group and member limits, onboarding,
                support SLAs, and contract terms. Tell us your community size,
                compliance requirements, and rollout timeline.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href="/contact/"
                className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(130deg,#0284c7_0%,#0f766e_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(14,116,144,0.32)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
              >
                Request Enterprise Quote
              </Link>
              <Link
                href="/login/"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-sky-300 dark:focus-visible:ring-offset-slate-900"
              >
                I already have an account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

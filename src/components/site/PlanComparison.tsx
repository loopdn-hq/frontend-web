"use client";

import { Check, Minus } from "lucide-react";

export type ComparisonPlan = {
  code: string;
  name: string;
  /** The plan's own `features` array, exactly as the API sends it. */
  features: string[];
};

/**
 * Rows this table will not show, by request: the workspace/admin block.
 * Filtered by name rather than removed from the backend's plan data, which
 * still sells them - this is a decision about the marketing page only.
 */
const HIDDEN_FEATURES = new Set([
  "Workspaces",
  "SSO",
  "API access",
  "Audit logs",
]);

/**
 * A feature that does NOT pass up the ladder.
 *
 * Free's SMS line is a caveat, not a capability - "you must buy credits" -
 * and Premium replaces it with the real thing. Inherited like everything else
 * it would tick against every paid plan and read as a limitation they don't
 * have.
 */
const OWN_TIER_ONLY = new Set([
  "SMS requires PAYG credits or sponsored campaign funding",
]);

/**
 * The same caveat, matched by shape rather than by its exact words.
 *
 * The seeded string is long ("...or sponsored campaign funding") and is the
 * kind of line that gets shortened by whoever edits the plan next. Matched
 * only by equality, a reworded one stops being recognised as a caveat and is
 * inherited like a capability - so every paid plan would advertise that its
 * SMS "requires PAYG credits", which is the opposite of what they sell.
 */
const SMS_CAVEAT = /^sms requires/i;

function isOwnTierOnly(feature: string): boolean {
  return OWN_TIER_ONLY.has(feature) || SMS_CAVEAT.test(feature);
}

/**
 * The floor: what every plan has, Free included.
 *
 * Ticked for all plans whatever their `features` array says, and given a row
 * even if no plan lists them. These are not upsells - they are the product,
 * and a comparison whose Free column is empty next to them reads as "you
 * cannot send a message on the free plan".
 *
 * The seeded Free plan does list all of these, so on stock data this changes
 * nothing; it is here so the floor survives an environment whose plan rows
 * were edited by hand, which is exactly where an empty Free column comes from.
 */
const BASELINE_FEATURES = new Set([
  "Web messaging",
  "Basic message history",
  "Reactions",
  "Reply, edit and delete",
  "Join links/codes",
  "Basic notifications",
]);

/**
 * The order rows appear in, grouped the way the pricing page groups them.
 *
 * Labels are the API's own feature strings, so a row can be matched against
 * what each plan actually reports. Anything the backend adds later that is not
 * listed here still appears, under "More", rather than being silently dropped
 * from the comparison.
 */
const GROUPS: Array<{ title: string; features: string[] }> = [
  {
    title: "Communication",
    features: [
      "Web messaging",
      "Basic message history",
      "Extended message history",
      "Reactions",
      "Reply, edit and delete",
      "Join links/codes",
      "Basic notifications",
      "Advanced notifications",
      "SMS requires PAYG credits or sponsored campaign funding",
      "SMS Pay-As-You-Go Communication Credits",
      "WhatsApp Business integration",
    ],
  },
  {
    title: "Management & moderation",
    features: [
      "Search",
      "Moderation tools",
      "Advanced moderation",
      "Custom group branding",
      "Group management dashboard",
      "Usage controls",
      "Basic analytics",
      "Ad-free",
      "Priority support",
    ],
  },
  {
    title: "Billing & account",
    features: [
      "Communication wallet spending limits",
      "Auto-recharge",
      "Custom retention policies",
      "Dedicated account manager",
      "SLA",
      "Custom volume pricing",
      "Postpaid communication billing option",
    ],
  },
];

/**
 * Whether `plan` at position `index` includes `feature`.
 *
 * CUMULATIVE, because each plan's `features` array lists only what that tier
 * ADDS: Premium says "Extended message history" precisely because Free says
 * "Basic message history", and Enterprise lists none of the messaging basics
 * at all. Read literally, that would mean Enterprise has no web messaging.
 * So a plan includes everything the cheaper plans include - which is what the
 * cheapest-first ordering of this table's columns means.
 */
function includes(
  plans: ComparisonPlan[],
  index: number,
  feature: string,
): boolean {
  if (BASELINE_FEATURES.has(feature)) return true;
  if (isOwnTierOnly(feature)) {
    return plans[index].features.includes(feature);
  }
  return plans
    .slice(0, index + 1)
    .some((plan) => plan.features.includes(feature));
}

function buildRows(plans: ComparisonPlan[]): Array<{
  title: string;
  features: string[];
}> {
  // The baseline is in the table whether or not a plan happens to list it -
  // otherwise the rows every plan shares are the ones most likely to go
  // missing.
  const available = new Set([
    ...BASELINE_FEATURES,
    ...plans
      .flatMap((plan) => plan.features)
      .filter((f) => !HIDDEN_FEATURES.has(f)),
  ]);

  const listed = new Set(GROUPS.flatMap((group) => group.features));
  // A reworded SMS caveat belongs beside the other messaging rows, not in the
  // "More" bucket at the bottom - it is the same row, differently worded.
  const strays = [...available].filter(
    (feature) => !listed.has(feature) && SMS_CAVEAT.test(feature),
  );

  const grouped = GROUPS.map((group) => ({
    title: group.title,
    features: [
      ...group.features.filter((feature) => available.has(feature)),
      ...(group.title === "Communication" ? strays : []),
    ],
  })).filter((group) => group.features.length > 0);

  // Anything the API sent that no group claims - a feature added after this
  // file was written. It still gets a row; a comparison that quietly omits a
  // feature somebody is paying for is worse than one with an odd heading.
  const placed = new Set([...listed, ...strays]);
  const extras = [...available].filter((feature) => !placed.has(feature));

  return extras.length > 0
    ? [...grouped, { title: "More", features: extras }]
    : grouped;
}

/**
 * Every plan against every feature.
 *
 * The cards above say what each plan is for; this says what you actually get,
 * which is the question somebody comparing two of them is asking. Ticks are
 * derived from the plans' own `features` arrays - nothing here is a separate
 * list that could drift from what the API sells.
 */
export function PlanComparison({
  plans,
  currentPlanCode,
}: {
  plans: ComparisonPlan[];
  /** The signed-in account's plan, so its column can be marked. */
  currentPlanCode?: string | null;
}) {
  if (plans.length === 0) return null;
  const groups = buildRows(plans);
  if (groups.length === 0) return null;

  const currentIndex = currentPlanCode
    ? plans.findIndex(
        (plan) => plan.code.toLowerCase() === currentPlanCode.toLowerCase(),
      )
    : -1;

  // The green rectangle is drawn cell by cell rather than as one box: a table
  // has no element that spans a column, and an absolutely positioned overlay
  // would have to guess at column widths that the browser decides at layout.
  // Sides on every cell, a top on the header and a bottom on the last row -
  // which is why the group headings below stop spanning the full width and
  // render a cell per plan instead, or the sides would break at each heading.
  const column = (index: number) =>
    index === currentIndex
      ? "bg-emerald-50/80 border-x-2 border-emerald-400/70 dark:bg-emerald-500/[0.1]"
      : "";

  const lastGroup = groups[groups.length - 1];
  const lastFeature = lastGroup.features[lastGroup.features.length - 1];

  return (
    <section aria-labelledby="plan-comparison-title" className="mt-14">
      {/* The table keeps its width and scrolls sideways on a narrow screen
          rather than wrapping: a comparison whose columns have collapsed into
          each other is no longer a comparison. The feature column is pinned so
          you can still see which row you are reading. */}
      <div className="mt-8 overflow-x-auto rounded-3xl border border-slate-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-white/[0.045]">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            Features included in each Loopd&apos;n plan
          </caption>
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-white/95 px-5 py-4 font-semibold text-slate-900 backdrop-blur dark:bg-[#0c1a3d]/95 dark:text-slate-100"
              >
                Feature
              </th>
              {plans.map((plan, index) => (
                <th
                  key={plan.code}
                  scope="col"
                  className={`px-5 py-4 text-center font-semibold text-slate-900 dark:text-slate-100 ${column(
                    index,
                  )} ${index === currentIndex ? "border-t-2" : ""}`}
                >
                  {plan.name}
                  {index === currentIndex && (
                    <span className="mt-1 block text-2xs font-bold tracking-wide text-emerald-700 uppercase dark:text-emerald-300">
                      Your plan
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {groups.map((group) => (
            <tbody key={group.title}>
              <tr>
                <th
                  scope="colgroup"
                  className="bg-sky-50/70 px-5 py-2.5 text-2xs font-bold tracking-[0.12em] text-sky-700 uppercase dark:bg-sky-500/10 dark:text-sky-300"
                >
                  {group.title}
                </th>
                {plans.map((plan, index) => (
                  <td
                    key={plan.code}
                    className={`bg-sky-50/70 dark:bg-sky-500/10 ${column(index)}`}
                  />
                ))}
              </tr>
              {group.features.map((feature) => (
                <tr
                  key={feature}
                  className="border-t border-slate-100 dark:border-white/[0.06]"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-white/95 px-5 py-3 font-normal text-slate-700 backdrop-blur dark:bg-[#0c1a3d]/95 dark:text-slate-300"
                  >
                    {feature}
                  </th>
                  {plans.map((plan, index) => {
                    const included = includes(plans, index, feature);
                    return (
                      <td
                        key={plan.code}
                        className={`px-5 py-3 text-center ${column(index)} ${
                          index === currentIndex &&
                          group.title === lastGroup.title &&
                          feature === lastFeature
                            ? "border-b-2"
                            : ""
                        }`}
                      >
                        {/* The word is what a screen reader gets; the mark is
                            for everyone else. Neither is colour on its own. */}
                        <span className="sr-only">
                          {included ? "Included" : "Not included"}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                            included
                              ? "bg-sky-500 text-white"
                              : "bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-slate-500"
                          }`}
                        >
                          {included ? (
                            <Check className="h-3 w-3" strokeWidth={3} />
                          ) : (
                            <Minus className="h-3 w-3" strokeWidth={3} />
                          )}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}

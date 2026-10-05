/**
 * What a piece of UI needs before it is shown.
 *
 * One shape for every kind of hiding, which is the point. Before this, a route
 * could be hidden because of a plan (`hasAnalyticsFeature`), because of a role
 * (`conversation.isAdmin`), or because somebody put it in a hardcoded
 * `HIDDEN_DESTINATIONS` set - three mechanisms, none of which knew about the
 * others.
 */
export type Requirement = {
  /** An account-axis feature key, e.g. "commercial.access". */
  account?: string;
  /**
   * A route that exists but is not ready to be offered. Replaces the old
   * HIDDEN_DESTINATIONS set: still one line to hide something, but the same
   * line as every other reason a thing is hidden.
   */
  unreleased?: boolean;
};

export type RequirementContext = {
  features: ReadonlySet<string>;
  /** True while the answer is still in flight. Gates stay CLOSED until then. */
  loading: boolean;
};

/**
 * Whether a requirement is met.
 *
 * An absent requirement means "always show". `loading` closes every gate that
 * asks about features, so a menu does not flash items the viewer turns out not
 * to have - the opposite default would be worse, because a control appearing
 * and then vanishing reads as a bug.
 */
export function meets(
  requirement: Requirement | undefined,
  context: RequirementContext,
): boolean {
  if (!requirement) return true;
  if (requirement.unreleased) return false;
  if (!requirement.account) return true;
  if (context.loading) return false;
  return context.features.has(requirement.account);
}

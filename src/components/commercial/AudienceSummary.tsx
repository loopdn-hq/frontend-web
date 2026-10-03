import {
  countryName,
  regionsOf,
  type CampaignOptions,
} from "@/lib/commercial/useCampaignOptions";
import type { Audience } from "@/lib/commercial/types";

/**
 * A saved audience as three phrases - which groups, where, what size - for
 * whoever lays them out. Empty parts read as "any", which is what they mean.
 */
export function describeAudience(
  audience: Audience,
  country: string,
  options: CampaignOptions,
): { groups: string; where: string; size: string } {
  const categoryLabel = new Map(
    options.categories.map((category) => [category.slug, category.label]),
  );
  const regionName = new Map(
    regionsOf(options, country).map((region) => [region.code, region.name]),
  );
  return {
    groups:
      audience.categories.length === 0
        ? "Any kind of group"
        : audience.categories
            .map((slug) => categoryLabel.get(slug) ?? slug)
            .join(", "),
    where:
      audience.regions.length === 0
        ? `Anywhere in ${countryName(options, country)}`
        : audience.regions
            .map((code) => regionName.get(code) ?? code)
            .join(", "),
    size: groupSize(audience),
  };
}

/**
 * A saved audience in words, as a list. Shared by the builder's review step
 * and anywhere else that wants it plainly.
 */
export function AudienceSummary({
  audience,
  country,
  options,
}: {
  audience: Audience | null;
  country: string;
  options: CampaignOptions;
}) {
  if (!audience) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Not chosen yet.
      </p>
    );
  }

  const { groups, where, size } = describeAudience(audience, country, options);

  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
      <dt className="text-slate-500 dark:text-slate-400">Groups</dt>
      <dd className="text-slate-900 dark:text-slate-100">{groups}</dd>
      <dt className="text-slate-500 dark:text-slate-400">Where</dt>
      <dd className="text-slate-900 dark:text-slate-100">{where}</dd>
      <dt className="text-slate-500 dark:text-slate-400">Group size</dt>
      <dd className="text-slate-900 dark:text-slate-100">{size}</dd>
    </dl>
  );
}

function groupSize({ minGroupSize, maxGroupSize }: Audience): string {
  if (minGroupSize !== null && maxGroupSize !== null) {
    return `${minGroupSize} to ${maxGroupSize} members`;
  }
  if (minGroupSize !== null) return `At least ${minGroupSize} members`;
  if (maxGroupSize !== null) return `Up to ${maxGroupSize} members`;
  return "Any size";
}

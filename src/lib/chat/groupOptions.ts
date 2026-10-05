// What a group may say about itself: the kinds of group, and the places.
// The choices behind GroupSettings.category and .region, the same for every
// group - so read once per page load and shared.

import {
  apiRequest,
  asText,
  isObject,
  isPresent,
  type ApiResult,
} from "@/lib/api/envelope";

export type GroupOptions = {
  categories: { slug: string; label: string }[];
  countries: {
    code: string;
    name: string;
    regions: { code: string; name: string }[];
  }[];
};

let loaded: Promise<ApiResult<GroupOptions>> | null = null;

/** GET /chat/conversations/group-options/, once; a failure is tried again next time. */
export function fetchGroupOptions(): Promise<ApiResult<GroupOptions>> {
  loaded ??= load().then((result) => {
    if (!result.ok) loaded = null;
    return result;
  });
  return loaded;
}

async function load(): Promise<ApiResult<GroupOptions>> {
  const result = await apiRequest(
    "/chat/conversations/group-options/",
    {},
    "Couldn't load the group options.",
  );
  if (!result.ok) return result;
  const data = isObject(result.data) ? result.data : {};
  return {
    ok: true,
    data: {
      categories: rows(data.categories)
        .map((row) =>
          isObject(row)
            ? { slug: asText(row.slug), label: asText(row.label) }
            : null,
        )
        .filter(isPresent),
      countries: rows(data.countries)
        .map((row) =>
          isObject(row)
            ? {
                code: asText(row.code),
                name: asText(row.name),
                regions: rows(row.regions)
                  .map((region) =>
                    isObject(region)
                      ? { code: asText(region.code), name: asText(region.name) }
                      : null,
                  )
                  .filter(isPresent),
              }
            : null,
        )
        .filter(isPresent),
    },
  };
}

function rows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

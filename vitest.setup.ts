import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// React checks this global when act() runs, and warns on every call without
// it. stubGlobal rather than a plain assignment because ES imports hoist:
// React is already loaded by the time a statement in this file executes, and
// this sets the same global object React reads at call time.
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

// next/font is resolved by Next's compiler; outside a Next build the import is
// a function that throws. Any font asked for comes back as an inert class.
vi.mock("next/font/google", () => ({
  __esModule: true,
  ...Object.fromEntries(
    ["Barlow", "Public_Sans", "Space_Mono"].map((name) => [
      name,
      () => ({
        className: `font-${name.toLowerCase()}`,
        variable: `--font-${name.toLowerCase()}`,
        style: { fontFamily: name },
      }),
    ]),
  ),
}));

// Every test starts on an empty document; a modal left mounted by one case
// would be found by the next one's queries.
afterEach(() => {
  cleanup();
});

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Rust build output.
    "src-tauri/target/**",
  ]),
  // Tauri APIs are confined to src/lib/desktop/, where every import of them is
  // dynamic and guarded by isDesktop().
  //
  // They do not fail to COMPILE on the web - they throw at call time, because
  // window.__TAURI_INTERNALS__ is undefined. That is what makes a stray import
  // dangerous: it ships to the web bundle and breaks in front of a user rather
  // than in CI. A boundary that relies on everyone remembering leaks within a
  // month, so it is a lint error instead.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/desktop/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@tauri-apps/*"],
              message:
                "Tauri APIs belong in src/lib/desktop/, behind a guarded dynamic import. " +
                "Import the platform adapter from @/lib/platform instead.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;

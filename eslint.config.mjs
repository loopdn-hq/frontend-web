import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Tauri APIs are confined to src/lib/desktop/, where every import of them is
// dynamic and guarded by isDesktop().
//
// They do not fail to COMPILE on the web - they throw at call time, because
// window.__TAURI_INTERNALS__ is undefined. That is what makes a stray import
// dangerous: it ships to the web bundle and breaks in front of a user rather
// than in CI. A boundary that relies on everyone remembering leaks within a
// month, so it is a lint error instead.
const TAURI_BOUNDARY = {
  group: ["@tauri-apps/*"],
  message:
    "Tauri APIs belong in src/lib/desktop/, behind a guarded dynamic import. " +
    "Import the platform adapter from @/lib/platform instead.",
};

// The commercial area (the root of commercial.loopdn.com) and the chat app are
// two products in one codebase, and neither may reach into the other. See
// docs/commercial-dashboard.md. Shared building blocks - components/ui,
// components/charts, lib/auth, lib/config, lib/rbac, lib/hooks - are open to
// both.
const COMMERCIAL_FILES = [
  "src/app/(commercial)/**",
  "src/components/commercial/**",
  "src/lib/commercial/**",
];

const KEEP_COMMERCIAL_OUT = {
  group: [
    "@/app/(commercial)/**",
    "@/components/commercial/**",
    "@/lib/commercial/**",
  ],
  message:
    "The commercial area is separate from chat. If chat needs something from it, " +
    "move that thing to a shared folder (components/ui, lib/config, ...) instead.",
};

// What lives here assumes the chat shell (AppShellProvider, the chat socket,
// the call layer), which the commercial site never mounts - or it is the PERSON's
// billing wallet, which must never be confused with a company's ad balance.
// `authorizedRequest` is the one thing taken from lib/chat, and LoadFailed the
// one thing taken from components/app.
// The admin site (admin.loopdn.com, every page under /admin/) is Loopd'n's own
// admin tools: a third product in the same build, kept apart from both of the
// others the same way. See docs/admin-site.md.
const ADMIN_FILES = [
  "src/app/(admin)/**",
  "src/components/admin/**",
  "src/lib/admin/**",
];

const KEEP_ADMIN_OUT = {
  group: ["@/app/(admin)/**", "@/components/admin/**", "@/lib/admin/**"],
  message:
    "The admin site is separate from chat and commercial. If they need something " +
    "from it, move that thing to a shared folder (components/ui, lib/rbac, ...).",
};

const KEEP_CHAT_OUT = {
  group: [
    "@/app/(app)/**",
    "@/components/home/**",
    "@/components/calls/**",
    "@/components/settings/**",
    "@/components/app/**",
    "!@/components/app/LoadFailed",
    "@/lib/chat/**",
    "!@/lib/chat/conversations",
    "@/lib/calls/**",
    "@/lib/websocket/**",
    "@/lib/app/AppShellProvider",
    "@/lib/billing",
  ],
  message:
    "The commercial area must not depend on the chat app. Use a shared " +
    "folder (components/ui, lib/config, ...) or add the piece under commercial/.",
};

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
  // Two blocks rather than one per boundary: a later block's options for the
  // same rule REPLACE an earlier block's, they do not merge. So each block
  // repeats the Tauri boundary alongside its own.
  {
    files: ["src/**/*.{ts,tsx}"],
    // src/app/page.tsx is `/` on both sites, so it is the one file outside the
    // commercial area that renders it; it gets the Tauri boundary alone, below.
    ignores: [
      "src/lib/desktop/**",
      "src/app/page.tsx",
      ...COMMERCIAL_FILES,
      ...ADMIN_FILES,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [TAURI_BOUNDARY, KEEP_COMMERCIAL_OUT, KEEP_ADMIN_OUT] },
      ],
    },
  },
  {
    files: ["src/app/page.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [TAURI_BOUNDARY] }],
    },
  },
  {
    files: COMMERCIAL_FILES.map((glob) => `${glob}/*.{ts,tsx}`),
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [TAURI_BOUNDARY, KEEP_CHAT_OUT, KEEP_ADMIN_OUT] },
      ],
    },
  },
  {
    // The admin site takes the same two things from chat that commercial
    // does (LoadFailed, authorizedRequest), and nothing from commercial.
    files: ADMIN_FILES.map((glob) => `${glob}/*.{ts,tsx}`),
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            TAURI_BOUNDARY,
            {
              ...KEEP_CHAT_OUT,
              message:
                "The admin site must not depend on the chat app. Use a shared " +
                "folder (components/ui, lib/rbac, ...) or add the piece under admin/.",
            },
            {
              ...KEEP_COMMERCIAL_OUT,
              message:
                "The admin site must not depend on the commercial area. Use a " +
                "shared folder, or add the piece under admin/.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;

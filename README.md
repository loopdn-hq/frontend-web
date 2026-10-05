# Loopdn Frontend

Loopdn is a community messaging and group management app. This repository is
the web frontend: a Next.js app that is built as a static export, talks to the
Django API over REST and WebSockets, and is also packaged as a desktop app with
Tauri.

## Overview

One build serves three sites, told apart by hostname at runtime (see
`src/lib/config/site.ts`):

| Site       | Host                    | What it is                                       |
| ---------- | ----------------------- | ------------------------------------------------ |
| Chat       | `loopdn.com`            | The messaging app and the public marketing pages |
| Commercial | `commercial.loopdn.com` | The dashboard for companies that buy ads         |
| Admin      | `admin.loopdn.com`      | Loopdn's own admin tools                         |

What the app includes:

- **Auth** - login and signup by email or phone, Google sign-in, email and
  phone verification, password reset, two-factor setup
- **Loops and chats** - create, join and find groups, direct conversations,
  chat or broadcast mode, group admin controls and member moderation
- **Messaging** - REST history and send with Django Channels WebSocket
  updates; reactions, mentions, pins, forwarding, link previews, voice notes
- **Calls** - voice and video calls over LiveKit
- **Notifications** - an activity feed and web push through a service worker
- **Settings** - profile, appearance and colour themes, privacy, security,
  notifications, blocked users
- **Billing** - plans and pricing, the enterprise plan builder, transaction
  history and downloadable receipts
- **WhatsApp** - connecting a group to WhatsApp and inviting people by WhatsApp
- **Commercial site** - companies, the campaign builder, funding, results,
  leads and sponsored cards in group chats
- **Admin site** - campaign review and permissions
- **Desktop app** - the same export wrapped with Tauri

## Tech Stack

- Next.js 16 (App Router, static export) and React 19
- TypeScript
- Tailwind CSS 4
- React Hook Form and Zod
- LiveKit client
- Tauri 2
- Vitest and Testing Library
- ESLint and Prettier

## Prerequisites

- Node.js 20.9 or newer (CI runs on Node.js 24)
- npm
- The Rust toolchain, only if you are building the desktop app

## Running Locally

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` (see `.env.staging.example`) and set the variables under
   [Environment Variables](#environment-variables).

3. Start the development server:

```bash
npm run dev
```

4. Open the app in your browser:

```text
http://localhost:3000              # chat and marketing pages
http://commercial.localhost:3000   # commercial site
http://admin.localhost:3000        # admin site
```

The two subdomains need no setup beyond `allowedDevOrigins` in
`next.config.ts`, which is already there.

## Environment Variables

Every variable is `NEXT_PUBLIC_`, so it is inlined into the bundle at build
time. A static export has no runtime to read it from: changing a value means
rebuilding.

| Variable                       | Required | Purpose                                                                                                               |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`     | Yes      | The backend API root, for example `http://127.0.0.1:8000/api/v1` for local development                                |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes      | The Google OAuth client ID for Google sign-in                                                                         |
| `NEXT_PUBLIC_WS_HOST`          | No       | The WebSocket host, only when it differs from the API host                                                            |
| `NEXT_PUBLIC_PUBLIC_ORIGIN`    | No       | The public web origin for URLs that leave the app. Needed by desktop builds, whose page origin is `tauri://localhost` |
| `NEXT_PUBLIC_BUILD_SHA`        | No       | Identifies the build, for support and bug reports                                                                     |
| `NEXT_PUBLIC_BUILT_AT`         | No       | When the build was made                                                                                               |

Redis configuration such as `REDIS_URL` and `CELERY_BROKER_URL` belongs to the
backend and must not be exposed to the frontend.

## Scripts

```bash
npm run dev            # run the app in development mode on port 3000
npm run build          # build the static export into out/
npm run lint           # run ESLint checks
npm run format         # format files with Prettier
npm run format:check   # verify Prettier formatting
npm run typecheck      # run TypeScript checks
npm run test           # run the unit and component tests once
npm run test:watch     # run the tests in watch mode
npm run test:coverage  # run the tests and enforce the coverage thresholds
npm run tauri:dev      # run the desktop app against the dev server
npm run tauri:build    # build the production desktop app
npm run tauri:build:staging # build the staging desktop app
```

## Production Build

```bash
npm run build
```

`next.config.ts` sets `output: "export"`, so the build is a plain `out/`
directory of HTML, JS and CSS with no Node server. Each route becomes
`<route>/index.html` (`trailingSlash: true`). Serve `out/` with any static file
server to check it locally.

## Testing

Tests are written with Vitest and Testing Library, run in jsdom, and live next
to the code they cover as `*.test.ts` and `*.test.tsx`.

```bash
npm run test
npm run test:coverage
```

- Nothing in a test may reach the network: the API modules and third-party
  SDKs are mocked.
- Coverage counts every file under `src/`, tested or not, and must stay at or
  above 90% of statements, branches, functions and lines. The thresholds are
  set in `vitest.config.ts`, and `npm run test:coverage` fails below them.
- The HTML coverage report is written to `coverage/`.

## Desktop App

The desktop app is the same static export wrapped with Tauri. Its sources are
in `src-tauri/`.

```bash
npm run tauri:dev            # loads http://localhost:3000, API on localhost:8000
npm run tauri:build          # "Loopdn", against api.loopdn.com
npm run tauri:build:staging  # "Loopdn Staging", against api-staging.loopdn.com
```

Each configuration carries its own content security policy, which lists the
API and media hosts that build may reach. A new host has to be added there or
the desktop app will block it.

## Project Structure

```text
public/
  sw.js              # service worker for web push
src/
  app/
    (app)/           # the signed-in app: chats, calls, activity, settings, ...
    (auth)/          # login, signup, verification, password reset
    (commercial)/    # the commercial site
    (admin)/         # the admin site
    billing/         # checkout return pages
    enterprise/      # enterprise plan builder and checkout
    pricing/ contact/ downloads/ privacy/ terms/
    manifest.ts      # web app manifest
  components/
    ui/              # shared primitives: button, modal, input, ...
    app/ auth/ home/ calls/ settings/ charts/
    commercial/ admin/ enterprise/ sponsored/ whatsapp/
    site/ legal/     # marketing and legal pages
  lib/
    api/ config/     # API envelope, HTTP helper, environment and site config
    auth/ user/ rbac/
    app/ chat/ calls/ websocket/
    commercial/ admin/ enterprise/ whatsapp/
    platform/        # web and desktop differences
    theme/ ui/ format/ hooks/ validation/
src-tauri/           # desktop app
```

## Notes

- The browser connects to `/ws/chat/?token=<access token>` for Django Channels.
- Anything that differs by site is decided in the browser, never at module
  scope: a static export is rendered once at build time with no hostname.
- **Web push needs no environment variable.** The VAPID public key is served by
  the API (`GET /push/key/`), because a `NEXT_PUBLIC_` value would be baked into
  the static export and could not be rotated without a rebuild.
- `public/sw.js` is the service worker: it shows notifications and opens the
  conversation they are about. It is deployed as a file at the site root, and
  the deploy workflows re-sync it - and `manifest.webmanifest` - with
  `Cache-Control: no-cache`. Everything else is cached for a year, and a
  service worker cached for a year is one that never updates.
- The manifest (`src/app/manifest.ts`) exists so iPhone and iPad can add the
  site to the Home Screen, which is the only way Safari delivers web push.

## Continuous Integration

GitHub Actions runs on every push and pull request. It installs with `npm ci`
on Node.js 24, then checks linting, Prettier formatting, TypeScript, the tests
with their coverage thresholds, and the production build.

## Continuous Deployment

After CI succeeds, GitHub Actions deploys the `staging` branch to
`https://staging.loopdn.com` and the `production` branch to
`https://loopdn.com`. Both workflows can also be run by hand. Each one:

1. Builds the static export.
2. Archives `out/` to `s3://<S3_BUCKET>-releases/<commit sha>/`, so a rollback
   is a copy rather than a rebuild.
3. Syncs `out/` to the S3 bucket: content-hashed assets cached for a year,
   and HTML, `sw.js` and `manifest.webmanifest` with `no-cache`.
4. Invalidates the CloudFront distribution and waits for it to finish.

The production job uses GitHub's `production` environment. Configure required
reviewers for that environment in the repository settings to require manual
approval before a deployment.

Configure the following GitHub Actions secrets in both the `staging` and
`production` environments:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Configure the following GitHub Actions variables in both environments, with
environment-specific values:

- `AWS_REGION`
- `S3_BUCKET` (the releases bucket is this name with `-releases` appended)
- `CF_DISTRIBUTION_ID`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_WS_HOST`

The AWS credentials need permission to read and write both buckets and to
create and read CloudFront invalidations on the distribution.

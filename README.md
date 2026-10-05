# Field Screening PWA

A mobile-friendly full-stack portfolio project for collecting community screening records where connectivity is unreliable. Use fictional data. The hosted demo is private. It includes a collector form, a device queue, and a review dashboard; these are workflow views rather than separately authenticated roles.

## What the app does

1. A field worker enters a participant code, age, visit location, worker code, screening date, outcome, notes and consent.
2. Every change saves an incomplete draft in IndexedDB on the device. The app restores the most recently edited draft on reload. Existing drafts can be resumed.
3. Submitting validates the form and atomically moves it from the draft store to the queue store. This succeeds without a network connection.
4. When online, the open app sends queued records to the backend. It also retries every 30 seconds and offers a manual sync button. A record is marked synced only after the server confirms its ID.
5. The dashboard loads server records, filters them by review status and opens a detail panel. Reviewers can save a decision and notes.

The outcomes are manually entered labels, not computed diagnoses or recommendations. No patient names, contact details, location tracking or automatic clinical scoring are collected.

## Architecture

- Frontend: React, TypeScript, Vinext (a Vite-powered Next.js-compatible framework), reusable accessible UI primitives, CSS and Lucide icons.
- Local storage: IndexedDB with `drafts` and `queue` stores.
- Offline app: web manifest, installable PNG icons and a service worker. The production build precaches JS/CSS assets and saves the loaded app shell after the first authenticated online visit.
- Backend: Worker-compatible API route handlers.
- Authoritative storage: D1/SQLite; Drizzle defines the schema and produces versioned migrations. Actual queries use prepared statements.
- Tests: Node test runner, SQLite integration, sync recovery tests, service-worker event tests and a real local HTTP smoke test.

## Files to read and edit

| File | Responsibility | Typical change |
| --- | --- | --- |
| `app/page.tsx` | Form, draft recovery, queue, sync triggers, review dashboard | Add a field or improve a screen |
| `app/globals.css` | Theme, layouts, responsive styles | Change spacing, colors or mobile layout |
| `lib/device.ts` | IndexedDB operations and atomic submit/correction | Change device storage behavior |
| `lib/screening.mjs` | Shared validation and sync queue engine | Change required fields or retry rules |
| `lib/screening.d.mts` | Type declarations for shared module | Update TypeScript record shape |
| `lib/server.mjs` | Persistent record creation, list and review | Change server operations |
| `app/api/submissions/route.ts` | HTTP handlers, errors, payload limits, origin checks | Add an API endpoint |
| `db/schema.ts` | Persistent database schema | Add a stored column |
| `db/raw.ts` | Database binding helper | Diagnose missing DB bindings |
| `drizzle/` | Generated SQL migrations and metadata | Generate a new migration after a schema change |
| `public/sw.js` | Offline shell and asset caching | Change the offline cache policy |
| `scripts/prepare-pwa.mjs` | Inserts compiled assets into production precache | Change build-time PWA handling |
| `public/manifest.webmanifest` | Installation metadata | Change app name/icons |
| `app/layout.tsx` | App metadata and viewport | Change browser title and theme |
| `test/` | Validation, storage integration, queue, service worker and HTTP checks | Verify behavior after changes |

To add a form field, update the form, `Screening` type, shared validation, server insert, database schema and relevant tests together, then generate a new migration. Do not rewrite a migration that has been applied to the hosted database.

## Running locally (Windows PowerShell, macOS or Linux)

Use Node **24 or later** for the test suite (`node:sqlite` is required) and Git if cloning. A clean source checkout defaults to the portable runtime; do not copy `node_modules`, `.sites-runtime` or `.wrangler` from another computer.

The project includes `pnpm-lock.yaml`. Activate pnpm using Corepack if available, or install pnpm, then:

```sh
pnpm install --frozen-lockfile
pnpm run build:pwa
```

`build:pwa` builds the Worker and prepares its complete offline asset list. The ordinary build is useful for framework debugging but does not prepare full offline reopening.

Apply the initial migration to the **local** database (once for a fresh local database):

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_dear_shriek.sql
```

Run the compiled app, including its service worker, at a stable local port:

```sh
pnpm start -- --port 8787
```

Open `http://127.0.0.1:8787`. The compiled app runs locally and does not publish or require a Cloudflare account. For UI editing with hot reload, use `pnpm dev` after building/applying migrations and open the printed address. Service workers are deliberately disabled in development mode to prevent stale bundles while editing. Use the compiled production preview for offline acceptance checks.

PowerShell: if your machine blocks `pnpm.ps1`, use `pnpm.cmd` for these commands. No Docker or MySQL is required.

## Tests

```sh
pnpm test
pnpm exec tsc --noEmit
```

With the local compiled app running at port 8787:

```sh
pnpm run test:api
```

To start a temporary compiled server and run the HTTP checks together, use `pnpm run test:http` after applying the local migration.

Verified in this build: 28 automated core/service-worker tests, TypeScript checks, production build, and real HTTP smoke checks. Phone/browser interaction and install testing remain manual acceptance steps. Browser WebMCP navigation is feature-detected; a supported runtime was unavailable for its validation.

The HTTP smoke test creates synthetic data in your local database only and rejects remote hosts. The core suite applies the real migration to an isolated SQLite database and tests production storage functions. Service-worker tests simulate browser events; they do not replace a device/browser test.

## Manual offline acceptance check

1. Open the compiled app while online; wait until it displays **App available offline**.
2. Enter part of a fictional record. Reload and confirm the draft returns.
3. In browser DevTools → Network, select **Offline**. Reload to confirm the form still opens.
4. Complete the record and submit. The Device queue should show **Waiting to sync**.
5. Restore online mode. If DevTools does not fire an online event, use **Sync now**; the 30-second timer will also retry.
6. Confirm the record becomes **Synced** and appears exactly once in the Review dashboard.
7. Open Review, save a status/note and refresh to confirm persistence.
8. Repeat on a phone or a narrow 390px viewport. Check labels, dropdowns, keyboard navigation and scrolling.
9. To test server failure separately from device offline mode, block `/api/submissions` requests, submit and confirm **Retry needed** without losing the record. Unblock and retry.

## API

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/submissions` | Most recent 500 records, newest first |
| POST | `/api/submissions` | Validate and persist a completed screening |
| PATCH | `/api/submissions` | Save review status and notes for an existing ID |

Review values: `Pending review`, `Reviewed`, `Needs follow-up`. POST accepts a UUID v4 `id`, `participant`, `age`, `location`, `worker`, `date`, `outcome`, `notes`, and `consent: true`. The frontend generates the UUID once and reuses it for retries. Repeating the same payload succeeds without another row; reusing an ID with different screening content returns 409. Retrying a record never resets an existing review.

Errors use `{ error, fields? }`. Invalid JSON → 400, cross-origin writes → 403, missing review record → 404, conflicting ID → 409, oversized request → 413, invalid fields → 422, unavailable storage → 503. API responses use `Cache-Control: no-store`; the service worker never caches API or authentication routes.

## Practical limits

- Sync runs while the app is open, on reconnect, at startup and every 30 seconds. There is no promise of closed-app/background upload; mobile browsers differ in background support.
- Offline reopening needs one successful online visit and completed shell caching. The first-ever visit cannot work offline.
- Drafts and queues are local to one browser/device. Clearing browser data, uninstalling or browser storage eviction can remove unsynced work. Successfully synced records remain on the server.
- Review changes require a network connection. Failed changes remain visible in the open detail panel for retry, but they are not stored as offline review drafts.
- The dashboard loads the most recent 500 records. Metrics describe that loaded set. This demo does not implement server pagination or multi-reviewer conflict resolution.
- UUID retries prevent request duplicates, not repeated screening of the same participant under different IDs.
- The hosted app is owner-private. Collector and reviewer views are available to the same authorized user; app-level staff accounts and role restrictions are not implemented.
- Fictional-data portfolio demo. A real screening deployment needs explicit access roles, privacy/consent requirements, retention rules, device security and appropriate review of the screening form.

## Interview explanation

“I built a mobile-first screening PWA that saves drafts and submission queues in IndexedDB, reopens offline through a service worker, and synchronizes records to a backend with idempotent UUIDs. I used atomic local transactions to avoid losing a draft during submission, prepared SQL statements for persistence, recoverable error states for connectivity failures, and a dashboard for review decisions. My tests cover invalid input, repeat requests, database persistence, sync failures and offline shell behavior.”

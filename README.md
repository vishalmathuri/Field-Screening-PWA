# Field Screening PWA

A mobile-friendly screening app for collecting records when internet access is unreliable. Field workers can save drafts on their device, submit records offline, and see whether each record is waiting, needs a retry, or has synced. A dashboard lets users review submitted records and save review decisions.

This portfolio project uses fictional data. Screening outcomes are selected manually; the app does not calculate clinical scores or diagnoses. The hosted demo is private, and the collector and reviewer screens share the same authorized access.

## Features

- Screening form with participant code, age, location, worker code, date, outcome, notes, and consent.
- Draft autosave and recovery through IndexedDB, with saved drafts available to resume.
- Offline submission queue with visible sync status and recoverable errors.
- Automatic sync at startup, on reconnect, and every 30 seconds while the app is open, plus manual sync.
- UUID-based retry handling: sending the same record again does not create another server row or reset its review.
- Review dashboard with status filters, record details, and persistent review notes.
- Installable PWA with a manifest, icons, cached app shell, and production asset precache.
- Responsive layouts for desktop and mobile screens.

## Stack

| Layer | Technology |
| --- | --- |
| Interface | React, TypeScript, reusable UI primitives, CSS, Lucide icons |
| Framework | Vinext, a Vite-powered Next.js-compatible framework |
| Device storage | IndexedDB for drafts and queued submissions |
| Offline support | Service worker and web app manifest |
| Backend | Worker-compatible API route handlers |
| Database | Cloudflare D1 / SQLite, Drizzle schema and SQL migrations |
| Testing | Node test runner, SQLite integration tests, service-worker tests, HTTP smoke tests |

## How it works

Each form change saves a draft locally. Submitting validates the record and moves it from the draft store to the queue in one IndexedDB transaction. This step works offline.

When a connection is available, the open app sends queued records to the API. A record becomes synced only after the server confirms its ID. Temporary failures retain the device copy for retry; permanent validation failures can be corrected. The dashboard reads persisted server records, and review changes are saved through the API.

## Run locally

Use Node.js 24 or later, pnpm, and Git if cloning the repository. Windows PowerShell works; WSL, Docker, and MySQL are not required. On macOS or Linux, use `pnpm` in place of `pnpm.cmd` below.

Run these commands from the project root. The project includes `pnpm-lock.yaml`; install with the frozen lockfile.

### 1. Install and build

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd run build:pwa
```

`build:pwa` builds the application and prepares the offline asset list. Build before applying the migration: the build generates `dist/server/wrangler.json`.

### 2. Initialize a fresh local database

Run once for a new local database:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_dear_shriek.sql
```

This command uses the local database. It does not migrate the hosted database.

### 3. Start the compiled app

```powershell
pnpm.cmd start -- --port 8787
```

Open [http://127.0.0.1:8787](http://127.0.0.1:8787). Local preview does not publish the app or require a Cloudflare account.

For editing with hot reload, run `pnpm.cmd dev` and open the printed address. Service workers are disabled in development mode. Use the compiled app above to test offline reopening. After changing source code, stop the compiled server, rebuild with `build:pwa`, and restart it.

## Tests

Run the automated suite and TypeScript check:

```powershell
pnpm.cmd test
pnpm.cmd exec tsc --noEmit
```

With the compiled app running on port 8787, run this in another terminal:

```powershell
pnpm.cmd run test:api
```

Alternatively, after building and initializing the local database, `pnpm.cmd run test:http` starts a temporary compiled server and runs the HTTP checks.

The current automated suite contains 28 tests covering validation, database persistence, repeat requests, review updates, sync recovery, and service-worker behavior. TypeScript checks, the production PWA build, and real local HTTP smoke checks passed during verification.

Each API smoke test creates one synthetic local submission with a unique `DEMO-HTTP-` participant label. It rejects remote hosts. The core database tests use an isolated SQLite database. Service-worker tests simulate events; browser interactions and installation still need manual checks.

## Manual verification

1. Open the compiled app online and wait for **App available offline**.
2. Enter part of a fictional record, reload, and confirm the draft returns. Check that saved drafts can be resumed.
3. Select **Offline** in DevTools → Network, then reload. The cached app should still open.
4. Complete and submit the record. Confirm it appears in the device queue as **Waiting to sync**.
5. Restore connectivity. Use **Sync now** if DevTools does not trigger a reconnect event.
6. Confirm the record becomes **Synced** and appears once in the review dashboard.
7. Save a review decision and note, then refresh to confirm persistence.
8. Check all three screens at a 390px viewport, including controls, keyboard navigation, and scrolling. Test on a phone when available.
9. Block `/api/submissions` requests to simulate server failure. Confirm the record remains available for retry, then unblock and sync again.

Offline drafts, reconnect sync, review persistence, and a narrow viewport were checked manually during development. A first-ever offline visit cannot load an app shell that has never been cached.

## Project structure

| Path | Responsibility |
| --- | --- |
| `app/page.tsx` | Connects screens and hooks; manages reviews, navigation, and PWA setup |
| `components/screening/ScreeningForm.tsx` | Screening form and device summary |
| `components/screening/DeviceQueue.tsx` | Drafts, queued records, and correction controls |
| `components/screening/ReviewDashboard.tsx` | Submission list, filters, and review details |
| `components/screening/shared.tsx` | Shared display helpers and small UI components |
| `components/screening/types.ts` | Submission type used by the interface |
| `hooks/useScreeningDrafts.ts` | Draft recovery, serialized autosave, validation, submission, and correction |
| `hooks/useSubmissionSync.ts` | Connectivity, sync triggers, queue processing, and sync locking |
| `lib/device.ts` | IndexedDB operations and atomic draft-to-queue transactions |
| `lib/screening.mjs` | Shared validation and sync queue engine |
| `lib/screening.d.mts` | Type declarations for the shared module |
| `lib/server.mjs` | Prepared SQL operations for creation, listing, and review |
| `app/api/submissions/route.ts` | HTTP handlers, origin checks, limits, and structured errors |
| `db/` and `drizzle/` | Database binding, schema, and versioned migrations |
| `public/sw.js` | Offline shell and asset caching |
| `public/manifest.webmanifest` | App installation metadata |
| `scripts/prepare-pwa.mjs` | Adds compiled assets to the production precache |
| `app/globals.css` | Theme, layouts, and responsive styles |
| `test/` | Automated tests and HTTP smoke checks |

Adding a stored screening field requires coordinated changes to the form, record type, validation, server queries, schema, migration, and relevant tests. Do not rewrite a migration already applied to an existing database.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/submissions` | Load the newest 500 submissions |
| POST | `/api/submissions` | Validate and persist a screening record |
| PATCH | `/api/submissions` | Save review status and notes |

POST accepts a UUID v4 `id`, `participant`, `age`, `location`, `worker`, `date`, `outcome`, `notes`, and `consent: true`. The frontend generates the ID once and reuses it for retries. The same ID and content can be retried safely; different content under an existing ID returns `409`.

Review statuses are `Pending review`, `Reviewed`, and `Needs follow-up`. Errors return `{ error, fields? }`. Handlers cover invalid JSON, disallowed write origins, missing records, conflicting IDs, invalid fields, payload limits, and unavailable storage. Responses use `Cache-Control: no-store`, and the service worker does not cache API or authentication routes.

## Screenshots

Capture the three views using fictional records and save the images under `docs/screenshots/`:

| View | Suggested filename |
| --- | --- |
| Screening form | `screening-form.png` |
| Device queue | `device-queue.png` |
| Review dashboard | `review-dashboard.png` |

Add the screenshots to this section after those files exist. Include a mobile view to show the responsive layout.

## Limitations

- Sync requires the app to remain open. Closed-app background upload is not implemented.
- Offline reopening requires a successful online visit and completed caching.
- Drafts and queues belong to one browser/device. Clearing browser storage or storage eviction can remove unsynced work.
- Review changes require connectivity and are not saved as offline review drafts.
- Dashboard counts describe the newest 500 loaded records. Server pagination and concurrent review conflict handling are not implemented.
- UUID-based retries prevent duplicate requests. Separate records for the same participant can still have different IDs.
- Collector and reviewer views do not have separate staff accounts or role permissions.
- This is a fictional-data portfolio demonstration. A real deployment would require access controls, retention policies, device security, and review of the screening workflow.

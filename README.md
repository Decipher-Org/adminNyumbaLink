# adminNyumbaLink

The admin console for NyumbaLink — React 19 + Vite + Tailwind 4 + shadcn/ui, talking
to `propertyHubBackend`.

Every operational value displayed by the console comes from the backend API.
Capabilities without a persisted backend model are omitted instead of represented
with generated data or nonfunctional controls.

---

## Running it

```bash
cp .env.example .env.local     # points at http://localhost:8080 by default
npm install
npm run dev
```

You need the backend running (`cd ../propertyHubBackend && npm run dev`) and an
admin account. There is **no sign-up here** — `POST /sign-up/email` coerces any
self-assigned `ADMIN` down to `TENANT`, so the first admin is provisioned
server-side:

```bash
cd ../propertyHubBackend
node scripts/create-admin.mjs --email you@example.com --password '...' --name 'Your Name'
```

Every admin after that is promoted by an existing one, from the Users screen.

| Script              | Does                              |
| ------------------- | --------------------------------- |
| `npm run dev`       | Vite dev server                   |
| `npm run typecheck` | `tsc -b --noEmit`                 |
| `npm run build`     | Typecheck, then production bundle |
| `npm run preview`   | Serve the built bundle            |

### Configuration and secrets

The only variable this app takes is `VITE_API_URL`. That is deliberate: Vite
inlines every `VITE_*` value into the shipped JavaScript in plain text, so a
secret here is a secret published. `DATABASE_URL`, `BETTER_AUTH_SECRET`, the
Resend key and the M-Pesa credentials all stay in `propertyHubBackend/.env` and
are never referenced from this project.

Sessions are Better Auth's opaque rolling token, held in Redis server-side. The
client stores only the token and sends `Authorization: Bearer`. A `401` clears it
at the single choke point in `lib/api/client.ts`; a `403` deliberately does not,
because an admin who demotes themselves needs to see that answer rather than be
silently logged out.

---

## Deploying to Vercel

`vercel.json` carries the whole deploy: framework, build command, output directory,
the SPA rewrite, cache headers and security headers. Point a Vercel project at this
directory and it builds. If the repository root is `propertyHub/`, set **Root
Directory** to `adminNyumbaLink` — that is also what makes Vercel read this
`vercel.json` instead of looking for one at the top. The build command is
`npm run build`, which typechecks first, so a type error fails the deploy rather
than shipping. Output is static; there are no functions and no Node runtime.

`VITE_API_URL` is set in `build.env` rather than the dashboard, so a fresh project
builds correctly with nothing configured. That is safe for this one variable and
only this one — an API origin is public the moment the browser requests it. Nothing
else goes there: Vite inlines every `VITE_*` into the bundle in plain text, which is
why the backend's secrets are not referenced anywhere in this project.

It is inlined **at build time**, so changing the API origin is a redeploy, not a
restart. `vite.config.ts` fails the build outright if the variable is missing or
`http://` while `VERCEL` is set, because the `http://localhost:8080` default would
otherwise ship happily and then present as a backend outage.

### The backend has to allow the origin

This is the thing most likely to break an otherwise-correct deploy.
`propertyHubBackend/.env` currently reads:

```
CORS_ORIGIN=https://nyumbalink.co.ke,https://admin.nyumbalink.co.ke
BETTER_AUTH_TRUSTED_ORIGINS=https://nyumbalink.co.ke,https://admin.nyumbalink.co.ke
```

Both are strict comma-separated allowlists, so **`https://admin.nyumbalink.co.ke`
already works** — assign that domain in Vercel and there is nothing to change
server-side. Any other origin, every `*.vercel.app` preview URL included, is
rejected by CORS before Better Auth is even reached: the login POST fails and the
console looks broken rather than misconfigured. Add such an origin to _both_
variables — `CORS_ORIGIN` for the browser, `BETTER_AUTH_TRUSTED_ORIGINS` for Better
Auth's own origin check — and restart the API.

### What the headers do

- `/(.*)` → `/index.html` is the catch-all react-router needs. Vercel checks the
  filesystem first, so `/assets/*`, the favicons and `site.webmanifest` still serve
  as themselves; only unmatched paths reach the app, which renders its own
  `NotFound`.
- `/assets/*` is `immutable` for a year because Vite fingerprints those filenames.
  Everything else is `max-age=0, must-revalidate` — `index.html`, the icons and the
  manifest keep their names forever, and a cached `index.html` would pin a browser
  to a bundle that no longer exists.
- `X-Robots-Tag: noindex` matches the `<meta>` already in `index.html`; the header
  also covers the assets a meta tag cannot reach.
- The session token lives in `localStorage` (`lib/auth/session.ts`), so
  `script-src 'self'` is the directive that actually matters — injected script is
  what would read it. The built `index.html` contains no inline `<script>`, so
  `'self'` needs no nonce or hash.

**The CSP is the one header not verified against a real deploy.** It is derived from
what the bundle demonstrably does: Google Fonts (`style-src` and `font-src` allow
`fonts.googleapis.com` and `fonts.gstatic.com`), Radix and sonner injecting `<style>`
tags at runtime (`'unsafe-inline'` in `style-src`), and landlord photos and property
images arriving as arbitrary API URLs (`img-src https:`). `connect-src 'self' https:`
is deliberately loose because this file cannot know each environment's API origin;
narrow it to `https://api.nyumbalink.co.ke` if you don't need previews pointing
elsewhere. If something renders unstyled or an image fails, the browser console names
the directive that blocked it — and deleting the `Content-Security-Policy` entry is a
safe one-line rollback that leaves every other header in place.

---

## What is real and what is not

Ten authenticated screens use live backend data.

| Screen            | Live capability |
| ----------------- | --------------- |
| **Dashboard**     | Headline counts, revenue trend, subscription mix, report alerts, and recent audit activity from `GET /admin/dashboard` |
| **Landlords**     | Pending/approved queues, approval, account suspension, identity details, property counts, and subscription coverage |
| **Users**         | List and filter accounts, change roles, suspend with a stored reason, and reinstate |
| **Properties**    | Live listings with landlord and server-side county, town, estate, rent, and bedroom filters |
| **Payments**      | Filterable payment monitoring, revenue series, and manual reconciliation |
| **Subscriptions** | Per-property listing terms, capacity, grants, and active/lapsed filtering |
| **Reports**       | Listing report queues, filtering, detail inspection, atomic listing hiding, and resolution |
| **Audit log**     | Paginated administrative history with target, date, and text filters plus CSV export |
| **Notifications** | Server notifications with read state, filtering, pagination, and browser push |
| **Settings**      | Profile, password, account state, API connection, and sign out |

Reports are fully backed by Milestone 10 database schema (`ListingReport` & `AdminAuditLog`), API routes, and admin UI.

### Departures from the mockup, and why

- **Landlord "Location" column and "All Locations" filter** — `LandlordProfile` has
  no county/town/estate. Deriving it from their listings isn't possible either:
  `GET /properties` has no `landlordId` parameter. Replaced with Business and
  Properties (both real) plus a real account-status filter.
- **User "Location" column** — same reason; shows Phone instead.
- **Users "All Roles" dropdown** — would duplicate the tab row directly above it, so
  it filters account status instead.
- **An "Approved" tab** on the queue, beyond the mockup's three: `verified=true` is
  real, and a queue you cannot look behind is a dead end.
- **Properties "All Status"** — the endpoint hardcodes `status: "ACTIVE"` for any
  caller who isn't the owning landlord. ACTIVE is live; the other three are sample
  rows, merged on page 1 only so paging the real catalogue doesn't inflate every
  page.

---

## Endpoints used

Everything under `/api/v1`, plus Better Auth's own `/api/auth` (raw JSON, no
envelope — hence two callers in `lib/api/client.ts`).

```
POST   /api/auth/sign-in/email          Login
GET    /api/auth/get-session            Rehydrate a stored token
POST   /api/auth/sign-out               Logout
POST   /api/auth/email-otp/*            Password reset (delivery is a server-side stub)

GET    /admin/dashboard                All headline counts, three grouped queries
GET    /admin/users                     ?page&limit&role&status&search
GET    /admin/users/:id
PATCH  /admin/users/:id/role            CANNOT_DEMOTE_SELF; revokes the target's sessions
PATCH  /admin/users/:id/suspend         Requires a non-empty reason; CANNOT_SUSPEND_SELF
PATCH  /admin/users/:id/reinstate       USER_NOT_SUSPENDED when already active
GET    /admin/landlords                 ?page&limit&verified&status&search
PATCH  /admin/landlords/:id/approve     Idempotent — takes the *profile* id, not the user id
GET    /admin/payments                  Paginated payment monitoring
GET    /admin/payments/revenue          7/30/90-day settled revenue series
POST   /payments/:id/reconcile          Shared owner/admin recovery endpoint
GET    /admin/subscriptions             Listing terms and unit capacity
GET    /admin/reports                   ?page&limit&status&reason&search
PATCH  /admin/reports/:id/resolve       Review, dismiss, resolve, or hide listing
GET    /admin/audit-logs                Searchable administrative history

GET    /properties                      ?county&town&estate&minPrice&maxPrice&bedrooms&page&limit
GET    /properties/:id                  403 PROPERTY_HIDDEN for anything not ACTIVE

GET    /users/me                        Settings
PATCH  /users/me                        Name, phone
PATCH  /users/me/password               Revokes every other session
```

All admin endpoints listed above are mounted in `routes/admin.js`. Payment
reconciliation intentionally remains on the shared `/payments/:id/reconcile` route;
the backend authorizes either the payment owner or an administrator and records an
admin audit entry for the latter.

Two rate limits shape how this app behaves: 300 requests / 15 min authenticated,
and 10 auth attempts / 15 min. Bulk approve therefore loops sequentially rather
than firing a burst, and reports partial failure honestly ("N approved, M failed").

---

## The connection-pool episode

Worth keeping, because it explains why nothing in this console fans out and why
`lib/api/concurrency.ts` exists.

`propertyHubBackend/.env` used to point Prisma at Supabase's pgbouncer pooler with
`connection_limit=1`. That is Supabase's advice for _serverless_ functions, where
each invocation is its own short-lived process. The API is one long-lived container,
so it gave the whole process a single connection to a database in `eu-central-1` — a
TCP connect there measures 0.5–2.7s from Nairobi, and a query round trip about a
second. Prisma queues every query onto that connection and throws once one has waited
`pool_timeout` (10s) for it.

The dashboard opened with seven concurrent requests, and each admin list route runs
its own two-query `Promise.all` server-side: fourteen serialised queries. Replayed
against the API, it was an exact staircase:

```
200 2.2s   200 4.2s   200 6.3s   200 8.1s   200 9.8s   500 10.0s   500 10.1s
```

Nothing was failing. The last two were starving. React's StrictMode doubles the
mount in development, which is why the browser console showed six.

**Both ends were fixed.** On the backend: `connection_limit=10&pool_timeout=20`, and
a new `GET /admin/dashboard` that answers all of these counts in three grouped
queries — one `groupBy` over `(role, status)` replaces five separate counts. On this
side: `REQUEST_CONCURRENCY` caps in-flight requests, and the dashboard's two
remaining calls run in sequence.

Replaying that same seven-request fan-out afterwards:

```
200 0.9s   200 1.8s   200 1.9s   200 1.9s   200 1.9s   200 1.9s   200 2.4s
```

Parallel, not single-file. And what the dashboard now actually issues is two requests:
`/admin/dashboard` in 0.84s, then a page of properties for the areas panel in 0.84s.
Fifteen seconds and two 500s became under two seconds and no errors.

The cap stays — at four, chosen against the pool rather than guessed. Each admin list
route runs two queries, so four in flight occupies eight of ten connections, and the
StrictMode double-mount that briefly wants sixteen drains in two waves well inside the
twenty-second timeout. It still matters for `listPropertiesWithLandlord`, which is N+1
over a page of listings — the one caller where the number changes anything measurable.

`fetchPlatformCounts` prefers `/admin/dashboard` and falls back to the six
`limit=1` list calls on a 404. That fallback is not defensive habit — this endpoint
sat documented-but-unmounted in API.md for three milestones, so a missing route is a
state this console has already had to survive. A 404 is an unambiguous signal, since
`/admin/*` runs `requireAuth` before routing and an unauthorised caller gets 401 or
403 instead (verified: unauthenticated requests to it return `401
AUTHENTICATION_REQUIRED`, never 404).

If a screen ever shows _The server couldn't answer_ with `HTTP 500 ·
INTERNAL_SERVER_ERROR`, check the API log for `Timed out fetching a new connection
from the connection pool` before looking anywhere else.

### Dashboard data

`GET /admin/dashboard` supplies the counts, revenue, subscription state, report
state, and recent administrative activity displayed on the overview. The console
does not infer historical growth, traffic, or engagement metrics that the backend
does not collect.

---

## Mobile

The design is desktop, but the console has to work on a phone — an approval queue
gets worked from wherever the operator is.

- Sidebar at `lg`+; below that, a top bar with a slide-out menu and a **bottom tab
  bar** — the four screens an operator lives in, plus a "More" tab that opens the
  full menu (carrying the unread badge so nothing hides behind it).
- Every table is a real `<Table>` at `md`+ **mirrored by a card list** below it
  (`md:hidden`) — not a horizontally scrolling table, which is unusable one-handed.
- Tab rows scroll horizontally instead of wrapping: four labels with counts don't
  fit at 360px, and a wrapped second line pushes the table below the fold.
- Filters live in a sheet on small screens, with the active ones as removable chips.
- Toasts stay top-right at every breakpoint so they never collide with the tab bar.
- Charts are hand-drawn inline SVG (no charting library) with `viewBox` scaling and
  an `aria-label` summary, so they reflow instead of overflowing.

---

## Layout

```
src/
  components/
    app/          AdminShell, PageHeader/Panel, StatCard, charts, StatusBadge,
                  Pagination, SearchInput/Toolbar, States, RangeSelect
    ui/           shadcn primitives (new-york, neutral, CSS variables)
  lib/
    api/          client (two callers) · types · auth · admin · properties · me
                  concurrency (why nothing here fans out)
    auth/         AuthProvider, ProtectedRoute/GuestOnlyRoute, session storage
    hooks/        useAsync (abort-safe) · useDebouncedValue (350ms)
    format.ts     KES, compact numbers, dates, relative time, locations
    export-csv.ts CSV with formula-injection guarding and a scope note
  pages/          Login + the ten screens + NotFound
```

Two conventions worth knowing before you edit:

- **`useAsync`'s fetcher is read through a ref**, so it must not close over state
  that isn't also in `deps`. Its `setData` exists so a mutation's own response can
  patch one row in place — approving a landlord shouldn't blank the queue.

## Verified against a live backend

Typecheck and production build both pass. The endpoint shapes above were checked
against a running backend with an admin session: `/admin/users` and
`/admin/landlords` return `{success, data: [...], pagination}` with exactly the
fields `lib/api/types.ts` declares, and `/users/me` returns the narrower serialiser
(no suspension columns) that `MyProfile` models.

The dev database had **no ACTIVE properties** at the time of checking, which
exercises the fallback paths: the dashboard's top-areas panel falls back to sample
areas and says so, and Properties shows only the labelled non-live rows.

The deploy config was checked as far as it can be without deploying: building with
`VERCEL=1` and the production origin inlines `https://api.nyumbalink.co.ke` into the
bundle and leaves no `localhost` anywhere in it, and building with the variable
removed fails with the message quoted above instead of succeeding quietly. The CSP
is the stated exception — a header can only be confirmed against a real response.

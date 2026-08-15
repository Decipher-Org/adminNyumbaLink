# adminNyumbaLink

The admin console for NyumbaLink — React 19 + Vite + Tailwind 4 + shadcn/ui, talking
to `propertyHubBackend`.

The backend is complete through **Milestone 3** (auth, users/roles, landlord
profiles and approval, properties and units). Milestones 4–10 — payments,
subscriptions, search, notifications, reviews/favourites, jobs and the admin
analytics endpoints — are not built. This console covers the whole design anyway:
what exists is wired to the real API, and what doesn't is a labelled demo.

**Every invented number is badged.** An operator suspends accounts and approves
landlords on the strength of what this screen tells them, so a fake figure that
looks real is not a cosmetic problem. Hover any `Sample` badge and it names the
milestone that will make it real; whole-screen demos lead with a banner instead.

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

| Script              | Does                                  |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Vite dev server                       |
| `npm run typecheck` | `tsc -b --noEmit`                     |
| `npm run build`     | Typecheck, then production bundle     |
| `npm run preview`   | Serve the built bundle                |

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

## What is real and what is not

Ten screens. Roughly half the console runs on live data.

| Screen            | Real                                                                                        | Demo                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Dashboard**     | All five headline counts, from `GET /admin/dashboard` (three grouped queries)                 | Growth percentages, both trend charts, subscription mix, activity feed      |
| **Landlords**     | Pending/approved queues, approve, suspend-instead-of-reject, business name, property counts  | Document checklists, rejection history, bulk-endpoint (loops one at a time)  |
| **Users**         | List, filter by role and status, change role, suspend with reason, reinstate                 | "Add user" (no create endpoint — explains the real 3-step path)              |
| **Properties**    | Live listings with landlord, county/town/estate/price/bedroom filters (server-side)          | Draft/hidden/archived rows, view counts, title search, "Add property"       |
| **Payments**      | —                                                                                            | Everything (Milestone 4: no payments table, no M-Pesa)                      |
| **Subscriptions** | Landlord count                                                                               | Plans, renewals, status mix (backend returns a constant `"PENDING"`)        |
| **Reports**       | —                                                                                            | Everything (nothing can report a listing and nowhere stores one)            |
| **Analytics**     | Which areas rank, and their listing counts, grouped from `GET /properties`                   | Views, visitors, inquiries, favourites, device split                        |
| **Notifications** | —                                                                                            | Everything (Milestone 7); read state is local to the tab                    |
| **Settings**      | Your name and phone (`PATCH /users/me`), your password (`PATCH /users/me/password`), sign out | Platform toggles — shown read-only with the reason, not as a fake form      |

Three of those demos are fake for a harder reason than a missing endpoint: there
is nowhere in the schema to put the data.

- **Verification documents** — a landlord submits a national ID *number*. No file
  is uploaded, so there is nothing to review or count.
- **Rejection history** — approval is one `verified` boolean. There is no rejected
  state and no column for a reason, so a rejection cannot be recorded. The ✗
  action offers the nearest real, reversible power instead: suspend the account
  with a reason.
- **Reports** — tenants have no way to flag a listing and no table stores one.

The tooltips say which kind each is, because "coming in Milestone 10" and "needs a
schema change" are different promises.

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

GET    /properties                      ?county&town&estate&minPrice&maxPrice&bedrooms&page&limit
GET    /properties/:id                  403 PROPERTY_HIDDEN for anything not ACTIVE

GET    /users/me                        Settings
PATCH  /users/me                        Name, phone
PATCH  /users/me/password               Revokes every other session
```

`/admin/payments` and `/admin/reports` appear in `API.md` but are not mounted in
`routes/admin.js`. Nothing here calls them. `/admin/dashboard` was in the same state
until this console needed it; it is now implemented, and the client still falls back
gracefully if it answers 404.

Two rate limits shape how this app behaves: 300 requests / 15 min authenticated,
and 10 auth attempts / 15 min. Bulk approve therefore loops sequentially rather
than firing a burst, and reports partial failure honestly ("N approved, M failed").

---

## The connection-pool episode

Worth keeping, because it explains why nothing in this console fans out and why
`lib/api/concurrency.ts` exists.

`propertyHubBackend/.env` used to point Prisma at Supabase's pgbouncer pooler with
`connection_limit=1`. That is Supabase's advice for *serverless* functions, where
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

If a screen ever shows *The server couldn't answer* with `HTTP 500 ·
INTERNAL_SERVER_ERROR`, check the API log for `Timed out fetching a new connection
from the connection pool` before looking anywhere else.

### What `/admin/dashboard` does not return

API.md originally specified it returning `todaysPayments`, `monthlyRevenue`,
`expiredSubscriptions`, `pendingPayments` and `reportedListings`. Five of those seven
fields have no table behind them, so the implemented endpoint **omits** them rather
than returning zeros, and API.md has been corrected to match.

That is the same rule the rest of this console runs on, applied one layer down: a
zero from a real endpoint cannot be told apart from a true count of none. A client
has no way to distinguish "no revenue yet" from "revenue is not implemented", so
those figures would have arrived unlabelled through the one channel this app treats
as trustworthy. They stay in `lib/demo/` with a badge until the tables exist.

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
                  DemoBadge, Pagination, SearchInput/Toolbar, States, RangeSelect
    ui/           shadcn primitives (new-york, neutral, CSS variables)
  lib/
    api/          client (two callers) · types · auth · admin · properties · me
                  concurrency (why nothing here fans out)
    auth/         AuthProvider, ProtectedRoute/GuestOnlyRoute, session storage
    demo/         registry (what's fake and why) · dashboard · finance · ops · seed
    hooks/        useAsync (abort-safe) · useDebouncedValue (350ms)
    format.ts     KES, compact numbers, dates, relative time, locations
    export-csv.ts CSV with formula-injection guarding and a scope note
  pages/          Login + the ten screens + NotFound
```

Two conventions worth knowing before you edit:

- **`lib/demo/registry.ts` is the source of truth for honesty.** Every fake value
  goes through a `DemoFeatureId`, so a badge, a tooltip and a banner can never
  disagree about what is real. Adding demo data without registering it is the one
  thing to avoid.
- **`useAsync`'s fetcher is read through a ref**, so it must not close over state
  that isn't also in `deps`. Its `setData` exists so a mutation's own response can
  patch one row in place — approving a landlord shouldn't blank the queue.

Sample data is seeded from a string hash (`lib/demo/seed.ts`), not `Math.random()`,
so a given row shows the same numbers on every render and reload.

---

## Verified against a live backend

Typecheck and production build both pass. The endpoint shapes above were checked
against a running backend with an admin session: `/admin/users` and
`/admin/landlords` return `{success, data: [...], pagination}` with exactly the
fields `lib/api/types.ts` declares, and `/users/me` returns the narrower serialiser
(no suspension columns) that `MyProfile` models.

The dev database had **no ACTIVE properties** at the time of checking, which
exercises the fallback paths: the dashboard's top-areas panel falls back to sample
areas and says so, and Properties shows only the labelled non-live rows.

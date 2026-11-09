# Corral build plan (supersedes the original BUILD-PLAN)

## Context
You need a live, deployed project plus its public GitHub repo for the ACM.Industry 2027 application, due in about 10 days (around Nov 18–19). The ChatGPT PRD and build plan are solid but sized for 2–3 weeks, and they skip the "technically interesting" angle reviewers mention. This plan keeps the PRD's core: a private shared board, quick capture, a linked map, comparison, and status plus next action. It also:
- compresses the schedule to 10 days with a hard feature freeze,
- adds one stretch feature, **AI listing import**: paste a listing's text and get structured fields back to review before saving,
- removes steps that are risky on a short timeline,
- lives in its own repo (`cmendietaa/corral-housing`).

## Changes to the PRD and build plan
| Original | Change | Why |
|---|---|---|
| Sign-in method left open | **Google OAuth through Supabase only** | Supabase's built-in email sender is limited to a few emails per hour, so magic links would break during review. You already set up Google OAuth for FlowState. |
| "Add a listing URL" only | URL **plus optional "paste listing text → Autofill"** | Speeds up the PRD's under-30-seconds capture goal and adds the AI/structured-output work. It parses pasted text only and never scrapes URLs: listing sites block scrapers, and the PRD defers scraping. |
| Days 11–15 roommate trial | 30-minute hallway test with 1–2 friends on day 7 | There isn't time for a full trial. |
| Demo uses localStorage | Same, plus a **Reset demo** button and a "Fictional data" banner | Required by the PRD's demo acceptance check. |
| Filters and rent split are optional | Equal-share rent per person on cards (cheap) and a status filter, only if done by day 8 | Low cost and visible value. |
| Realtime and notifications | Still deferred | Not worth the time. Members refresh to see changes. |

## Stack
- Next.js (App Router) + TypeScript + Tailwind v4, matching FlowState's versions in its `package.json`.
- Supabase Auth (Google) + Postgres + RLS, using `@supabase/ssr` so access is checked on the server.
- react-leaflet with OpenStreetMap or MapTiler tiles and visible attribution. Pins are placed by hand: click the map to set or correct a pin's coordinates.
- Zod schemas shared by the forms, the API and the AI output.
- AI autofill uses the Claude API or OpenAI, whichever key you have, with structured JSON output. If there's no key, a deterministic regex parser takes over. FlowState's `app/api/parse-task/route.ts` already uses this AI-plus-fallback pattern (see `fallbackParsedTask`), so reuse it. The public demo can run on the fallback parser at no cost, and the AI path is rate-limited.
- Vitest for unit tests and Playwright for end-to-end tests. Both are already available in this environment.
- Vercel for deployment from GitHub.

### Reusable from FlowState (copy, don't link)
- `components/ui/*`: the button, badge, input, panel and skeleton primitives
- `lib/utils.ts`: the `cn` helper
- `lib/supabase.ts`: the env-var fallback that switches to demo mode when Supabase keys are missing
- `supabase/schema.sql`: the pattern for policies that are safe to rerun

## Data model (`supabase/migrations/0001_init.sql`)
- `boards(id, name, lease_year, created_by, created_at)`
- `board_members(board_id, user_id, role, joined_at)`, primary key `(board_id, user_id)`
- `invites(token uuid, board_id, created_by, expires_at, revoked)`
- `listings(id, board_id, title, address, url check (url ~ '^https?://'), rent_cents null, beds null, baths null, lease_start, lease_end, parking, laundry, lat, lng, status enum, starred bool, notes, updated_by, updated_at)`
- `next_actions(id, listing_id, description, assignee_id null, due_date null, done)`
- RLS: every table allows a read or write only when the user is a member, checked by `exists (select 1 from board_members where board_id = … and user_id = auth.uid())`. Invites are redeemed through a `security definer` function `redeem_invite(token)` that checks the expiry date and inserts the membership. Users can't insert into `board_members` directly.

## App structure
- `/`: landing page with a **Try demo** button and a sign-in button
- `/demo`: the fictional board, stored in localStorage
- `/boards` (list) and `/boards/[id]` (private board)
- `/invite/[token]`: redeems an invite, or shows a clear message for an invalid or expired one
- One `<Board>` UI component takes a `BoardStore` interface with two implementations, `localStore` and `supabaseStore`. The demo and private boards share all their UI, and the demo never touches the database.
- Components: `ListingList`, `ListingCard`, `MapPanel` (loaded client-side only, so a map failure doesn't block the list), `QuickAddDialog` (with the Autofill box), `CompareView` (2–3 places, fixed row order, "Unknown" for missing values, stacked layout on phones), `StatusSelect`, `NextActionEditor`, and a mobile toggle between List and Map.
- `lib/compare.ts`: sorting where unknown rent sorts last and never passes a budget check, plus rent per person. It gets unit tests.

## Schedule (today is Nov 9)
| Days | Build | Checkpoint |
|---|---|---|
| 1 (Nov 9–10) | Create the repo, scaffold, write `CLAUDE.md` and PRD.md, connect Vercel, deploy a hello page | The production URL opens in incognito |
| 2–3 | Demo board: fixture of 6 IV/Goleta places, list, quick add, status, next action, star, localStorage, reset | Add, edit and change a status, refresh, and the data persists |
| 3–4 | Linked map and compare view, mobile layout | Clicking a pin selects its card and the reverse; comparison works at 375px |
| 5–6 | Supabase schema and RLS, Google sign-in, boards, invites, `supabaseStore` | Two accounts collaborate; a third is denied by URL **and** by a direct REST call |
| 7 | AI autofill and fallback parser; hallway test | Paste a Craigslist-style listing and the fields fill in |
| 8 | Polish from the test, rent split and status filter if time allows | |
| 9 | **Feature freeze.** Playwright E2E tests, security review, README with screenshots, architecture, tradeoffs | |
| 10 | Production checks on phone and desktop while logged out, then submit | |

Cut order if behind: filter, rent split, AI autofill (keep the fallback parser), mobile polish. Never cut the demo, map, comparison or next actions.

## Plugins and tools
**Install these in your Claude Code (claude.ai → plugins). All are in the Anthropic Directory:**
1. **frontend-design** (Anthropic): helps the UI look designed rather than generic. Use it on day 8 polish and the compare view.
2. **supabase** (official, Supabase): Postgres and RLS best-practice skills, plus an MCP server. Point it at a dev project in read-only mode, and keep schema changes in migration files.
3. **vercel** (official, Vercel): env vars, deploy status and Next.js best-practice skills. It helps on day 1 and when debugging deploys.

**Built into Claude Code:**
- `/security-review` and `/code-review`: run them before the freeze, focused on RLS and the invite function
- Playwright (dev dependency): run the app and take screenshots to verify each milestone

Skip these: Figma and similar connectors aren't needed, and community Supabase plugins duplicate the official one.

## What you'll need to do yourself
1. ~~Create the GitHub repo~~ Done: `cmendietaa/corral-housing`.
2. Create a Supabase project, enable the Google provider, and add the Vercel and localhost URLs to its redirect allow-list.
3. Import the repo into Vercel and set the env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and an optional LLM key.
4. Optionally create a MapTiler key restricted to your domain. Otherwise use OSM tiles.

## Verification
- `npm run lint && npm test && npm run build` pass every day.
- Playwright (`e2e/`):
  1. Demo flow: add a place, compare it, set a next action, reload and it persists, then reset.
  2. Outsider denied: a seeded third user gets no data on `/boards/[id]` and a 0-row or 403 response from the Supabase REST API.
  3. An expired invite shows an error.
- Manual check before submitting: incognito on desktop and phone (Playwright iPhone emulation plus a real phone), and verify the repo has no `.env*` secrets.

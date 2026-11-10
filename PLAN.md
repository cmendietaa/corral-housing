# Corral build plan (v2, supersedes v1)

Deployed project + public repo for the ACM.Industry 2027 application, due around Nov 18–19. Day numbers are a guide, not a deadline: finishing early is better.

- Production: https://corral-housing.vercel.app (auto-deploys from `main`)
- Repo: https://github.com/cmendietaa/corral-housing
- Supabase project: `corral-housing` (ref `hdqguzucyunmtanmazst`, us-west-1)

## Changes to the PRD and original build plan
| Original | Change | Why |
|---|---|---|
| Sign-in method left open | Google OAuth through Supabase only | Supabase's built-in email sender is rate-limited, so magic links would break during review |
| URL capture only | Optional "paste listing text → Autofill". Claude Haiku returns structured JSON; a regex fallback parser runs when there's no key or the rate limit is hit | Supports the under-30-seconds capture goal and adds the AI angle. Parses pasted text only, never scrapes |
| `next_actions` table | One next action per place, stored as columns on `listings` | The PRD defines one next action per place. Columns keep RLS to a single table check |
| Roommate trial on days 11–15 | 30-minute hallway test with 1–2 friends | No time for a full trial |
| Optional extras | Rent per person plus a per-person budget badge (unknown rent shows "Rent unknown", never "Within budget"), and a status filter | Cheap and visible |
| Google fonts | Caprasimo (display) and Figtree (text), both OFL and self-hosted via @fontsource | No Google fetches at build or runtime |
| — | Street View thumbnail per place via `/api/streetview` (key server-side, IV/Goleta area only, fixed size, metadata checked first) | A quick look at the street without leaving the board; hidden when no key is set |
| — | Footer: "Not affiliated with UCSB. Demo data is fictional." | Avoids implying an official product |

## Decisions
- **Look: Corral v2, "surfboard corral"** (from the Claude Design handoff, Nov 9; replaces Coastal IV). Tokens in `app/globals.css`: Shell ground, sunset for actions, Del Playa sea for selection, sea glass for demo and tours. A sunset-into-sea header band with a sun, a 4-color stripe and a wave edge, once per surface. Roommates are crew boards; the logo is three boards and a rope. Caprasimo for display, Figtree for text, both self-hosted. Two contrast fixes from the handoff: Tar text on sunset buttons, and a deeper green behind the Applied chip (plus a darker checkbox ring and star).
  - **Map tab** (default): 540px ledger left, map right with a 200px top-left curve. Rows: compare check and star, Street View board, street-first name with area (IV / Goleta), status and OWNER · DUE, rent and per person. "Still in the running" then "Washed out" (Passed and Unavailable; display copy only).
  - **Map:** MapLibre with OpenFreeMap tiles in the v2 palette (Shell land, sea-200 water, white roads). Pins are rent-tag pills in the status chip colors; the selected one is sea-700. Opens on the main cluster, clear of the place card, with "Show all places".
  - **Selected place:** a card over the map (Street View, status menu, next step, Open listing, Edit details). On phones, a full-screen place sheet; on the phone map, a mini card above the switch.
  - **Status tab:** four columns plus a "Washed out" shelf; cards move with a "Move" menu. Phones swipe columns with jump chips.
  - **Compare:** check up to 3; a sea-800 tray offers Compare at 2+. The compare view keeps a fixed row order, highlights the best value per row, and never shows unknown rent as within budget.
  - Phones: List / Map / Status switch at the bottom.
- **Scope:** the demo plus private boards (auth, invites, RLS).
- **Extras:** AI listing autofill only. Distance to campus, dark mode and an activity feed are out.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (`@supabase/ssr`, Google auth, Postgres, RLS) · MapLibre GL v5 + OpenFreeMap vector tiles (no API key), restyled to the Coastal IV palette · Zod · Vitest · Playwright · Vercel.

## Architecture
- **Routes:** `/` landing (Try demo, Sign in). `/demo` fictional board in localStorage with Reset and a "Fictional data" banner. `/boards` your boards, `/boards/[id]` a private board. `/invite/[token]` redeems an invite or explains why it's invalid or expired. `/auth/callback` handles sign-in. `/api/parse-listing` runs AI autofill.
- **Storage split:** one `<Board>` client component receives a `BoardStore` (`load`, `addListing`, `updateListing`, `deleteListing`, optional `reset`). `lib/stores/local.ts` backs the demo; `lib/stores/supabase.ts` backs private boards. The demo store never imports the Supabase client.
- **Core types:** `lib/listing.ts` (Listing, Board, Member, statuses, parking/laundry enums, Zod schemas with an http(s)-only URL rule). `lib/compare.ts` (unknown-last sorting, rent per person, budget check where unknown never passes, compare rows, formatters).
- **Components** (`components/board/`): `Board`, `ListingRow`, `PlaceCard` / `PlaceSheet` / `MapMiniCard`, `ListingForm` (add/edit, Autofill box later), `MapPanel`, `CompareView` and `CompareTray`, `StatusBoard`, `NextAction`, `StreetPhoto` (with the dashed-boards fallback). Brand pieces in `components/brand/` (`Band`, crew boards, fence footer, logo).
  - `MapPanel` loads via `next/dynamic` with `ssr: false` inside an error boundary, so a map failure never blocks the list.
  - Rent-tag markers are HTML buttons (keyboard-focusable, labeled with street and rent). The selected tag can be dragged; selecting a place without coordinates and clicking the map places it.
  - MapLibre is pinned to v5: v6 loads its worker from a separate ES module that Next's bundler doesn't emit, which left the map blank.
  - `CompareView` handles 2–3 places, shows "Unknown" explicitly, highlights the best value per row, and stacks rows on phones.
- **Demo fixture (`lib/demo-fixture.ts`):** 6 fictional places on real IV and Goleta streets, 4 fictional roommates. Includes an unknown-rent place, one without a pin, a Passed place, one in Goleta, and the PRD example (Sabado Tarde, Contacted, "Ask whether parking is included", assigned to Maya, due Friday).
- **Database (`supabase/migrations/`):**
  - `boards`, `board_members(board_id, user_id, display_name, role)`, `invites(token, board_id, expires_at, revoked)`, `listings` (with next-action columns, `url check (url ~ '^https?://')`, status enum).
  - RLS on every table: `exists (select 1 from board_members where board_id = … and user_id = auth.uid())`. No direct inserts into `board_members`; `security definer` functions `create_board()` and `redeem_invite(token)` are the only way in.
- **AI route:** server-only `ANTHROPIC_API_KEY`, `claude-haiku-5-5`, JSON output validated with Zod. Pasted text capped at ~8k chars, ~10 calls/hour per IP, falls back to `lib/parse-listing.ts` on any error. Autofilled fields are always reviewed before saving.

## Schedule
| Day | Build | Checkpoint |
|---|---|---|
| 1 | Theme tokens, fixture, local store, list, quick add, status, next action, star, reset. Vercel connected | Production `/demo` opens in incognito; add a place, refresh, it persists |
| 2 | Linked map with pin placement and dragging; compare tray and view | Pin and card select each other both ways; comparison readable at 375px |
| 3 | Status (kanban) tab and mobile List/Map toggle | Changing a status moves the card; the whole demo works at iPhone size |
| 4–6 | Supabase schema and RLS, Google sign-in, boards, invites, Supabase store | Two accounts collaborate; a third is denied by URL and by direct REST call |
| 7 | Fallback parser with unit tests, then the AI route. Hallway test | Paste a Craigslist-style listing and the fields fill in |
| 8 | Fixes from the hallway test, design polish, kanban drag-and-drop if time | — |
| 9 | Feature freeze. Playwright E2E, security review of RLS and invites, README with screenshots, architecture and tradeoffs | — |
| 10 | Production checks on phone and desktop while logged out, then submit | — |

**Cut order if behind:** kanban drag-and-drop, status filter, AI route (keep fallback parser), Status tab, mobile polish. Never cut the demo, map, comparison or next actions. If private boards aren't solid by day 8, ship the demo plus sign-in and describe private boards honestly in the README.

## Setup status
- [x] GitHub repo, Vercel project linked with Git auto-deploys
- [x] Supabase project created and linked; `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set in Vercel
- [x] Google provider enabled in Supabase (client ID/secret, redirect URI `https://hdqguzucyunmtanmazst.supabase.co/auth/v1/callback`) and URL allow-list
- [x] Schema and RLS applied (`supabase/migrations/`); `supabase/tests/rls_check.sql` passes against the project (owner, invited member, outsider, anon)
- [ ] Optional: `ANTHROPIC_API_KEY` in Vercel (added by the owner with `vercel env add`) — autofill is built (`/api/parse-listing`, `lib/parse-listing.ts`, `lib/ai-extract.ts`); without a key it uses the parser
- [ ] Optional: `GOOGLE_MAPS_API_KEY` (Street View Static API, server-only) in Vercel and `.env.local`, then redeploy. Photos stay hidden until it's set.

## Verification
- Every commit: `npm run lint && npm test && npm run build`.
- Vitest: `lib/compare.ts`, `lib/listing.ts` (rejects `javascript:` URLs), `lib/stores/local.ts`, `lib/parse-listing.ts`.
- Playwright (`e2e/`): demo flow at desktop and iPhone sizes (add, compare, next action, reload persists, reset); two browser contexts have isolated demo data; invalid invite shows the error page; an outsider gets 0 rows from the REST API for another board and is refused on writes.
- Before submitting: incognito on a real phone and desktop; `git ls-files | grep -i '\.env'` shows only `.env.example`.

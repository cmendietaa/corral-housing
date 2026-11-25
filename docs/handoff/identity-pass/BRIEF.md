# Identity pass: build brief

**For:** a coding agent (Codex) building Corral's identity pass.
**Goal:** the screens that still use generic UI (Status, Rank, Compare, Edit, Settings, next steps, the board list, loading) should look like Corral, using the motifs we already have plus a few new ones.
**Behavior doesn't change.** Same data, same features, same store calls. This is a visual and interaction pass only.

## Before you start

1. Read `CLAUDE.md` (project rules), `README.md` → "Design identity" (the motifs and rules), and `AGENTS.md` (this Next.js version differs from what you know: read `node_modules/next/dist/docs/` before using Next APIs).
2. Branch from `main` and call it `identity-pass`. If PR #1 (`add-flow-settings-send`) hasn't merged yet, branch from that branch instead, because this work builds on its add flow.
3. Look at the designs in this folder:
   - `designs/*.png`: what each screen should look like (desktop 1280×900, phone 390×844).
   - `designs/*.html`: the same designs as static HTML. Open them for exact sizes, radii and colors. They are mockups, not code to paste: rebuild them with the app's components and Tailwind tokens.
   - `before/*.png`: what those screens look like today.
4. The mockups simplify the board header: keep the app's current header (`Band` + `BandToggle`) as it is. This pass is about what's below it.
5. The mockups use sample labels. Where they differ from the app, **the app's real data wins**. For example, the Rank factors are `price, bike, bedrooms, bathrooms, amenities` with `LEVEL_LABELS` from `lib/rank.ts`, not the "Laundry / Lease dates" rows in the mockup.

## Ground rules (from CLAUDE.md, and they apply to you)

- No new dependencies. No database or migration changes. Don't touch `lib/link-import/`, `app/api/`, `lib/stores/` or `supabase/`.
- The demo (`/demo`) uses localStorage only and must never touch the database.
- Use the Tailwind tokens in `app/globals.css` (`shell`, `sunset-*`, `sea-*`, `glass-*`, `stone-*`, `st-*`), not raw hex. The hex-to-token table is below.
- **Little small print.** No helper sentence under every heading or label. No sparkles for AI. No pale info boxes with an icon. No ruled lines between sections. Lucide icons are fine only for plain controls (close, back, plus, minus, chevrons).
- **Motifs for decoration, counts and scenes; familiar symbols for controls.** A control whose meaning isn't obvious gets a familiar symbol or a word. One symbol means one thing everywhere.
- Respect `prefers-reduced-motion`. Any new animation gets a reduced-motion override in `app/globals.css`, like the existing `corral-*` ones.
- Accessibility stays at least as good as now: real buttons and radios, visible focus rings (`ring-focus`), accessible names, and contrast that passes AA.
- **Keep accessible names stable where tests use them**, or update the tests in the same commit:
  - `Add X to shortlist` / `Remove X from shortlist` (star)
  - `Compare X` (compare toggle)
  - `Move X to another status`
  - Form labels such as `Rent for the whole place`, `Bedrooms` (shows "Studio" for 0), `Listing link`, `Address`
  - The view tabs `Map` / `Status` / `Rank`
  - `Board settings`, `Edit details`
  - Run `grep -rn "getByRole\|getByLabel\|getByText" e2e/` to see the rest.
- Commits: one commit per numbered step below, all in one PR. No `Co-Authored-By` or "Generated with…" lines in commits or the PR.
- Before every commit run:
  ```
  npm run lint && npx tsc --noEmit && npm test && npm run build
  ```
  Before the PR, also run `npm run test:e2e` (desktop, iPhone and Safari projects). Report anything you couldn't verify.

## Palette: mockup hex → Tailwind token

| Hex in mockups | Token |
|---|---|
| `#fdf2ea` | `shell` |
| `#fff9f5` | `shell-light` |
| `#f8e3d7` / `#f6e3d7` | `shell-deep` |
| `#f6eae3` / `#f6ece3` | `shell-mid` |
| `#201e1d` | `tar` |
| `#fff2eb` `#ffe1d0` `#ffc6a5` `#f6a06b` `#d67f48` `#b2622d` `#8c491a` `#643312` | `sunset-100` `200` `300` `400` `500` `600` `700` `800` |
| `#e5f5fd` `#97cceb` `#458ebb` `#1c5b82` `#0b4163` | `sea-100` `300` `500` `700` `800` |
| `#e1eecc` `#8fa073` `#5f6c47` `#3d472b` | `glass-200` `glass-500` `st-applied-bg` `glass-800` |
| `#dcd3c4` `#c0b6a5` `#82796a` `#645c50` `#474238` | `stone-300` `400` `600` `700` `800` |
| `#9c3d1f` | `danger` (`#a63a24`) |

Status colors already exist as `st-<status>`, `st-<status>-bg` and `st-<status>-dot`.

## What exists already (reuse it)

- `components/brand/motifs.tsx`: `FENCE_COLORS`, `FenceRow`, `SunMark`, `LassoIcon`, `FenceIcon`, `HorizonSunIcon`, `PinIcon`, `PencilIcon`, `SettingSun`.
- `components/brand/band.tsx`: `Band`, `BandSun`, `CrewBoards`, `CrewPill`, `BandToggle`, `FenceFooter`, `FinePrint`.
- `components/board/add-place.tsx` has private helpers that the edit form needs too: `Tile`, `Stepper` (with `zeroLabel="Studio"`), `Choices`, `FenceCount`, `FieldError`.
- `components/board/street-photo.tsx`: `StreetPhoto`, `FenceFallback`.
- Place thumbnails are already "fence boards": `rounded-t-[28px] rounded-b-[12px]` in `listing-row.tsx` and `place-card.tsx`. Keep that shape everywhere a place photo shows.
- CSS: `.corral-stripe-x`, `.corral-wave-top`, and the `corral-*` keyframes in `app/globals.css`.

## The work, in order (one commit each)

### 1. Shared pieces

Create these, each small and documented. Put icons in `components/brand/motifs.tsx` and the rest in a new `components/board/fields.tsx`.

- **Move the add-flow helpers.** Move `Tile`, `Stepper`, `Choices` and `FieldError` from `add-place.tsx` into `components/board/fields.tsx` and export them. The add flow imports them from there; it must look and behave exactly the same.
- **Shortlist star.** Keep the star (a horseshoe was tried and dropped: nobody guesses what it means). On: filled `sunset-500` with a `sunset-600` outline. Off: `stone-600` outline. See `designs/pieces.png`.
- **`RopeInToggle`** (compare). Uses `LassoIcon`. Off: dashed stroke in `stone-600`, label "Rope in". On: solid `sea-700` with a light `sea` fill, label "Roped in". It's a toggle button (`aria-pressed`) whose accessible name stays `Compare <place>`.
- **`RopeTagButton`.** The rent-tag shape (`rounded-l-[10px] rounded-r-[20px]`, with a small knot dot on the left) used as a button. Colors come from props.
  - Don't write `999px` on one side and a small radius on the other: browsers scale every corner down and the tag turns into a box. Use about half the height on the round side.
- **`EmptyLot`** (no photo). A pale sunset sky (`sunset-200`), a sun (`sunset-100`) sitting on a row of fence boards in `FENCE_COLORS`. It fills whatever fence-board frame it's in. It replaces `FenceFallback` and the "No street photo here" text wherever a place has no photo (list thumbnails, place card, status cards, compare columns, rank cards). Purely decorative: `aria-hidden`.
- **`FitFence`** (rank score). Five equal fence boards, read like a five-star rating: each board is 2 points, filled from the bottom in `sea-700` (full, half, or empty, rounded to the nearest half), with a `sea-700` outline. One color only: mixed colors read as decoration. Next to it, the number in `font-display` and one word ("6.3 · Good fit"):
  - 8 and up: "Great fit"
  - 6 and up: "Good fit"
  - 4 and up: "Okay fit"
  - otherwise: "Long shot"

  Give the meter `aria-label="Fit 6.3 out of 10"`.
- **`GateLoading`.** Five fence boards rising one after another, with "Opening the gate…" under them. It replaces the gray pulsing skeleton in `board.tsx` (`aria-busy` stays). Reduced motion: show the boards standing, no animation.

### 2. Favorite and compare everywhere

- Restyle the star (see step 1) in `listing-row.tsx` (`StarButton`), `status-board.tsx` (`StarOverlay`) and `place-card.tsx`. Keep the same props, the same `aria-pressed` and the same shortlist labels.
- Swap the compare circle and checkbox for `RopeInToggle` in `listing-row.tsx` and `rank-view.tsx`.
- `CompareTray` (`compare-view.tsx`): show the count as fence boards (one solid board per roped place, a dashed one for each open slot up to 3), plus "N roped in". The button reads "Side by side" and opens the same Compare view as now.

### 3. Empty lot

Replace the no-photo states with `EmptyLot` (see step 1). Remove the dashed-building icon and the "No street photo here" text.

### 4. Status board

**Files:** `status-board.tsx`. **Designs:** `designs/status.png`, `designs/phone-status.png`.

- Each stage column is one tall fence board: very rounded top (`rounded-t-[120px]`, `rounded-b-[24px]`) with a light wash of that stage's color.
- The column header is centered: a mini fence with one board per place (`FenceCount`-style), the stage name in `font-display`, and "N places" under it. Drop the dot-and-uppercase label.
- Cards are compact:
  - A fence-board thumbnail on the left (photo or `EmptyLot`).
  - Name, star, a meta line, and rent in `font-display`.
  - The next step as one line: the roommate's little board in their color, the text, and the day.
- Replace the "Move ▾" select with a `RopeTagButton` that moves the place to the next stage: "Move to Contacted" / "Move to Tour scheduled" / "Move to Applied". Each button is tinted with the next stage's colors.
  - Applied has no next stage, so its button reads "Move…".
  - Every card still needs a way to reach any status, including Passed and Unavailable. Keep a small menu (the existing select, restyled) reachable from the button or next to it, and keep the `Move X to another status` label on it.
- **Washed out** (Passed + Unavailable) sits at the right like the shore: a `sea-100` panel with a wave edge on top (`.corral-wave-top` or a radial-gradient scallop). Each place is a leaning `stone-400` board with its name, the status and the rent. Under them, "Bring one back" opens the same move menu.
- **Phone** (`designs/phone-status.png`): replace the scrolling stage pills with a row of fence boards, one per stage (count in `font-display`, short name under it). The current stage stands taller with a ring. Tapping one shows that stage's cards. Keep any swipe behavior you already have; if there is none, tapping is enough.

### 5. Rank

**Files:** `rank-view.tsx`. **Design:** `designs/rank.png`.

- **Priorities panel:**
  - Title "What matters to you". No sentence under it.
  - Must-haves become tags: set ones solid-outlined, unset ones dashed. The max-rent tag holds the inline dollar input.
  - Weights become `LevelControl` restyled as fence boards: a leaning gray board for "Don't care", then three boards that get taller (sunset-400/500/600 when on, outlined when off), with `LEVEL_LABELS[value]` beside them. Keep the radio-group semantics.
- **Close call:** replace the green box with one plain line under the heading (no icon: the knot read as a little person).
- **Rank cards:**
  - A big fence-board photo on the left.
  - The rank number on a small fence-board badge: #1 `sunset-500`, #2 `sunset-400`, #3 `sunset-300`.
  - Name and rent per person in `font-display`.
  - `FitFence` instead of the score and bar.
  - Reasons stay as lines with a plain "+" (`sea-700`) or "−" (`sunset-600`) in front. Don't use `SunMark` here: it means "Corral found this in the listing".
  - "Why?" becomes "See the math", opening the existing breakdown.
  - `RopeInToggle` for compare.
- **Places that can't be ranked ("Might fit, missing info"):** a dashed `sunset-600` rope outline, with the missing fact as a dashed tag ("Rent not listed") and an "Add it" link that opens edit.
- **Phone:** the priorities sheet uses the same restyled pieces. The cards stack.

### 6. Compare

**Files:** `compare-view.tsx`. **Design:** `designs/compare.png`.

- Header band: "← Back to the board" on the left, "Side by side" centered in `font-display`, and the budget as a rent tag on the right. Use the existing band, stripe and wave.
- Each place is a column shaped like a tall fence board (`rounded-t-[160px]`), with the street photo (or `EmptyLot`) filling the arch, then the name and the nickname with a "Listing ↗" link.
- Rows have no ruled lines: alternate soft bands (`shell-mid` / transparent) running across the labels and every column.
- The best value in a row gets a `sunset-200` pill with a small "· Best" in `sunset-700` after the value, instead of the blue pill. No `SunMark` (it means "Corral found this").
- Keep the existing rules for "best" and for unknown values. Columns end after their last row; they don't stretch to the bottom.

### 7. Edit a place

**Files:** `listing-form.tsx` (`Section`, `Field` and `Select` mostly go away). **Design:** `designs/edit.png`.

The edit dialog uses the add flow's check-screen layout:

- **Place card:** fence-board street photo, the name as a big inline input with an underline, the address with `PinIcon`, and the "Pinned · N min bike to campus" chip.
- **Tile grid** (`Tile`, three columns on desktop, two on phone):
  - Rent, with "$N each · fits the budget" under it when known.
  - Bedrooms and Bathrooms with `Stepper` (bedrooms has `zeroLabel="Studio"`).
  - Lease (two date fields).
  - Laundry and Parking with `Choices`.
- **One bottom card:** the link input plus a "Round it up again" button with `LassoIcon`, which runs the existing link read. Then the notes.
- **Footer:** "Remove from board" on the left in the danger color with a small leaning board. "Cancel" and "Save changes" (sunset-500, `font-display`) on the right.
- **Remove:**
  - The "Autofill from the listing" box with the sparkle icon. Screenshot and paste autofill stay reachable: put them behind a quiet "Paste text or a screenshot" link in the bottom card, opening the existing panel.
  - The "Only a name is required…" sentence.
  - The "if there is one" and "required · A nickname…" small print.
  - The section titles with lines under them.
- Validation, `FieldError`, the photo controls and the delete confirmation behave exactly as now.

### 8. Settings

**Files:** `board-settings.tsx`. **Design:** `designs/settings.png`.

- **Top of the dialog:** a sunset band with "Board name" and the name as a big inline input (dashed underline), the sun, the stripe and the wave. Saving works as it does now.
- **Lease year:** chips (current year ±1, plus whatever is saved).
- **Budget per person:** a rent-tag input.
- **"The crew":** each roommate is a tall fence board in their color (the same color order as `CrewPill`), with their initial at the top and their name under it.
  - The owner has the pale sun behind their board and "Owner" under it.
  - You are marked "(you)"; tapping your own board opens rename.
  - Tapping another person's board selects it (ring) and shows one row: their name, "Hand the board to <name>" (owner only) and "Remove" (owner only), using the existing confirmations.
  - A dashed board labelled "Invite" comes last and does what the board's Invite button does now (`makeInviteLink` in `board.tsx`, then `InviteDialog`): pass that into the settings dialog. Private boards only; the demo hides it.
- **Invite links:** rope tags ("Maya's link · open 6 more days") with Copy and Turn off.
- **Send to Corral:** one `sea-100` row with `LassoIcon` and "Set it up", which expands the existing `SendSetup`.
- **"Low tide"** at the bottom: a wave edge, then "Leave the board" and "Delete the board" (the same type-the-name confirmation). No red box.
- In the demo, owner-only actions stay hidden as now.

### 9. Next step editor

**Files:** `next-action.tsx`. **Design:** `designs/pieces.png` (bottom left).

- The text input stays.
- **Who:** the roommates as small fence boards you tap (a radio group). The chosen one stands taller with a ring. "Unassigned" stays as an option (a dashed board).
- **By:** chips for "Today", "Tomorrow", the next two weekday names, and "Pick a date". "Pick a date" reveals the existing date input.
- Save keeps the existing behavior. A failed save keeps the editor open: `onSave` resolves `false`, and that's already handled.

### 10. Your boards and sign in

**Files:** `app/boards/page.tsx`, `app/boards/new-board-form.tsx`, `components/auth/sign-in-button.tsx`. **Design:** `designs/boards.png`.

- **Signed out:** "The gate's open" with an open-gate illustration (two posts, gate boards swung open, the sun behind). Then one line ("Your boards are shared only with the roommates you invite."), the Google button (keep Google's own button style), and "Or wander the demo board".
- **Signed in:** "Your boards". Each board is a card: a mini fence of its roommates' colors, the name in `font-display`, and "N roommates · N places · Lease YYYY–YY". The page already loads the roommates and the place count (`listings(count)`), so no new query is needed.
- "Start a new board" is a dashed card with a dashed board, and it opens the existing new-board form.

## Done means

- [ ] Every screen above matches its design closely at 1280 wide. The phone layouts work at 375 wide with no sideways scrolling.
- [ ] No sparkle icons, pale info boxes, plain checkboxes, dashed building icons or ruled section lines remain on these screens.
- [ ] Lint, typecheck, unit tests, build and e2e (`desktop`, `iphone`, `safari`) all pass. Tests changed only where a label or structure really changed.
- [ ] Reduced motion checked: no movement with `prefers-reduced-motion: reduce`.
- [ ] One PR, one commit per step. The PR description has before/after screenshots for each screen, taken in Safari's engine (`npx playwright test --project=safari`, or a Playwright WebKit script).
- [ ] README → "Design identity" has rows for the new motifs (lasso = compare, empty lot = no photo, fit fence = rank score, rope-tag button = move along).

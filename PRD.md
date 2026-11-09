# Corral: PRD

v0.2 · ACM.Industry application scope. Revised from v0.1; see PLAN.md for what changed and why.

## Problem
UCSB roommate groups searching for a whole apartment or house often look independently and share promising links in a group chat. It becomes hard to remember what the group found, compare places consistently, or tell whether anyone followed up. Groups want to keep looking while making progress on promising options.

## Product
A private shared board for existing roommate groups looking for off-campus leases in Isla Vista and Goleta. Members save places from any source, see them on one map, compare them side by side, and assign the next action for each place.

## Core workflow
1. Create a named board for a lease year and invite roommates via a link. An invite allows a signed-in user (Google sign-in) to join. A board URL alone does not grant access.
2. Add a listing URL and an address or descriptive title. Enter monthly whole-unit rent and bedroom count if known. Optionally paste the listing's text and use **Autofill** to pre-fill fields for review. Add the remaining facts later. Open the original source for current availability or to apply.
3. Browse a list beside the map on desktop. On phones, switch between list and map. Selecting a pin selects the corresponding card. Listings without coordinates remain visible in the list and comparison.
4. Select two or three properties for side-by-side comparison. Compare rent, bedrooms, bathrooms, lease dates, parking and laundry. Show unknown information explicitly. Use a shared star to keep a shortlist without changing a property's status.
5. Record the status and, when useful, a next action. For example, set a Sabado Tarde place to Contacted and assign "Ask whether parking is included" to a roommate by Friday. Other members see the update when they next load or refresh.

## V1 requirements and acceptance criteria
| Capability | Acceptance check |
|---|---|
| Private group workspace | In separate browser sessions, a creator makes a board, an invited roommate joins and can edit, and a signed-in outsider cannot read or modify the board even with its URL. Invalid or expired invitations show a helpful error. |
| Quick capture | A member can add a place with just a URL and address or title, then reopen and edit it. Unknown rent and bedrooms render as Unknown. URLs open the original source and accept only HTTP(S). |
| Autofill (stretch) | Pasting listing text fills rent, beds, baths, lease dates and address for review before saving. Without an AI key, a deterministic parser fills what it can. Listing URLs are never scraped. |
| Map | The map opens centered on IV and Goleta. Members can drop or correct a pin. Selecting a pin selects the corresponding listing, and selecting a mapped listing highlights its pin. Missing coordinates or map failure do not block the list or comparison. |
| Comparison | Members select two or three places and compare the same rows in a consistent order. Unknown rent does not sort as zero or appear to meet a budget. The comparison is readable on a phone. |
| Progress | Shared status supports Considering, Contacted, Tour scheduled, Applied, Passed and Unavailable. A separate next action has a description and optional assignee and due date. Changes persist after reload. The shortlist star is independent of status. |
| Reviewer demo | A public Try demo entry opens a clearly labeled fictional board without signing in. A reviewer can use the map, compare listings, add a place and change a next step. Edits are local to their browser and resettable. Demo edits never touch private data or another reviewer's session. |

Optional after the core works: a status filter, and an equal-share rent estimate when group size and rent are known.

## Scope boundaries
V1 covers manual capture of listing links and facts, private board sharing, mapping, comparisons and follow-through. Deferred: public listing aggregation, scraping, automatic imports from URLs, dorms, roommate matching, chat, voting, rent negotiations, in-app applications, notifications and real-time updates.

## Validation
Hallway-test a rough board with 1–2 friends on day 7, using a few real links. Watch which facts they look for, which fields they leave blank, and where they would go back to the group chat. Revise the comparison rows and capture form once, then freeze V1.

Pilot targets:
- Add a place in under 30 seconds with its link and location at hand.
- Compare two places and explain a tradeoff without opening the source tabs.
- Identify the next action and who owns it from the board.

## Release definition
The public deployment opens in an incognito browser, and the demo works on phone and desktop. Two authenticated users can collaborate on a private test board, and an outsider is denied both reads and writes. The GitHub repository is public. The README links the deployment, describes the project and tradeoffs, and explains how to try it and run it. The repo contains no secret keys or real roommate data.

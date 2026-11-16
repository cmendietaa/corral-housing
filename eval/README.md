# Extraction benchmark: method

This folder measures how well Corral's autofill reads rental listings: the free rule-based parser, the AI model on pasted text, and the AI model on screenshots of the same listings. Results are in [REPORT.md](REPORT.md).

## What runs

The benchmark calls the **production code**, not a copy: `parseListingText` from `lib/parse-listing.ts` and `extractListing` from `lib/extract/model.ts`. That means the same prompt, output schema and per-field validation that the live site uses. A change to any of them changes the prompt version (`PROMPT_VERSION`, a hash of the instructions and schema) recorded in every report.

## Dataset

[`cases.ts`](cases.ts) holds 40 fictional listings written in the formats IV/Goleta listings really come in:
- Craigslist ads
- property manager pages
- Facebook-style group posts
- Instagram captions
- group chats
- forwarded emails

There's also a set of hard cases: per-person prices, deposits and fees larger than the rent, two units in one post, a "2 bed + loft", missing years, misspellings, slang ("52 hundred", "$8.4k"), a post with no listing in it, and three prompt-injection attempts.

15 of the listings are also rendered as phone screenshots (`npm run eval:screens`) in three generic app looks: a group post, a chat and a listing page. One is low-resolution and three are in dark mode. Because the text and screenshot versions are the same listing with the same correct answers, comparing them isolates the effect of reading an image.

All of it is fictional: 555 phone numbers, `.example` links, invented people. The browsable version with every expected answer is in [LABELS.md](LABELS.md).

### Correct answers

- `null` means the listing doesn't clearly say, so the right answer is to leave the field empty.
- `{ anyOf: [...] }` lists every acceptable answer when a listing is genuinely ambiguous ("starting at $5,800", "Sept 2027" with no day).
- Answers follow the product's rules, the same ones the prompt states. Rent is the whole unit's monthly rent, so a per-person price alone is `null`. Year-less dates roll forward. A start date plus a lease length gives the day before the anniversary.

### Label review

After the first AI run, every field where the AI and the expected answer disagreed was reviewed by hand (3 fields, all "W/D hookups" or "laundry hookups only"). All three labels were kept: hookups mean you bring your own machines, so the listing doesn't offer laundry. Labels where the AI and the expected answer agree weren't individually re-reviewed.

### Dev and test split

16 cases are held out as **test** and give the headline numbers. The other 24 (**dev**) are the only ones used when tuning the prompt or parser, so improvements aren't fitted to the cases they're scored on.

The split is stratified: about a third of each everyday format, every third hard case in file order, and one injection case. The split was revised once, before any AI run: the first version had almost no hard cases in test, which made the held-out parser score look better than it is.

## Scoring

Each of 9 fields (address, link, rent, beds, baths, lease start, lease end, parking, laundry) gets exactly one outcome:

| Outcome | Meaning |
|---|---|
| correct | an accepted value |
| correct (empty) | left empty, and empty is accepted |
| wrong | the listing states a value; the prediction is a different value |
| missed | the listing states a value; the prediction left it empty |
| **hallucinated** | the listing doesn't state it; the prediction made one up |

Hallucinated is separated from wrong because "never invent a value" is a product rule. An empty field is safe; a made-up one gets saved.

Addresses compare by house number and street name (suffix, unit, city and ZIP ignored). Links ignore case and a trailing slash. Everything else must match exactly. The title isn't scored, because it's a free-text nickname.

The scorer has its own unit tests ([`score.test.ts`](score.test.ts)), because a scoring bug would make every number wrong.

**Metrics:**
- field accuracy
- hallucination rate (hallucinated ÷ fields whose answer is empty)
- miss rate (missed ÷ fields that need a value)
- exact cases (every field right)
- injection held (no injected value appeared)
- calls with no usable output
- fields the app's validator dropped
- run-to-run consistency
- latency p50/p95
- cost per 1,000 calls, from the token counts the API reports

## Reproducing

```bash
npm run eval                          # re-score from the cache: no API calls, $0
EVAL_CALL=1 npm run eval              # show how many calls are missing and their estimated cost, then stop
EVAL_CALL=1 EVAL_YES=1 npm run eval   # make the missing calls (needs OPENAI_API_KEY in .env.local)
npm run eval:screens                  # re-render the screenshots after editing cases.ts
```

- **Caching:** every model answer is cached in `cache/`, keyed by model, prompt version, input, image detail and repeat number. A prompt change only re-runs what it affects, and re-scoring or editing the report costs nothing.
- **Repeats:** the model isn't deterministic (reasoning models take no temperature), so each case runs 3 times. The report shows the mean and min–max.
- **Free part in CI:** the parser half runs in CI as [`parser.test.ts`](parser.test.ts) and fails if the parser gets fewer fields right, or invents more, than [`parser-baseline.json`](parser-baseline.json).

## Limits

- The listings and screenshots are synthetic: cleaner and more uniform than real posts. Real-world accuracy, especially on screenshots, is likely lower than reported here.
- 40 cases (16 held out) is small. One field is 0.7% of the held-out total, so treat differences of a couple of points as noise.
- Latency is measured from a laptop with 4 calls in flight, not from the production server.
- Costs use the list price recorded in `run.eval.ts`, not an invoice.

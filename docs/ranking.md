# How the Rank tab scores places

The Rank tab orders a board's open places by how well they fit *your* priorities and says why. It's a transparent, deterministic ranking (`lib/rank.ts`): no AI, no learned weights. Same places, same priorities, same order, every time.

## 1. Requirements: pass, fail or unknown

Requirements are hard limits. They default from the board, and each person can change them on their own device:

| Requirement | Default | Fails when |
|---|---|---|
| Max rent per person | the board's budget | equal-share rent is over it |
| Minimum bedrooms | off (IV groups often share rooms) | fewer bedrooms |
| Move in by | off | the lease starts later |
| Needs laundry | off | the listing says no laundry |
| Needs off-street parking | off | street parking only, or none |

Each check has three outcomes. **Fail** moves the place to "Doesn't meet your requirements", with the reason in numbers ("$1,600/person is over your $1,400 max"). **Unknown** (rent not filled in, for example) moves it to "Might fit, but missing info". **Neither is ever ranked.** We can't claim a place fits when we can't check it. This is the same rule Compare uses: unknown rent is never within budget.

Passed and Unavailable places are left out.

## 2. Preferences: five factors, fixed reference points

Each factor becomes a 0–1 score against fixed reference points:

| Factor | Scores 1 at | Scores 0 at |
|---|---|---|
| Price per person | ≤ 60% of your max | your max |
| Bike time to campus | ≤ 5 min | ≥ 20 min |
| Bedrooms per person | ≥ 1 | 0 (0.5 per person scores 0.3) |
| Bathrooms per person | ≥ 0.5 | 0 (0.25 per person scores 0.3) |
| Parking & laundry | average of parking and laundry | |

Parking scores garage 1, driveway or lot 0.8, street 0.3, none 0. Laundry scores in unit 1, on site 0.6, none 0. Bike time is the app's usual estimate from the pin.

**Why fixed reference points instead of scaling between the board's cheapest and most expensive place:** with that scaling, adding an unrelated place changes every other place's score, and with two places a $10 gap becomes "best vs. worst". Fixed points mean a place's score depends only on the place and your priorities. A property test checks this on 300 random boards. The one exception: with no max rent at all, price is scored against the median of the board's open places, because there's no other scale to use.

## 3. Weights

Each factor is set to Don't care, A little, Important or Very, which count 0, 1, 2 and 4. "Very" counts double "Important", so one factor can clearly dominate. The weights are scaled to sum to 1, and the score is the weighted sum, shown **out of 10** with one decimal.

If every factor is Don't care, places rank by price alone.

## 4. Unknown values in preferences

If a weighted factor is unknown (no pin, laundry not filled in), dropping it would reward missing data and scoring it 0 would punish it. Instead the score becomes a range: the low end counts the unknown as 0 and the high end as 1. Places rank by the **middle** of the range, which shows as "~7.5" with an "unknown" tag.

*Alternative considered:* ranking by the low end. It's safer, but it buries places that might be the best fit only because nobody filled in a field yet.

**Ties** break on the low end, then lower rent per person, then board order.

## 5. Explanations

Every sentence is generated from the numbers and only states known values. A test checks that no explanation mentions an unknown factor as a fact.

- **The card's one line:** the strongest plus and the strongest minus, measured as weight × distance from a middling score ("+ $800/person, $600 under your max · − no laundry, street parking only").
- **"Why?":** each weighted factor's score with its real value, plus a comparison with the place ranked just above: "Ranks below 6545 Trigo mainly because it's $150/person more; it wins on bathrooms." The score gap is split into per-factor differences, comparing only factors known for both places.
- **Close call:** the ranking is re-run with each weight moved one step up and one step down. If #1 changes, the tab says which factor it hinges on.

## 6. How it's tested

`lib/rank.test.ts` has worked examples (requirement texts, reference points, ranges, explanation sentences, close call) and property tests over 300 seeded random boards each:
- lowering rent never lowers a score
- adding a place never changes another place's score
- a Don't care factor never changes the order
- a failed or unknown requirement is never ranked
- the low end ≤ score ≤ high end
- the same input gives the same output

## 7. What it doesn't do

- **It doesn't combine roommates' views.** Priorities are saved per person, on their device, so roommates never overwrite each other. A group ranking that combines everyone's priorities is a voting problem, left for later.
- **It doesn't learn.** The weights are what you set. For a board of tens of places, a ranking you can read and argue with is more useful than a model.

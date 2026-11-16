import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseListingText } from "@/lib/parse-listing";
import { CASES } from "./cases";
import { scoreCase, summarize } from "./score";

/**
 * Regression guard for the free rule-based parser, run in CI: on the benchmark
 * dataset it must get at least as many fields right, and invent no more, than
 * the committed baseline. After an intentional improvement, refresh the
 * baseline with EVAL_UPDATE_BASELINE=1 npm run eval.
 */
const baseline = JSON.parse(readFileSync(new URL("./parser-baseline.json", import.meta.url), "utf8")) as {
  correct: number;
  hallucinated: number;
  fields: number;
};

describe("rule-based parser on the benchmark dataset", () => {
  const s = summarize(
    CASES,
    CASES.map((c) => scoreCase(c, parseListingText(c.text, new Date(`${c.today}T12:00:00Z`))))
  );

  it("gets at least as many fields right as the baseline", () => {
    expect(s.fields).toBe(baseline.fields);
    expect(s.counts.correct + s.counts.correct_null).toBeGreaterThanOrEqual(baseline.correct);
  });

  it("invents no more values than the baseline", () => {
    expect(s.counts.hallucinated).toBeLessThanOrEqual(baseline.hallucinated);
  });
});

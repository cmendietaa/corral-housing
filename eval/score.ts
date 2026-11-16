import type { ParsedListing } from "@/lib/parse-listing";
import { FIELDS, type Case, type Field, type GoldValue } from "./cases";

/**
 * Scoring for the extraction benchmark. Every scored field of every case gets
 * exactly one outcome:
 *
 *   correct       the prediction is an accepted answer (a value)
 *   correct_null  the field was left empty and empty is an accepted answer
 *   wrong         gold has a value, the prediction has a different value
 *   missed        gold needs a value, the prediction left it empty
 *   hallucinated  gold is null (the listing doesn't say), the prediction made one up
 *
 * "Hallucinated" is kept apart from "wrong" because "never invent a value" is
 * a product rule: an empty field is safe, a made-up one gets saved.
 * The title is not scored; it's a free-text nickname with no single right answer.
 */

export type Outcome = "correct" | "correct_null" | "wrong" | "missed" | "hallucinated";
type Value = string | number | null;

const CITY_WORDS = /\b(isla vista|goleta|santa barbara|iv|ca|california|\d{5})\b/g;
const UNIT = /(\b(apt|apartment|unit|ste|suite)\b\.?\s*[\w-]+)|(#\s*[\w-]+)/g;
const SUFFIX = /\b(rd|road|st|street|dr|drive|ave|avenue|ln|lane|way|pl|place|ct|court|blvd|boulevard)\b/g;

/**
 * House number + street name only, so "6640 Sueno Road, Isla Vista, CA 93117"
 * and "6640 Sueno Rd" match. Unit numbers, city, state, ZIP and the street
 * suffix are ignored (the board pins by street address).
 */
export function normalizeAddress(address: string): string {
  const firstPart = address.toLowerCase().split(",")[0] ?? "";
  return firstPart
    .replace(UNIT, " ")
    .replace(CITY_WORDS, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

export function sameValue(field: Field, predicted: Value, expected: Value): boolean {
  if (predicted === null || expected === null) return predicted === expected;
  if (field === "address") return normalizeAddress(String(predicted)) === normalizeAddress(String(expected));
  if (field === "url") return normalizeUrl(String(predicted)) === normalizeUrl(String(expected));
  return predicted === expected;
}

function accepted(gold: GoldValue): Value[] {
  return gold !== null && typeof gold === "object" ? gold.anyOf : [gold];
}

export function classify(field: Field, predicted: Value, gold: GoldValue): Outcome {
  const ok = accepted(gold);
  if (ok.some((g) => sameValue(field, predicted, g))) return predicted === null ? "correct_null" : "correct";
  if (predicted === null) return "missed";
  return gold === null ? "hallucinated" : "wrong";
}

export type CaseScore = {
  id: string;
  outcomes: Record<Field, Outcome>;
  predicted: Record<Field, Value>;
  /** Every scored field right. */
  exact: boolean;
  /** For injection cases: true when no forced value appeared. */
  injectionHeld: boolean | null;
  /** The extractor returned nothing (error, refusal, invalid output). */
  failed: boolean;
};

export function scoreCase(c: Case, fields: ParsedListing | null): CaseScore {
  const predicted = {} as Record<Field, Value>;
  const outcomes = {} as Record<Field, Outcome>;
  for (const f of FIELDS) {
    predicted[f] = fields ? fields[f] : null;
    outcomes[f] = classify(f, predicted[f], c.gold[f]);
  }
  const injectionHeld = c.mustNot
    ? !(Object.entries(c.mustNot) as [Field, Value][]).some(([f, v]) => sameValue(f, predicted[f], v))
    : null;
  return {
    id: c.id,
    outcomes,
    predicted,
    exact: FIELDS.every((f) => outcomes[f] === "correct" || outcomes[f] === "correct_null"),
    injectionHeld,
    failed: fields === null
  };
}

export type Summary = {
  cases: number;
  fields: number;
  counts: Record<Outcome, number>;
  /** (correct + correct_null) / all scored fields. */
  accuracy: number;
  /** hallucinated / fields whose gold is strictly null. */
  hallucinationRate: number;
  hallucinationBase: number;
  /** missed / fields whose gold needs a value. */
  missRate: number;
  missBase: number;
  exactCases: number;
  injection: { held: number; total: number };
  failures: number;
  perField: Record<Field, { correct: number; total: number }>;
};

export function summarize(cases: Case[], scores: CaseScore[]): Summary {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const counts: Record<Outcome, number> = { correct: 0, correct_null: 0, wrong: 0, missed: 0, hallucinated: 0 };
  const perField = Object.fromEntries(FIELDS.map((f) => [f, { correct: 0, total: 0 }])) as Summary["perField"];
  let hallucinationBase = 0;
  let missBase = 0;
  for (const s of scores) {
    const c = byId.get(s.id)!;
    for (const f of FIELDS) {
      const o = s.outcomes[f];
      counts[o]++;
      perField[f].total++;
      if (o === "correct" || o === "correct_null") perField[f].correct++;
      if (c.gold[f] === null) hallucinationBase++;
      if (!accepted(c.gold[f]).includes(null)) missBase++;
    }
  }
  const fields = scores.length * FIELDS.length;
  const injected = scores.filter((s) => s.injectionHeld !== null);
  return {
    cases: scores.length,
    fields,
    counts,
    accuracy: fields ? (counts.correct + counts.correct_null) / fields : 0,
    hallucinationRate: hallucinationBase ? counts.hallucinated / hallucinationBase : 0,
    hallucinationBase,
    missRate: missBase ? counts.missed / missBase : 0,
    missBase,
    exactCases: scores.filter((s) => s.exact).length,
    injection: { held: injected.filter((s) => s.injectionHeld).length, total: injected.length },
    failures: scores.filter((s) => s.failed).length,
    perField
  };
}

/** Share of (case, field) pairs where every repeat gave the same answer. */
export function consistency(runs: CaseScore[][]): number {
  if (runs.length < 2) return 1;
  let same = 0;
  let total = 0;
  for (const first of runs[0]!) {
    const others = runs.slice(1).map((r) => r.find((s) => s.id === first.id));
    for (const f of FIELDS) {
      total++;
      if (others.every((o) => o && o.predicted[f] === first.predicted[f])) same++;
    }
  }
  return total ? same / total : 1;
}

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

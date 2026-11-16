import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import OpenAI from "openai";
import { test } from "vitest";
import { DEFAULT_MODEL, extractListing, type ExtractInput, type ImageDetail } from "@/lib/extract/model";
import { PROMPT_VERSION } from "@/lib/extract/prompt";
import { parseListingText, type ParsedListing } from "@/lib/parse-listing";
import { CASES, type Case } from "./cases";
import { buildLabels, buildReport, type ModeResult } from "./report";
import { scoreCase, summarize, type CaseScore } from "./score";

/**
 * The extraction benchmark runner.
 *
 *   npm run eval                          re-score from the cache; never calls the API, costs $0
 *   EVAL_CALL=1 npm run eval              shows how many calls are missing and what they'd cost, then stops
 *   EVAL_CALL=1 EVAL_YES=1 npm run eval   makes the missing calls (needs OPENAI_API_KEY in .env.local)
 *
 * Optional: EVAL_REPEATS (default 3), EVAL_DETAIL (high | low | auto), OPENAI_MODEL.
 * Every model answer is cached in eval/cache/ under a key built from the model,
 * the prompt version, the input and the repeat number, so a prompt change
 * invalidates exactly the answers it affects and re-scoring is free.
 */

const dir = new URL("./", import.meta.url);
const path = (p: string) => new URL(p, dir);
try {
  process.loadEnvFile(new URL("../.env.local", dir));
} catch {
  // No .env.local: fine for cache-only runs.
}

const CALL = process.env.EVAL_CALL === "1";
const YES = process.env.EVAL_YES === "1";
const REPEATS = Number(process.env.EVAL_REPEATS ?? 3);
const DETAIL = (process.env.EVAL_DETAIL ?? "high") as ImageDetail;
const MODEL = process.env.OPENAI_MODEL || DEFAULT_MODEL;
const CONCURRENCY = 4;

// List price per million tokens. Check https://openai.com/api/pricing before quoting costs.
const PRICING: Record<string, { input: number; output: number; asOf: string }> = {
  "gpt-5-mini": { input: 0.25, output: 2.0, asOf: "OpenAI list price for gpt-5-mini, Aug 2025" },
  "gpt-5-nano": { input: 0.05, output: 0.4, asOf: "OpenAI list price for gpt-5-nano, Aug 2025" }
};
// Rough per-call estimates for the cost gate before anything is spent.
const ESTIMATE = { text: 0.002, screen: 0.004 };

type Mode = "text" | "screen";
type Record_ = {
  fields: ParsedListing | null;
  dropped: string[];
  usage: { inputTokens: number; outputTokens: number } | null;
  latencyMs: number;
  status: string | null;
};
type Job = { mode: Mode; c: Case; repeat: number; key: string; file: URL };

const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const nowFor = (c: Case) => new Date(`${c.today}T12:00:00Z`);
const screenFile = (c: Case) => path(`screens/${c.id}.jpg`);

function inputFor(mode: Mode, c: Case): ExtractInput {
  if (mode === "text") return { text: c.text };
  return { images: [{ type: "image/jpeg", base64: readFileSync(screenFile(c)).toString("base64") }] };
}

function jobsFor(mode: Mode): Job[] {
  const cases = mode === "text" ? CASES : CASES.filter((c) => c.screenshot);
  return cases.flatMap((c) =>
    Array.from({ length: REPEATS }, (_, repeat) => {
      const input = mode === "text" ? sha(c.text) : sha(readFileSync(screenFile(c)));
      const key = sha(JSON.stringify({ mode, model: MODEL, prompt: PROMPT_VERSION, detail: mode === "screen" ? DETAIL : null, input, today: c.today, repeat })).slice(0, 16);
      return { mode, c, repeat, key, file: path(`cache/${mode}-${c.id}-r${repeat}-${key}.json`) };
    })
  );
}

async function runJobs(jobs: Job[]) {
  const client = new OpenAI({ timeout: 90_000, maxRetries: 3 });
  let next = 0;
  let done = 0;
  const errors: string[] = [];
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++]!;
      try {
        const r = await extractListing(client, inputFor(job.mode, job.c), { model: MODEL, now: nowFor(job.c), imageDetail: DETAIL });
        const record: Record_ = { fields: r.fields, dropped: r.dropped, usage: r.usage, latencyMs: r.latencyMs, status: r.status };
        writeFileSync(job.file, JSON.stringify(record, null, 2) + "\n");
      } catch (error) {
        // Not cached, so the next run retries it.
        errors.push(`${job.mode} ${job.c.id} r${job.repeat}: ${error instanceof Error ? error.message : String(error)}`);
      }
      done++;
      if (done % 10 === 0 || done === jobs.length) console.log(`  ${done}/${jobs.length} calls`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (errors.length) console.warn(`${errors.length} calls failed and weren't cached:\n  ${errors.join("\n  ")}`);
}

function collect(label: string, mode: Mode, jobs: Job[]): ModeResult {
  const price = PRICING[MODEL];
  const runs: CaseScore[][] = Array.from({ length: REPEATS }, () => []);
  const result: ModeResult = { label, runs, latencies: [], costs: [], tokens: [], dropped: 0, missing: 0 };
  let any = false;
  for (const job of jobs) {
    if (!existsSync(job.file)) {
      result.missing++;
      runs[job.repeat]!.push(scoreCase(job.c, null));
      continue;
    }
    any = true;
    const r = JSON.parse(readFileSync(job.file, "utf8")) as Record_;
    runs[job.repeat]!.push(scoreCase(job.c, r.fields));
    result.latencies.push(r.latencyMs);
    result.dropped += r.dropped.length;
    if (r.usage) {
      result.tokens.push({ input: r.usage.inputTokens, output: r.usage.outputTokens });
      if (price) result.costs.push((r.usage.inputTokens * price.input + r.usage.outputTokens * price.output) / 1e6);
    }
  }
  if (!any) return { ...result, runs: [], missing: result.missing };
  return result;
}

test("extraction benchmark", async () => {
  mkdirSync(path("cache/"), { recursive: true });

  for (const c of CASES) {
    if (c.screenshot && !existsSync(screenFile(c))) throw new Error(`Missing eval/screens/${c.id}.jpg. Run: npm run eval:screens`);
  }

  // The parser is free and deterministic: run it fresh every time.
  const parserScores = CASES.map((c) => scoreCase(c, parseListingText(c.text, nowFor(c))));
  const parser: ModeResult = { label: "parser", runs: [parserScores], latencies: [], costs: [], tokens: [], dropped: 0, missing: 0 };

  const textJobs = jobsFor("text");
  const screenJobs = jobsFor("screen");
  const missing = [...textJobs, ...screenJobs].filter((j) => !existsSync(j.file));

  if (missing.length && CALL) {
    const nText = missing.filter((j) => j.mode === "text").length;
    const nScreen = missing.length - nText;
    const estimate = nText * ESTIMATE.text + nScreen * ESTIMATE.screen;
    console.log(`${missing.length} calls not cached (${nText} text, ${nScreen} screenshot) with ${MODEL}, prompt ${PROMPT_VERSION}: about $${estimate.toFixed(2)}.`);
    if (!YES) throw new Error("Nothing was called. To spend that, re-run with EVAL_CALL=1 EVAL_YES=1.");
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY isn't set (add it to .env.local).");
    await runJobs(missing);
  } else if (missing.length) {
    console.log(`${missing.length} AI calls aren't cached; scoring what is. Use EVAL_CALL=1 to see the cost of filling them in.`);
  }

  const text = collect("AI text", "text", textJobs);
  const screen = collect("AI screenshot", "screen", screenJobs);

  const datasetHash = sha(JSON.stringify(CASES)).slice(0, 12);
  const meta = {
    date: new Date().toISOString().slice(0, 10),
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    datasetHash,
    imageDetail: DETAIL,
    repeats: REPEATS,
    pricing: PRICING[MODEL] ?? { input: 0, output: 0, asOf: "no price on file for this model" }
  };
  writeFileSync(path("REPORT.md"), buildReport(meta, parser, text, screen));
  writeFileSync(path("LABELS.md"), buildLabels());

  // The parser's committed baseline: CI fails if a change makes it worse (eval/parser.test.ts).
  const s = summarize(CASES, parserScores);
  const baseline = { datasetHash, correct: s.counts.correct + s.counts.correct_null, hallucinated: s.counts.hallucinated, fields: s.fields };
  const baselineFile = path("parser-baseline.json");
  if (!existsSync(baselineFile) || process.env.EVAL_UPDATE_BASELINE === "1") {
    writeFileSync(baselineFile, JSON.stringify(baseline, null, 2) + "\n");
  }
  console.log(`Parser: ${baseline.correct}/${baseline.fields} fields right, ${baseline.hallucinated} hallucinated. Report: eval/REPORT.md`);
});

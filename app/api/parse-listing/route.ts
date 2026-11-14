import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { aiConfigured, extractWithAI } from "@/lib/ai-extract";
import { MAX_SCREENSHOTS, MAX_SCREENSHOT_BYTES, sniffImageType } from "@/lib/extract/image";
import type { Screenshot } from "@/lib/extract/model";
import { MAX_PASTE_CHARS, parseListingText } from "@/lib/parse-listing";

/**
 * POST /api/parse-listing  ->  { fields, source: "ai" | "parser", note? }
 *
 *   JSON       { text }                          pasted listing text (as before)
 *   multipart  text? + image (1–3 screenshots)   screenshots, optionally with text
 *
 * Fills the add-place form. An OpenAI model when OPENAI_API_KEY is set
 * (rate-limited per IP), otherwise or on any failure the deterministic parser
 * reads the text. Screenshots need the model; with no model and no text, the
 * answer is a 503 that says to paste the text instead. Screenshots are read in
 * memory and never stored. The person always reviews the fields before saving.
 */

const MIN_TEXT = 10;

// Best-effort per-IP limit on AI calls (serverless instances don't share memory).
// Over the limit, text still gets the free parser. A request with screenshots
// costs 2 slots: it uses several times the tokens of a text paste. The real
// cost ceiling is the OpenAI project's budget limit.
const WINDOW_MS = 60 * 60 * 1000;
const AI_PER_WINDOW = 10;
const hits = new Map<string, { count: number; resetAt: number }>();

function takeAiSlots(ip: string, cost: number): boolean {
  const now = Date.now();
  // Forget expired entries now and then so the map can't grow without bound.
  if (hits.size > 1000) for (const [key, value] of hits) if (value.resetAt < now) hits.delete(key);
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    if (cost > AI_PER_WINDOW) return false;
    hits.set(ip, { count: cost, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count + cost > AI_PER_WINDOW) return false;
  entry.count += cost;
  return true;
}

type Parsed = { text: string; images: Screenshot[] };
type Failure = { error: string; status: number };

const fail = (error: string, status: number): Failure => ({ error, status });

async function readJson(request: NextRequest): Promise<Parsed | Failure> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Send the listing text as JSON.", 400);
  }
  const parsed = z.object({ text: z.string() }).safeParse(json);
  if (!parsed.success) return fail("Paste the listing text.", 400);
  return { text: parsed.data.text.trim(), images: [] };
}

async function readMultipart(request: NextRequest): Promise<Parsed | Failure> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Couldn't read the upload. Try again.", 400);
  }
  const rawText = form.get("text");
  const text = typeof rawText === "string" ? rawText.trim() : "";
  const files = form.getAll("image").filter((v): v is File => typeof v !== "string");
  if (files.length > MAX_SCREENSHOTS) return fail(`Add up to ${MAX_SCREENSHOTS} screenshots at a time.`, 400);

  const images: Screenshot[] = [];
  for (const file of files) {
    if (file.size > MAX_SCREENSHOT_BYTES) return fail("That screenshot is too large. Try a smaller one.", 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Check what the file really is, not what the browser says it is.
    const type = sniffImageType(bytes);
    if (!type) return fail("Screenshots need to be PNG, JPEG or WebP images.", 415);
    images.push({ type, base64: Buffer.from(bytes).toString("base64") });
  }
  return { text, images };
}

export async function POST(request: NextRequest) {
  const multipart = request.headers.get("content-type")?.startsWith("multipart/form-data");
  const input = multipart ? await readMultipart(request) : await readJson(request);
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: input.status });

  const { text, images } = input;
  if (text.length > MAX_PASTE_CHARS) {
    return NextResponse.json(
      { error: `That's a lot of text. Paste just the listing (up to ${MAX_PASTE_CHARS.toLocaleString()} characters).` },
      { status: 413 }
    );
  }
  const hasText = text.length >= MIN_TEXT;
  if (!hasText && images.length === 0) {
    return NextResponse.json({ error: "Paste a bit more of the listing, or add a screenshot." }, { status: 400 });
  }

  let unavailable: "down" | "limit" | null = null;
  if (aiConfigured()) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (takeAiSlots(ip, images.length ? 2 : 1)) {
      const fields = await extractWithAI({ text: hasText ? text : undefined, images });
      if (fields) return NextResponse.json({ fields, source: "ai" });
      unavailable = "down";
    } else {
      unavailable = "limit";
    }
  } else {
    unavailable = "down";
  }

  // Screenshots can't be read without the model; say so instead of returning nothing.
  if (!hasText) {
    const error =
      unavailable === "limit"
        ? "You've used AI autofill a lot this hour, so screenshots can't be read right now. Paste the listing's text instead."
        : "Screenshot reading isn't available right now. Paste the listing's text instead.";
    return NextResponse.json({ error }, { status: 503 });
  }

  const note = !aiConfigured()
    ? undefined
    : unavailable === "limit"
      ? "You've used AI autofill a lot this hour, so the basic reader filled what it could from the text."
      : "AI autofill was unavailable, so the basic reader filled what it could from the text.";
  return NextResponse.json({ fields: parseListingText(text), source: "parser", ...(note ? { note } : {}) });
}

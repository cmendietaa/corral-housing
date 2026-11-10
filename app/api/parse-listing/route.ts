import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extractWithClaude } from "@/lib/ai-extract";
import { MAX_PASTE_CHARS, parseListingText } from "@/lib/parse-listing";

/**
 * POST /api/parse-listing  { text }  ->  { fields, source: "ai" | "parser", note? }
 *
 * Fills the add-place form from pasted listing text. Claude Haiku when
 * ANTHROPIC_API_KEY is set (rate-limited per IP), otherwise or on any failure
 * the deterministic parser. The person always reviews the fields before saving.
 */

const bodySchema = z.object({ text: z.string().trim().min(10, "Paste a bit more of the listing.") });

// Best-effort per-IP limit on AI calls (serverless instances don't share memory).
// Over the limit, requests still get the free parser.
const WINDOW_MS = 60 * 60 * 1000;
const AI_PER_WINDOW = 10;
const hits = new Map<string, { count: number; resetAt: number }>();

function takeAiSlot(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= AI_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Send the listing text as JSON." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Paste the listing text." }, { status: 400 });
  }
  if (parsed.data.text.length > MAX_PASTE_CHARS) {
    return NextResponse.json(
      { error: `That's a lot of text. Paste just the listing (up to ${MAX_PASTE_CHARS.toLocaleString()} characters).` },
      { status: 413 }
    );
  }
  const text = parsed.data.text;

  let note: string | undefined;
  if (process.env.ANTHROPIC_API_KEY) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (takeAiSlot(ip)) {
      const fields = await extractWithClaude(text);
      if (fields) return NextResponse.json({ fields, source: "ai" });
      note = "AI autofill was unavailable, so the basic reader filled what it could.";
    } else {
      note = "You've used AI autofill a lot this hour, so the basic reader filled what it could.";
    }
  }

  return NextResponse.json({ fields: parseListingText(text), source: "parser", ...(note ? { note } : {}) });
}

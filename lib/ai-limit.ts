/**
 * Best-effort per-IP limit on AI calls, shared by autofill (pasted text and
 * screenshots) and link import. Serverless instances don't share memory, so
 * this slows abuse rather than stopping it; the real cost ceiling is the
 * OpenAI project's budget limit. Over the limit, text still gets the free parser.
 */
const WINDOW_MS = 60 * 60 * 1000;
const AI_PER_WINDOW = 10;
const hits = new Map<string, { count: number; resetAt: number }>();

export function takeAiSlots(ip: string, cost: number): boolean {
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

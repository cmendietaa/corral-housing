/**
 * Where to send someone after sign-in. Only same-site paths are allowed, so a
 * crafted link like /auth/callback?next=https://evil.example can't bounce a
 * freshly signed-in user to another site.
 */
export function safeNext(next: string | null | undefined, fallback = "/boards"): string {
  if (!next) return fallback;
  // Must be a single-slash absolute path: no scheme, no protocol-relative //host, no backslashes.
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  try {
    const url = new URL(next, "https://corral.invalid");
    if (url.origin !== "https://corral.invalid") return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}

/**
 * A nonce pair for Google ID-token sign-in. Google gets the SHA-256 hash (hex)
 * and embeds it in the token; Supabase gets the raw value and checks the hash,
 * so a token captured elsewhere can't be replayed here.
 */
export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

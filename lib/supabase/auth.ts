import "server-only";
import { createClient } from "./server";

export type SessionUser = { id: string; email: string | null; name: string };

/**
 * The signed-in user, verified server-side with getClaims() (never getSession()).
 * The name is only used as a display default; it's never used for access decisions.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const email = typeof claims.email === "string" ? claims.email : null;
  const full = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim().length > 0);
  const name = (full?.trim().split(/\s+/)[0] ?? email?.split("@")[0] ?? "Roommate").slice(0, 40);
  return { id: claims.sub, email, name };
}

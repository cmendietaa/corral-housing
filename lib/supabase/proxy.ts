import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Refreshes the Supabase session on every request (Next.js 16 proxy).
 * Server Components can't write cookies, so this is where refreshed tokens are
 * passed both to the rest of the request and back to the browser.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseUrl || !supabasePublishableKey) return response;

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      }
    }
  });

  // Validates the token (refreshing it when needed). Don't put code between
  // creating the client and this call.
  await supabase.auth.getClaims();

  return response;
}

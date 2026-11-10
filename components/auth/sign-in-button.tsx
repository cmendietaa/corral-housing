"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Button, type ButtonProps } from "@/components/ui/button";
import { makeNonce } from "@/lib/nonce";
import { createClient } from "@/lib/supabase/client";

/**
 * Google sign-in.
 *
 * With NEXT_PUBLIC_GOOGLE_CLIENT_ID set, this shows Google's own button (Google
 * Identity Services) on Corral's page and trades the ID token with Supabase via
 * signInWithIdToken. Google's consent screen then names corral-housing.vercel.app
 * instead of the Supabase project address.
 *
 * Without it, it falls back to Supabase's redirect flow (signInWithOAuth).
 * `next` is where to land afterwards; the redirect flow checks it again on the server.
 */
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function SignInButton({ next = "/boards", ...props }: { next?: string } & Omit<ButtonProps, "onClick" | "children">) {
  return GOOGLE_CLIENT_ID ? <GoogleButton clientId={GOOGLE_CLIENT_ID} next={next} /> : <RedirectButton next={next} {...props} />;
}

/** Only same-site paths, mirroring the server-side safeNext check. */
function sameSite(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/boards";
}

type GoogleId = {
  initialize: (config: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

function GoogleButton({ clientId, next }: { clientId: string; next: string }) {
  const slot = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped after a failed attempt so setup runs again with a fresh nonce.
  const [attempt, setAttempt] = useState(0);

  const setUp = useCallback(async () => {
    const google = window.google?.accounts.id;
    const supabase = createClient();
    if (!google || !slot.current || !supabase) return;
    const nonce = await makeNonce();

    google.initialize({
      client_id: clientId,
      nonce: nonce.hashed,
      use_fedcm_for_prompt: true,
      callback: async (response: { credential: string }) => {
        setBusy(true);
        setError(null);
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.credential,
          nonce: nonce.raw
        });
        if (error) {
          setBusy(false);
          setError("Couldn't finish signing in. Try again.");
          setAttempt((a) => a + 1);
          return;
        }
        // The session is now in cookies, so the server sees it on the next page.
        window.location.assign(sameSite(next));
      }
    });
    google.renderButton(slot.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "signin_with",
      logo_alignment: "left"
    });
  }, [clientId, next]);

  // Covers both a fresh script load and a script already loaded by an earlier page.
  useEffect(() => {
    if (scriptReady || window.google?.accounts?.id) void setUp();
  }, [scriptReady, setUp, attempt]);

  return (
    <span className="inline-flex flex-col items-center gap-2">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setScriptReady(true)} />
      <div ref={slot} className="min-h-[44px]" aria-busy={busy} />
      {busy ? <span className="text-sm text-stone-700">Signing you in…</span> : null}
      {error ? (
        <span role="alert" className="text-sm font-semibold text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function RedirectButton({ next, ...props }: { next: string } & Omit<ButtonProps, "onClick" | "children">) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    const supabase = createClient();
    if (!supabase) {
      setError("Sign-in isn't set up on this deployment.");
      return;
    }
    setBusy(true);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) {
      setBusy(false);
      setError("Couldn't start Google sign-in. Try again.");
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <Button {...props} onClick={() => void signIn()} disabled={busy || props.disabled}>
        {busy ? "Opening Google…" : "Sign in with Google"}
      </Button>
      {error ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}

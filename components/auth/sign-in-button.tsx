"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/** Starts Google sign-in. `next` is where to land afterwards (checked again on the server). */
export function SignInButton({
  next = "/boards",
  children = "Sign in with Google",
  ...props
}: { next?: string } & Omit<ButtonProps, "onClick">) {
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
        {busy ? "Opening Google…" : children}
      </Button>
      {error ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}

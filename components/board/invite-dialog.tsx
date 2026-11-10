"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Makes an invite link and shows it with a Copy button. Links work for 7 days. */
export function InviteDialog({ makeLink, onClose }: { makeLink: () => Promise<string>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // One invite per opening, even when React runs effects twice in development.
  const requested = useRef<Promise<string> | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    requested.current ??= makeLink();
    let cancelled = false;
    requested.current
      .then((l) => !cancelled && setLink(l))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't make an invite link."));
    return () => {
      cancelled = true;
    };
  }, [makeLink]);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Select the link and copy it yourself.");
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="invite-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[30px] bg-shell p-0 text-tar shadow-lg"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="invite-title" className="font-display text-2xl">
            Invite your roommates
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-10 w-10 items-center justify-center rounded-full hover:bg-shell-mid"
          >
            <X className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm text-stone-700">
          Anyone who signs in with this link joins the board. It works for 7 days. Send it in your group chat.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            readOnly
            aria-label="Invite link"
            value={link ?? "Making a link…"}
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 min-w-0 flex-1 rounded-full border border-divider bg-shell-light px-4 text-sm text-tar"
          />
          <Button type="button" onClick={() => void copy()} disabled={!link}>
            {copied ? <Check className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" /> : <Copy className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </dialog>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { LassoIcon } from "@/components/brand/motifs";
import { bookmarklet, shortcutScript } from "@/lib/send/payload";
import { cn } from "@/lib/utils";

/**
 * Board settings → Send to Corral: drag the button to the bookmarks bar on a
 * computer, or build the Shortcut once on iPhone. It adds to pasting a link;
 * it doesn't replace it.
 */
export function SendSetup() {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [origin, setOrigin] = useState("");
  const [nudge, setNudge] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // React refuses javascript: links in markup, so the bookmark's address is set once it's on the page.
  useEffect(() => {
    const o = window.location.origin;
    linkRef.current?.setAttribute("href", bookmarklet(o));
    const t = window.setTimeout(() => setOrigin(o), 0);
    return () => window.clearTimeout(t);
  }, []);

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(shortcutScript(origin));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <a
          ref={linkRef}
          href="#send-to-corral"
          draggable
          onClick={(e) => {
            e.preventDefault();
            setNudge(true);
          }}
          className="inline-flex h-12 cursor-grab items-center gap-2 rounded-full bg-sea-800 pl-3.5 pr-5 font-display text-[16px] text-shell shadow-[0_6px_16px_rgb(11_65_99/0.25)] active:cursor-grabbing"
        >
          <LassoIcon className="h-5 w-5 text-sunset-300" />
          Send to Corral
        </a>
        <span className={cn("text-sm", nudge ? "font-semibold text-sunset-800" : "text-stone-800")}>
          {nudge ? "Drag it up to your bookmarks bar instead." : "Drag this to your bookmarks bar."}
        </span>
      </div>

      <div className="rounded-[18px] bg-shell-light">
        <button
          type="button"
          aria-expanded={phoneOpen}
          onClick={() => setPhoneOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 rounded-[18px] px-4 py-3 text-left font-display text-[16px] hover:bg-shell-mid"
        >
          On iPhone
          <span className="text-sm font-semibold text-sea-700">{phoneOpen ? "Hide" : "Set up"}</span>
        </button>
        {phoneOpen ? (
          <ol className="space-y-3 px-4 pb-4 text-sm text-tar">
            <Step n={1}>In the Shortcuts app, make a new shortcut called Send to Corral, and turn on Show in Share Sheet.</Step>
            <Step n={2}>
              Add <b>Run JavaScript on Web Page</b> and paste this in:
              <button
                type="button"
                onClick={() => void copyScript()}
                disabled={!origin}
                className="mt-2 flex h-10 items-center gap-2 rounded-full border border-divider bg-shell px-4 font-semibold hover:bg-shell-mid"
              >
                {copied ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : <Copy className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}
                {copied ? "Copied" : "Copy the script"}
              </button>
            </Step>
            <Step n={3}>
              Add <b>Open URLs</b> after it.
            </Step>
            <Step n={4}>
              Turn on <b>Settings → Apps → Shortcuts → Advanced → Allow Running Scripts</b>.
            </Step>
            <Step n={5}>On a listing in Safari: Share → Send to Corral. Allow it for the site the first time.</Step>
          </ol>
        ) : null}
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-t-full rounded-b-md bg-sunset-300 font-display text-[13px] text-tar">
        {n}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

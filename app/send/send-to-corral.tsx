"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Band, CrewPill } from "@/components/brand/band";
import { FenceRow, LassoIcon } from "@/components/brand/motifs";
import { Wordmark } from "@/components/brand/wave-mark";
import { decodeFragment, INCOMING_KEY, readMessage, type Incoming, type SentPage } from "@/lib/send/payload";
import { cn } from "@/lib/utils";

type BoardChoice = { id: string; name: string; leaseYear: string; members: string[] };

const PENDING_KEY = "corral:send-pending";
const LAST_BOARD_KEY = "corral:send-board";

function store(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Storage blocked: the hand-off just won't survive a sign-in redirect.
  }
}

/** The listing arrives (from the bookmark, the Shortcut, or a sign-in round trip), then you pick a board. */
export function SendToCorral({ signedIn, boards }: { signedIn: boolean; boards: BoardChoice[] }) {
  const router = useRouter();
  const [page, setPage] = useState<SentPage | null>(null);
  const [waiting, setWaiting] = useState(true);
  // Only used once the listing has arrived (after hydration), so reading storage here is safe.
  const [last] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : window.localStorage.getItem(LAST_BOARD_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let done = false;
    const got = (p: SentPage) => {
      done = true;
      setPage(p);
      setWaiting(false);
    };
    // iPhone Shortcut: the page rides in the part after #, which never reaches a server. Clear it right away.
    const fromHash = decodeFragment(window.location.hash);
    if (fromHash) {
      window.history.replaceState(null, "", window.location.pathname);
      got(fromHash);
      return;
    }
    // Back from signing in.
    try {
      const pending = window.sessionStorage.getItem(PENDING_KEY);
      const parsed = pending ? readMessage({ type: "corral:page", page: JSON.parse(pending) }) : null;
      if (parsed) {
        got(parsed);
        return;
      }
    } catch {
      // Nothing pending.
    }
    // Desktop bookmark: the listing's tab is our opener; say we're ready and it sends the page.
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.opener) return;
      const p = readMessage(e.data);
      if (p) got(p);
    };
    window.addEventListener("message", onMessage);
    if (window.opener) window.opener.postMessage("corral:ready", "*");
    const t = window.setTimeout(() => !done && setWaiting(false), 2500);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(t);
    };
  }, []);

  function goTo(boardId: string, href: string) {
    if (!page) return;
    const incoming: Incoming = { boardId, page };
    store(INCOMING_KEY, JSON.stringify(incoming));
    store(PENDING_KEY, null);
    try {
      window.localStorage.setItem(LAST_BOARD_KEY, boardId);
    } catch {
      // Not remembered; it still works.
    }
    router.push(href);
  }

  const site = page ? new URL(page.url).hostname.replace(/^www\./, "") : null;
  const ordered = last ? [...boards].sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : 0)) : boards;

  return (
    <div className="flex min-h-screen flex-col bg-shell">
      <Band variant="compact">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 sm:px-6">
          <Wordmark />
        </div>
      </Band>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        {page ? (
          <>
            <div className="relative pt-7">
              <FenceRow className="absolute left-6 top-0" />
              <section className="rounded-[30px] bg-shell-deep p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sunset-300 text-sunset-700">
                    <LassoIcon className="h-6 w-6" />
                  </span>
                  <h1 className="min-w-0 font-display text-[24px] leading-tight">Round it up from {site}</h1>
                </div>
                <p className="mt-3 truncate rounded-[16px] bg-shell-light px-4 py-3 text-[15px]">{page.title || page.url}</p>
              </section>
            </div>

            <h2 className="mb-3 mt-8 font-display text-[20px]">Into which corral?</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {ordered.map((b) => (
                <li key={b.id}>
                  <BoardButton
                    name={b.name}
                    detail={b.leaseYear ? `Lease ${b.leaseYear}` : null}
                    members={b.members}
                    lastUsed={b.id === last}
                    onClick={() => goTo(b.id, `/boards/${b.id}`)}
                  />
                </li>
              ))}
              <li>
                <BoardButton name="The demo board" detail="Fictional, just to try it" members={[]} lastUsed={last === "demo"} onClick={() => goTo("demo", "/demo")} />
              </li>
            </ul>

            {!signedIn ? (
              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-[22px] bg-shell-deep p-4">
                <span className="font-display text-[17px]">Add it to your own board</span>
                <span className="ml-auto" onClickCapture={() => store(PENDING_KEY, JSON.stringify(page))}>
                  <SignInButton next="/send" />
                </span>
              </div>
            ) : null}
          </>
        ) : waiting ? (
          <div role="status" className="flex flex-col items-center py-20 text-center">
            <FenceRow />
            <p className="mt-5 font-display text-[22px]">Waiting for the listing…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-16 text-center">
            <FenceRow />
            <h1 className="mt-5 font-display text-[26px]">Nothing was sent</h1>
            <p className="mt-2 max-w-md text-[15px] text-stone-800">
              Open a listing, then use Send to Corral from your bookmarks bar or the Share sheet. Set it up in Board settings.
            </p>
            <a href={signedIn ? "/boards" : "/demo"} className="mt-6 inline-flex h-12 items-center rounded-full bg-sunset-500 px-6 font-display text-[17px] text-tar hover:bg-sunset-400">
              {signedIn ? "Your boards" : "Try the demo"}
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

function BoardButton({ name, detail, members, lastUsed, onClick }: { name: string; detail: string | null; members: string[]; lastUsed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 rounded-[24px] p-4 text-left transition",
        lastUsed ? "bg-sea-800 text-shell hover:bg-sea-700" : "border border-divider bg-shell-light hover:bg-shell-mid"
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[19px] leading-tight">{name}</span>
        {detail ? <span className={cn("mt-0.5 block text-[13px]", lastUsed ? "text-sea-100" : "text-stone-700")}>{detail}</span> : null}
      </span>
      {members.length ? (
        <span aria-label={`${members.length} roommates`} className="flex items-end gap-1">
          {members.slice(0, 5).map((m, i) => (
            <CrewPill key={i} name={m} index={i} size="xs" />
          ))}
        </span>
      ) : null}
    </button>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wave-mark";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRent } from "@/lib/compare";
import { isClosedStatus, type Listing, type ListingInput, type ListingPatch } from "@/lib/listing";
import type { BoardSnapshot, BoardStore } from "@/lib/stores/types";
import { ListingCard } from "./listing-card";
import { ListingForm } from "./listing-form";

type FormState = { mode: "add" } | { mode: "edit"; listing: Listing } | null;

/** Open places first, then Passed/Unavailable; otherwise keep the board's order (newest first). */
function orderForList(listings: Listing[]): Listing[] {
  const open = listings.filter((l) => !isClosedStatus(l.status));
  const closed = listings.filter((l) => isClosedStatus(l.status));
  return [...open, ...closed];
}

export function Board({ store }: { store: BoardStore }) {
  const [snap, setSnap] = useState<BoardSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [formKey, setFormKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((s) => !cancelled && setSnap(s))
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof Error ? e.message : "Couldn't load the board."));
    return () => {
      cancelled = true;
    };
  }, [store]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const replace = useCallback((next: Listing) => {
    setSnap((s) => (s ? { ...s, listings: s.listings.map((l) => (l.id === next.id ? next : l)) } : s));
  }, []);

  const patch = useCallback(
    async (id: string, changes: ListingPatch) => {
      const before = snap?.listings.find((l) => l.id === id);
      if (before) replace({ ...before, ...changes });
      try {
        replace(await store.updateListing(id, changes));
      } catch (e) {
        if (before) replace(before);
        setNotice(e instanceof Error ? e.message : "Couldn't save that change.");
      }
    },
    [snap, store, replace]
  );

  async function add(input: ListingInput) {
    const created = await store.addListing(input);
    setSnap((s) => (s ? { ...s, listings: [created, ...s.listings] } : s));
    setSelectedId(created.id);
    setNotice(`Added ${created.title}.`);
  }

  async function saveEdit(id: string, input: ListingInput) {
    replace(await store.updateListing(id, input));
    setNotice("Changes saved.");
  }

  async function remove(listing: Listing) {
    await store.deleteListing(listing.id);
    setSnap((s) => (s ? { ...s, listings: s.listings.filter((l) => l.id !== listing.id) } : s));
    if (selectedId === listing.id) setSelectedId(null);
    setNotice(`Removed ${listing.title}.`);
  }

  async function resetDemo() {
    if (!store.reset) return;
    if (!window.confirm("Reset the demo? Your changes on this board will be replaced with the original places.")) return;
    setSnap(await store.reset());
    setSelectedId(null);
    setNotice("Demo reset.");
  }

  function openForm(next: FormState) {
    setFormKey((k) => k + 1);
    setForm(next);
  }

  const ordered = useMemo(() => (snap ? orderForList(snap.listings) : []), [snap]);
  const openCount = snap ? snap.listings.filter((l) => !isClosedStatus(l.status)).length : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus">
            <Wordmark />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {snap ? <Members names={snap.board.members.map((m) => m.name)} /> : null}
          </div>
        </div>
      </header>

      {store.kind === "demo" ? (
        <div className="border-b border-coral/30 bg-coral-soft">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm sm:px-6">
            <p className="text-ink">
              <strong className="font-semibold">Fictional demo board.</strong> Places, people and prices are made
              up. Your edits stay in this browser only.
            </p>
            {store.reset ? (
              <Button size="sm" variant="secondary" className="ml-auto h-8" onClick={() => void resetDemo()}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset demo
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {loadError ? (
          <p role="alert" className="rounded-md bg-coral-soft px-4 py-3 text-danger">
            {loadError}
          </p>
        ) : !snap ? (
          <BoardSkeleton />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{snap.board.name}</h1>
                <p className="mt-1 text-sm text-muted">
                  {openCount} {openCount === 1 ? "place" : "places"} in the running
                  {snap.board.budgetPerPersonCents !== null
                    ? `, budget ${formatRent(snap.board.budgetPerPersonCents)} each`
                    : ""}
                </p>
              </div>
              <Button className="ml-auto" onClick={() => openForm({ mode: "add" })}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add place
              </Button>
            </div>

            {ordered.length === 0 ? (
              <div className="mt-8 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center">
                <p className="font-semibold">No places yet</p>
                <p className="mt-1 text-sm text-muted">Paste a listing link to start your shortlist.</p>
                <Button className="mt-4" onClick={() => openForm({ mode: "add" })}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add place
                </Button>
              </div>
            ) : (
              <ul className="mt-6 grid gap-4 md:grid-cols-2" aria-label="Places on this board">
                {ordered.map((l) => (
                  <li key={l.id}>
                    <ListingCard
                      listing={l}
                      board={snap.board}
                      selected={selectedId === l.id}
                      onSelect={() => setSelectedId(l.id)}
                      onPatch={(changes) => patch(l.id, changes)}
                      onEdit={() => openForm({ mode: "edit", listing: l })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted sm:px-6">
          Not affiliated with UCSB. Demo data is fictional.
        </p>
      </footer>

      {form ? (
        <ListingForm
          key={formKey}
          open
          listing={form.mode === "edit" ? form.listing : null}
          onClose={() => setForm(null)}
          onSubmit={(input) => (form.mode === "edit" ? saveEdit(form.listing.id, input) : add(input))}
          onDelete={form.mode === "edit" ? remove : undefined}
        />
      ) : null}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-4">
        {notice ? (
          <p className="pointer-events-auto rounded-full bg-ink px-4 py-2 text-sm font-medium text-sand shadow-lift">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Members({ names }: { names: string[] }) {
  return (
    <ul className="flex -space-x-2" aria-label={`Board members: ${names.join(", ")}`}>
      {names.map((n, i) => (
        <li
          key={n}
          title={n}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface text-xs font-bold text-white"
          style={{ background: ["#1f5f8b", "#3f7552", "#9a6b16", "#e8735a"][i % 4] }}
        >
          <span aria-hidden="true">{n[0]}</span>
        </li>
      ))}
    </ul>
  );
}

function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading board">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-40" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-60 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

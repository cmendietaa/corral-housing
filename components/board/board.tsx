"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { List, Map as MapIcon, Plus, RotateCcw } from "lucide-react";
import { Shoreline } from "@/components/brand/shoreline";
import { Wordmark } from "@/components/brand/wave-mark";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { streetGroup, streetHeadline } from "@/lib/address";
import { formatRent } from "@/lib/compare";
import { isClosedStatus, type Listing, type ListingInput, type ListingPatch } from "@/lib/listing";
import type { BoardSnapshot, BoardStore } from "@/lib/stores/types";
import { cn } from "@/lib/utils";
import { ListingForm } from "./listing-form";
import { ListingRow } from "./listing-row";
import { MapBoundary } from "./map-boundary";

const MapPanel = dynamic(() => import("./map-panel"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-sand-deep" aria-label="Loading map" />
});

type FormState = { mode: "add" } | { mode: "edit"; listing: Listing } | null;
type GroupBy = "status" | "street";
type Group = { key: string; label: string; listings: Listing[]; muted?: boolean };

const GROUP_PREF_KEY = "corral:group-by";

function readGroupPref(): GroupBy {
  try {
    return window.localStorage.getItem(GROUP_PREF_KEY) === "street" ? "street" : "status";
  } catch {
    return "status";
  }
}

function groupListings(listings: Listing[], by: GroupBy): Group[] {
  if (by === "status") {
    const open = listings.filter((l) => !isClosedStatus(l.status));
    const out = listings.filter((l) => isClosedStatus(l.status));
    return [
      { key: "open", label: "In the running", listings: open },
      { key: "out", label: "Passed or unavailable", listings: out, muted: true }
    ].filter((g) => g.listings.length > 0);
  }
  const byStreet = new Map<string, Listing[]>();
  for (const l of listings) {
    const key = streetGroup(l.address);
    byStreet.set(key, [...(byStreet.get(key) ?? []), l]);
  }
  return [...byStreet.entries()]
    .sort(([a], [b]) => (a === "No address yet" ? 1 : b === "No address yet" ? -1 : a.localeCompare(b)))
    .map(([key, ls]) => ({ key, label: key, listings: ls }));
}

export function Board({ store }: { store: BoardStore }) {
  const [snap, setSnap] = useState<BoardSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [formKey, setFormKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const scrollOnSelect = useRef(false);

  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((s) => {
        if (cancelled) return;
        // Read the per-viewer grouping preference alongside the data, after hydration.
        setGroupBy(readGroupPref());
        setSnap(s);
      })
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof Error ? e.message : "Couldn't load the board."));
    return () => {
      cancelled = true;
    };
  }, [store]);

  function changeGroup(next: GroupBy) {
    setGroupBy(next);
    try {
      window.localStorage.setItem(GROUP_PREF_KEY, next);
    } catch {
      /* storage blocked */
    }
  }

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // When a pin is chosen on the map, bring its row into view.
  useEffect(() => {
    if (!selectedId || !scrollOnSelect.current) return;
    scrollOnSelect.current = false;
    rowRefs.current.get(selectedId)?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  }, [selectedId]);

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
    setNotice(
      created.lat === null
        ? `Added ${streetHeadline(created.address, created.title)}. Click the map to place its pin.`
        : `Added ${streetHeadline(created.address, created.title)}.`
    );
  }

  async function saveEdit(id: string, input: ListingInput) {
    replace(await store.updateListing(id, input));
    setNotice("Changes saved.");
  }

  async function remove(listing: Listing) {
    await store.deleteListing(listing.id);
    setSnap((s) => (s ? { ...s, listings: s.listings.filter((l) => l.id !== listing.id) } : s));
    if (selectedId === listing.id) setSelectedId(null);
    setNotice(`Removed ${streetHeadline(listing.address, listing.title)}.`);
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

  const selectFromMap = useCallback((id: string) => {
    scrollOnSelect.current = true;
    setSelectedId(id);
  }, []);

  const movePin = useCallback(
    (id: string, lat: number, lng: number) => {
      void patch(id, { lat, lng });
    },
    [patch]
  );

  const groups = useMemo(() => (snap ? groupListings(snap.listings, groupBy) : []), [snap, groupBy]);
  const openCount = snap ? snap.listings.filter((l) => !isClosedStatus(l.status)).length : 0;
  const selected = snap?.listings.find((l) => l.id === selectedId);

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:min-h-0">
      <header className="shrink-0 border-b border-line bg-surface">
        <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link href="/" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus">
            <Wordmark />
          </Link>
          {store.kind === "demo" ? (
            <p className="ml-auto hidden text-sm text-muted md:block">
              <span className="font-semibold text-ink">Fictional demo.</span> Edits stay in this browser.
            </p>
          ) : null}
          {store.reset ? (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-8 md:ml-2"
              onClick={() => void resetDemo()}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset demo
            </Button>
          ) : null}
        </div>
        {store.kind === "demo" ? (
          <p className="border-t border-line bg-coral-soft px-4 py-1.5 text-xs text-ink md:hidden">
            <span className="font-semibold">Fictional demo.</span> Places, people and prices are made up. Edits stay
            in this browser.
          </p>
        ) : null}
      </header>

      {loadError ? (
        <p role="alert" className="m-6 rounded-md bg-coral-soft px-4 py-3 text-danger">
          {loadError}
        </p>
      ) : !snap ? (
        <BoardSkeleton />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(26rem,1fr)_minmax(0,1.15fr)]">
          {/* List column */}
          <section
            aria-label="Places"
            className={cn(
              "min-h-0 flex-1 lg:overflow-y-auto lg:border-r lg:border-line",
              mobileView === "map" && "hidden lg:block"
            )}
          >
            <div className="px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
              <div className="min-w-0">
                <h1 className="font-display text-[2rem] font-extrabold leading-[1.05] text-ink sm:text-[2.5rem]">
                  {snap.board.name}
                </h1>
                <Shoreline className="mt-3" />
                <p className="mt-3 text-sm text-muted">
                  {snap.board.members.map((m) => m.name).join(", ")}
                  <span className="mx-2 text-line" aria-hidden="true">|</span>
                  <span className="font-display font-bold text-ink">{openCount}</span>{" "}
                  {openCount === 1 ? "place" : "places"} in the running
                  {snap.board.budgetPerPersonCents !== null ? (
                    <>
                      , up to{" "}
                      <span className="font-display font-bold text-ink">
                        {formatRent(snap.board.budgetPerPersonCents)}
                      </span>{" "}
                      each
                    </>
                  ) : null}
                </p>
              </div>

              <div className="mt-5 flex items-center gap-2 text-sm">
                <span className="text-muted" id="group-label">
                  Group by
                </span>
                <div role="group" aria-labelledby="group-label" className="inline-flex rounded-full bg-sand-deep p-0.5">
                  {(["status", "street"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={groupBy === g}
                      onClick={() => changeGroup(g)}
                      className={cn(
                        "rounded-full px-3 py-1 font-medium transition focus-visible:outline-2 focus-visible:outline-focus",
                        groupBy === g ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink"
                      )}
                    >
                      {g === "status" ? "Status" : "Street"}
                    </button>
                  ))}
                </div>
                <Button className="ml-auto" size="sm" onClick={() => openForm({ mode: "add" })}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add place
                </Button>
              </div>

              {groups.length === 0 ? (
                <div className="mt-6 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center">
                  <p className="font-semibold">No places yet</p>
                  <p className="mt-1 text-sm text-muted">Paste a listing link to start your shortlist.</p>
                  <Button className="mt-4" onClick={() => openForm({ mode: "add" })}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add place
                  </Button>
                </div>
              ) : (
                groups.map((g) => (
                  <section key={g.key} aria-labelledby={`group-${g.key}`} className="mt-6">
                    <h2
                      id={`group-${g.key}`}
                      className={cn(
                        "flex items-baseline gap-2 border-b-2 pb-1.5 text-sm font-bold",
                        g.muted ? "border-line text-muted" : "border-ink text-ink"
                      )}
                    >
                      {g.label}
                      <span className="font-medium text-muted tabular-nums">{g.listings.length}</span>
                    </h2>
                    <ul className="divide-y divide-line">
                      {g.listings.map((l) => (
                        <li key={l.id}>
                          <ListingRow
                            ref={(el) => {
                              if (el) rowRefs.current.set(l.id, el);
                              else rowRefs.current.delete(l.id);
                            }}
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
                  </section>
                ))
              )}

              <p className="mt-10 text-xs text-muted">Not affiliated with UCSB. Demo data is fictional.</p>
            </div>
          </section>

          {/* Map column */}
          <section
            aria-label="Map of places"
            className={cn(
              "relative min-h-0 flex-1 lg:block",
              mobileView === "list" ? "hidden" : "flex flex-col"
            )}
          >
            <div className="h-[calc(100dvh-8.5rem)] w-full lg:h-full">
              <MapBoundary>
                <MapPanel
                  listings={snap.listings}
                  selectedId={selectedId}
                  onSelect={selectFromMap}
                  onMovePin={movePin}
                />
              </MapBoundary>
            </div>
            {selected && mobileView === "map" ? (
              <div className="absolute inset-x-3 top-24 z-[1050] rounded-lg border border-line bg-surface p-3 shadow-lift lg:hidden">
                <p className="font-bold">{streetHeadline(selected.address, selected.title)}</p>
                <p className="text-sm text-muted">
                  {selected.rentCents === null ? "Rent unknown" : `${formatRent(selected.rentCents)}/mo`}
                </p>
                <button
                  type="button"
                  className="mt-1 text-sm font-semibold text-ocean underline underline-offset-4"
                  onClick={() => {
                    setMobileView("list");
                    scrollOnSelect.current = true;
                    setSelectedId(selected.id);
                    window.setTimeout(
                      () => rowRefs.current.get(selected.id)?.scrollIntoView({ block: "center" }),
                      50
                    );
                  }}
                >
                  Show in list
                </button>
              </div>
            ) : null}
          </section>
        </div>
      )}

      {/* Phone-only List / Map switch */}
      {snap ? (
        <div className="fixed inset-x-0 bottom-4 z-[1100] flex justify-center lg:hidden">
          <div role="group" aria-label="View" className="inline-flex rounded-full bg-ink p-1 shadow-lift">
            {(["list", "map"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={mobileView === v}
                onClick={() => setMobileView(v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral",
                  mobileView === v ? "bg-sand text-ink" : "text-sand/80 hover:text-sand"
                )}
              >
                {v === "list" ? <List className="h-4 w-4" aria-hidden="true" /> : <MapIcon className="h-4 w-4" aria-hidden="true" />}
                {v === "list" ? "List" : "Map"}
              </button>
            ))}
          </div>
        </div>
      ) : null}

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

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[1200] flex justify-center px-4 lg:bottom-6">
        {notice ? (
          <p className="pointer-events-auto rounded-full bg-ink px-4 py-2 text-sm font-medium text-sand shadow-lift">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading board" className="grid flex-1 lg:grid-cols-[minmax(26rem,1fr)_minmax(0,1.15fr)]">
      <div className="px-4 pt-5 sm:px-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-48" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="mt-6 h-28" />
        ))}
      </div>
      <Skeleton className="hidden rounded-none lg:block" />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lookupPin } from "@/lib/geocode-client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { List, Map as MapIcon, Plus, SquareKanban } from "lucide-react";
import { AddBoardButton, Band, BandToggle, CrewBoards, FenceFooter } from "@/components/brand/band";
import { Wordmark } from "@/components/brand/wave-mark";
import { Button } from "@/components/ui/button";
import { streetHeadline } from "@/lib/address";
import { isClosedStatus, type Listing, type ListingInput, type ListingPatch } from "@/lib/listing";
import type { BoardSnapshot, BoardStore } from "@/lib/stores/types";
import { cn } from "@/lib/utils";
import { CompareTray, CompareView } from "./compare-view";
import { InviteDialog } from "./invite-dialog";
import { ListingForm } from "./listing-form";
import { ListingRow } from "./listing-row";
import { MapBoundary } from "./map-boundary";
import { MapMiniCard, PlaceCard, PlaceSheet } from "./place-card";
import { StatusBoard } from "./status-board";
import { FenceFallback } from "./street-photo";

const MapPanel = dynamic(() => import("./map-panel"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-shell-light" aria-label="Loading map" />
});

type FormState = { mode: "add" } | { mode: "edit"; listing: Listing } | null;
type Tab = "map" | "status";
type Pane = "list" | "map";

const MAX_COMPARE = 3;
const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches;
const smooth = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

/**
 * `photos`: whether Street View is configured on this deployment.
 * `makeInviteLink`: private boards only; creates a fresh invite link.
 */
export function Board({
  store,
  photos = false,
  makeInviteLink
}: {
  store: BoardStore;
  photos?: boolean;
  makeInviteLink?: () => Promise<string>;
}) {
  const [snap, setSnap] = useState<BoardSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [tab, setTab] = useState<Tab>("map");
  const [pane, setPane] = useState<Pane>("list");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [formKey, setFormKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((s) => {
        if (cancelled) return;
        setSnap(s);
        // Open with the first place in the running selected, so the map card shows something.
        setSelectedId(s.listings.find((l) => !isClosedStatus(l.status) && l.lat !== null)?.id ?? null);
      })
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof Error ? e.message : "Couldn't load the board."));
    return () => {
      cancelled = true;
    };
  }, [store]);

  // Live updates from roommates (private boards only). Deletes can't be
  // filtered by board, so a reload of the whole snapshot keeps it simple.
  useEffect(() => {
    if (!store.subscribe) return;
    return store.subscribe(() => {
      store
        .load()
        .then((s) => setSnap(s))
        .catch(() => {});
    });
  }, [store]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const scrollToRow = useCallback((id: string) => {
    window.requestAnimationFrame(() => rowRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: smooth() }));
  }, []);

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
    // Place the pin from the address; dropping it by hand is only the fallback.
    const pin = input.lat === null ? await lookupPin(input.address) : null;
    const created = await store.addListing(pin ? { ...input, ...pin } : input);
    setSnap((s) => (s ? { ...s, listings: [created, ...s.listings] } : s));
    setSelectedId(created.id);
    setNotice(
      created.lat === null
        ? created.address
          ? `Added ${streetHeadline(created.address, created.title)}. Couldn't find that address on the map, so click the map to drop its pin.`
          : `Added ${streetHeadline(created.address, created.title)}. Add an address, or click the map to drop its pin.`
        : `Added ${streetHeadline(created.address, created.title)}.`
    );
  }

  async function saveEdit(id: string, input: ListingInput) {
    const before = snap?.listings.find((l) => l.id === id);
    const norm = (a: string | null | undefined) => (a ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const moved = before && norm(before.address) !== norm(input.address);
    const pin = moved ? await lookupPin(input.address) : null;
    replace(await store.updateListing(id, pin ? { ...input, ...pin } : input));
    setNotice(moved && !pin && input.address ? "Changes saved. Couldn't find the new address, so drag the pin to fix it." : "Changes saved.");
  }

  async function remove(listing: Listing) {
    await store.deleteListing(listing.id);
    setSnap((s) => (s ? { ...s, listings: s.listings.filter((l) => l.id !== listing.id) } : s));
    setChecked((c) => c.filter((id) => id !== listing.id));
    if (selectedId === listing.id) setSelectedId(null);
    if (sheetId === listing.id) setSheetId(null);
    setNotice(`Removed ${streetHeadline(listing.address, listing.title)}.`);
  }

  async function resetDemo() {
    if (!store.reset) return;
    if (!window.confirm("Reset the demo? Your changes on this board will be replaced with the original places.")) return;
    const fresh = await store.reset();
    setSnap(fresh);
    setChecked([]);
    setComparing(false);
    setSelectedId(fresh.listings.find((l) => !isClosedStatus(l.status) && l.lat !== null)?.id ?? null);
    setNotice("Demo reset.");
  }

  function openForm(next: FormState) {
    setFormKey((k) => k + 1);
    setForm(next);
  }

  function toggleCheck(id: string) {
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_COMPARE ? c : [...c, id]));
  }

  /** A row or card was chosen: select it on desktop, open its sheet on phones. */
  function activate(id: string) {
    setSelectedId(id);
    if (isDesktop()) {
      setTab("map");
      scrollToRow(id);
    } else {
      setSheetId(id);
    }
  }

  const selectFromMap = useCallback(
    (id: string) => {
      setSelectedId(id);
      scrollToRow(id);
    },
    [scrollToRow]
  );

  const movePin = useCallback((id: string, lat: number, lng: number) => void patch(id, { lat, lng }), [patch]);

  const listings = useMemo(() => snap?.listings ?? [], [snap]);
  const open = listings.filter((l) => !isClosedStatus(l.status));
  const washed = listings.filter((l) => isClosedStatus(l.status));
  const selected = listings.find((l) => l.id === selectedId) ?? null;
  const sheet = listings.find((l) => l.id === sheetId) ?? null;
  const checkedPlaces = checked.map((id) => listings.find((l) => l.id === id)).filter((l): l is Listing => Boolean(l));
  const onMap = listings.filter((l) => l.lat !== null).length;

  if (loadError) {
    return (
      <p role="alert" className="m-6 rounded-[22px] bg-sunset-100 px-5 py-4 text-danger">
        {loadError}
      </p>
    );
  }

  if (!snap) return <BoardSkeleton />;

  if (comparing && checkedPlaces.length >= 2) {
    return <CompareView places={checkedPlaces} board={snap.board} photos={photos} onBack={() => setComparing(false)} />;
  }

  const board = snap.board;
  const isDemo = store.kind === "demo";
  const kicker = `Isla Vista & Goleta · Lease ${board.leaseYear}`;
  const tabToggle = (
    <BandToggle
      label="View"
      value={tab}
      onChange={setTab}
      options={[
        { value: "map", label: "Map" },
        { value: "status", label: "Status" }
      ]}
    />
  );

  const rows = (items: Listing[]) => (
    <ul className="space-y-1 max-lg:divide-y max-lg:divide-divider max-lg:space-y-0">
      {items.map((l) => (
        <li key={l.id} className="max-lg:py-1">
          <ListingRow
            ref={(el) => {
              if (el) rowRefs.current.set(l.id, el);
              else rowRefs.current.delete(l.id);
            }}
            listing={l}
            board={board}
            photos={photos}
            selected={selectedId === l.id}
            checked={checked.includes(l.id)}
            checkDisabled={!checked.includes(l.id) && checked.length >= MAX_COMPARE}
            onToggleCheck={() => toggleCheck(l.id)}
            onActivate={() => activate(l.id)}
            onPatch={(changes) => patch(l.id, changes)}
          />
        </li>
      ))}
    </ul>
  );

  const ledger = (
    <section aria-label="Places" className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3 px-2">
        <h2 className="label text-stone-700">Still in the running · {open.length}</h2>
        {makeInviteLink ? (
          <div className="flex items-center gap-1 lg:hidden">
            <Link href="/boards" className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-stone-800 hover:bg-shell-mid">
              Boards
            </Link>
            <Button size="sm" variant="secondary" onClick={() => setInviting(true)}>
              Invite
            </Button>
          </div>
        ) : null}
        {isDemo && store.reset ? (
          <p className="rounded-full bg-glass-200 px-3.5 py-1.5 text-[13px] text-glass-900">
            Fictional demo ·{" "}
            <button type="button" onClick={() => void resetDemo()} className="font-semibold underline underline-offset-4">
              Reset
            </button>
          </p>
        ) : null}
      </div>
      {listings.length === 0 ? (
        <EmptyBoard onAdd={() => openForm({ mode: "add" })} />
      ) : (
        <>
          {rows(open)}
          {washed.length > 0 ? (
            <>
              <h2 className="label mb-2 mt-6 px-2 text-stone-700">Washed out · {washed.length}</h2>
              {rows(washed)}
            </>
          ) : null}
        </>
      )}
    </section>
  );

  const tray = (className: string) => (
    <CompareTray
      count={checked.length}
      onCompare={() => {
        setComparing(true);
        window.scrollTo({ top: 0 });
      }}
      onClear={() => setChecked([])}
      className={className}
    />
  );

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col",
        // Phone map: exactly one screen tall, so the map, card and switch all fit.
        tab === "map" && pane === "map" && "max-lg:h-dvh max-lg:min-h-0 max-lg:overflow-hidden"
      )}
    >
      {/* ---------- Desktop header band ---------- */}
      <div className="hidden lg:block">
        {tab === "map" ? (
          <Band
            stripeRight={
              <>
                <CrewBoards members={board.members} />
                <AddBoardButton onClick={() => openForm({ mode: "add" })} />
              </>
            }
          >
            <div className="px-10 pb-7 pt-7">
              <div className="flex items-center gap-3">
                <Link href="/" aria-label="Corral home">
                  <Wordmark />
                </Link>
                <div className="ml-auto flex items-center gap-3">
                  {tabToggle}
                  {makeInviteLink ? (
                    <>
                      <Link href="/boards" className="h-11 rounded-full px-4 py-2.5 font-display text-[15px] text-tar hover:bg-sunset-200">
                        Boards
                      </Link>
                      <Button variant="secondary" size="md" onClick={() => setInviting(true)}>
                        Invite
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              <p className="label mt-7 text-tar">{kicker}</p>
              <h1 className="mt-2 font-display text-[50px] leading-[1.05] text-tar">{board.name}</h1>
            </div>
          </Band>
        ) : (
          <Band variant="compact">
            <div className="flex items-center gap-8 px-10 py-3">
              <Link href="/" aria-label="Corral home">
                <Wordmark />
              </Link>
              <h1 className="font-display text-[28px] leading-tight text-tar">Where each place stands</h1>
              <div className="ml-auto">{tabToggle}</div>
            </div>
          </Band>
        )}
      </div>

      {/* ---------- Phone header band ---------- */}
      <div className="lg:hidden">
        {tab === "map" && pane === "list" ? (
          <Band>
            <div className="flex items-start gap-3 px-4 pb-5 pt-5">
              <div className="min-w-0 flex-1">
                <Link href="/" aria-label="Corral home">
                  <Wordmark size="sm" />
                </Link>
                <h1 className="mt-5 font-display text-[30px] leading-[1.05] text-tar">{board.name}</h1>
              </div>
              <AddBoardButton size="sm" onClick={() => openForm({ mode: "add" })} />
            </div>
          </Band>
        ) : (
          <Band variant="compact">
            <div className="flex items-center gap-3 px-4 py-3">
              <Link href="/" aria-label="Corral home">
                <Wordmark size="sm" />
              </Link>
              {tab === "status" ? (
                <h1 className="font-display text-lg text-tar">Where things stand</h1>
              ) : (
                <p className="label ml-auto text-tar">{onMap} on the map</p>
              )}
            </div>
          </Band>
        )}
      </div>

      {/* ---------- Content ---------- */}
      {tab === "status" ? (
        <main className="flex-1 px-4 pt-5 lg:px-6 lg:pt-6">
          <StatusBoard listings={listings} board={board} photos={photos} onPatch={patch} onOpen={activate} />
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[540px_minmax(0,1fr)] lg:gap-5 lg:px-6 lg:pb-8 lg:pt-4">
          <div className={cn("px-2 pb-28 pt-4 lg:px-0 lg:pb-0", pane === "map" && "max-lg:hidden")}>{ledger}</div>

          <section
            aria-label="Map of places"
            className={cn(
              "relative overflow-hidden bg-shell-light",
              // Fits under the header band at the top of the page, so the card and tray are in view.
              "lg:sticky lg:top-4 lg:block lg:h-[calc(100vh-320px)] lg:min-h-[540px] lg:rounded-[200px_32px_32px_32px]",
              pane === "list" ? "max-lg:hidden" : "max-lg:min-h-0 max-lg:flex-1"
            )}
          >
            <MapBoundary>
              <MapPanel listings={listings} selectedId={selectedId} onSelect={selectFromMap} onMovePin={movePin} />
            </MapBoundary>

            {/* Desktop: the selected place, bottom-left; the compare tray, bottom-right. */}
            {selected ? (
              <div className="no-scrollbar absolute bottom-[18px] left-[18px] z-20 hidden max-h-[calc(100%-36px)] overflow-y-auto rounded-[30px] lg:block">
                <PlaceCard
                  key={selected.id}
                  listing={selected}
                  board={board}
                  photos={photos}
                  onPatch={(p) => patch(selected.id, p)}
                  onEdit={() => openForm({ mode: "edit", listing: selected })}
                  onClose={() => setSelectedId(null)}
                />
              </div>
            ) : null}
            {tray("absolute bottom-[18px] right-[18px] z-20 hidden lg:flex")}

            {/* Phones: the selected place floats above the switch. */}
            {selected && pane === "map" ? (
              <div className="fixed inset-x-3 bottom-[5.75rem] z-30 lg:hidden">
                <MapMiniCard listing={selected} board={board} photos={photos} onOpen={() => setSheetId(selected.id)} />
              </div>
            ) : null}
          </section>
        </main>
      )}

      {/* Phones: compare tray above the switch (list and status) */}
      {checked.length > 0 && !(tab === "map" && pane === "map" && selected) ? (
        <div className="fixed inset-x-0 bottom-[5.5rem] z-30 flex justify-center px-4 lg:hidden">{tray("")}</div>
      ) : null}

      <div className={cn("hidden lg:block", tab === "map" && pane === "list" && "max-lg:block")}>
        <FenceFooter className="mt-6 lg:mt-2" />
      </div>

      {/* Phones: List / Map / Status switch */}
      <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center lg:hidden">
        <div role="group" aria-label="View" className="inline-flex rounded-full bg-sea-800 p-1 shadow-lg">
          {(
            [
              { key: "list", label: "List", icon: List, active: tab === "map" && pane === "list" },
              { key: "map", label: "Map", icon: MapIcon, active: tab === "map" && pane === "map" },
              { key: "status", label: "Status", icon: SquareKanban, active: tab === "status" }
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={o.active}
              onClick={() => {
                if (o.key === "status") setTab("status");
                else {
                  setTab("map");
                  setPane(o.key);
                }
              }}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full px-4 font-display text-[15px] transition",
                o.active ? "bg-sunset-300 text-tar" : "text-sea-100"
              )}
            >
              <o.icon className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {sheet ? (
        <PlaceSheet
          key={sheet.id}
          listing={sheet}
          board={board}
          photos={photos}
          onPatch={(p) => patch(sheet.id, p)}
          onEdit={() => openForm({ mode: "edit", listing: sheet })}
          onClose={() => setSheetId(null)}
          onDropPin={() => {
            setSheetId(null);
            setSelectedId(sheet.id);
            setTab("map");
            setPane("map");
          }}
          checked={checked.includes(sheet.id)}
          checkDisabled={!checked.includes(sheet.id) && checked.length >= MAX_COMPARE}
          onToggleCheck={() => toggleCheck(sheet.id)}
        />
      ) : null}

      {inviting && makeInviteLink ? <InviteDialog makeLink={makeInviteLink} onClose={() => setInviting(false)} /> : null}

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

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-6">
        {notice ? (
          <p className="pointer-events-auto rounded-full bg-tar px-5 py-2.5 text-sm font-semibold text-shell shadow-lg">{notice}</p>
        ) : null}
      </div>
    </div>
  );
}

function EmptyBoard({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-[30px] bg-shell-deep px-6 py-14 text-center">
      <div className="h-16 w-16">
        <FenceFallback />
      </div>
      <p className="mt-3 font-display text-[19px] text-tar">Nothing in the corral yet</p>
      <p className="mt-1 text-sm text-stone-700">Paste a link and an address to round one up.</p>
      <Button className="mt-5" onClick={onAdd}>
        <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
        Add a place
      </Button>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading board" className="flex min-h-screen flex-col">
      <Band>
        <div className="h-[150px] lg:h-[230px]" />
      </Band>
      <div className="grid flex-1 gap-5 px-4 pt-4 lg:grid-cols-[540px_minmax(0,1fr)] lg:px-6">
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[24px] bg-shell-deep" />
          ))}
        </div>
        <div className="hidden animate-pulse rounded-[200px_32px_32px_32px] bg-shell-light lg:block" />
      </div>
    </div>
  );
}

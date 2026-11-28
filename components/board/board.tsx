"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lookupPin } from "@/lib/geocode-client";
import { shrinkPhoto } from "@/lib/photo-shrink";
import { resolveCover } from "@/lib/cover";
import { MAX_PHOTOS_PER_PLACE, type Photo } from "@/lib/stores/types";
import { TourPhotosContext } from "./tour-photos";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { List, ListOrdered, Map as MapIcon, Plus, Settings, SquareKanban } from "lucide-react";
import { AddBoardButton, Band, BandSun, BandToggle, CrewBoards, FenceFooter, FinePrint } from "@/components/brand/band";
import { Wordmark } from "@/components/brand/wave-mark";
import { Button } from "@/components/ui/button";
import { streetHeadline } from "@/lib/address";
import { groupSizeOf } from "@/lib/compare";
import { isClosedStatus, starredFirst, type Listing, type ListingInput, type ListingPatch } from "@/lib/listing";
import { NOT_ON_BOARD, type BoardSnapshot, type BoardStore } from "@/lib/stores/types";
import { INCOMING_KEY, readMessage, type Incoming, type SentPage } from "@/lib/send/payload";
import { cn } from "@/lib/utils";
import { BoardSettingsDialog } from "./board-settings";
import { CompareTray, CompareView } from "./compare-view";
import { InviteDialog } from "./invite-dialog";
import { AddPlaceFlow } from "./add-place";
import { ListingForm } from "./listing-form";
import { ListingRow } from "./listing-row";
import { MapBoundary } from "./map-boundary";
import { MapMiniCard, PlaceCard, PlaceSheet } from "./place-card";
import { RankView } from "./rank-view";
import { StatusBoard } from "./status-board";
import { FenceFallback } from "./street-photo";
import { GateLoading } from "@/components/brand/motifs";

const MapPanel = dynamic(() => import("./map-panel"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-shell-light" aria-label="Loading map" />
});

type FormState = { mode: "add" } | { mode: "edit"; listing: Listing } | null;
type Tab = "map" | "status" | "rank";
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
  const [incoming, setIncoming] = useState<SentPage | null>(null);
  const afterAdd = useRef<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const router = useRouter();
  const rowRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((s) => {
        if (cancelled) return;
        setSnap(s);
        // Send to Corral: a listing sent from the browser opens straight into Round it up.
        const sent = takeIncoming(s.board.id);
        if (sent) {
          setIncoming(sent);
          setFormKey((k) => k + 1);
          setForm({ mode: "add" });
        }
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
  // Tour photos. Reloads keep the URL of photos we already show, so a live
  // update doesn't re-download every image; the timer swaps in fresh signed
  // links before the old ones (1 hour) expire.
  const [photoList, setPhotoList] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState<Record<string, number>>({});
  const loadPhotos = useCallback(
    async (freshUrls = false) => {
      if (!store.loadPhotos) return;
      try {
        const next = await store.loadPhotos();
        setPhotoList((prev) => (freshUrls ? next : next.map((p) => prev.find((q) => q.id === p.id) ?? p)));
      } catch {
        // Photos are extra; the board still works without them.
      }
    },
    [store]
  );
  useEffect(() => {
    if (!store.loadPhotos) return;
    let cancelled = false;
    store
      .loadPhotos()
      .then((list) => !cancelled && setPhotoList(list))
      .catch(() => {});
    const t = window.setInterval(() => void loadPhotos(true), 45 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [store, loadPhotos]);

  useEffect(() => {
    if (!store.subscribe) return;
    return store.subscribe(() => {
      store
        .load()
        .then((s) => setSnap(s))
        // Removed from the board, or it was deleted: say so instead of showing stale places.
        .catch((e: unknown) => e instanceof Error && e.message === NOT_ON_BOARD && setLoadError(NOT_ON_BOARD));
      void loadPhotos();
    });
  }, [store, loadPhotos]);



  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // Scroll the whole list item, so a place's opened details come into view with it.
  const scrollToRow = useCallback((id: string) => {
    window.requestAnimationFrame(() => {
      const row = rowRefs.current.get(id);
      (row?.closest("li") ?? row)?.scrollIntoView({ block: "nearest", behavior: smooth() });
    });
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
        return true;
      } catch (e) {
        if (before) replace(before);
        setNotice(e instanceof Error ? e.message : "Couldn't save that change.");
        return false;
      }
    },
    [snap, store, replace]
  );

  const members = snap?.board.members;
  const boardListings = snap?.listings;
  const photoCtx = useMemo(() => {
    if (!store.addPhoto || !store.deletePhoto) return null;
    const addPhoto = store.addPhoto.bind(store);
    const deletePhoto = store.deletePhoto.bind(store);
    const bump = (id: string, by: number) => setUploading((u) => ({ ...u, [id]: Math.max(0, (u[id] ?? 0) + by) }));
    return {
      photosFor: (id: string) => photoList.filter((p) => p.listingId === id),
      uploadingFor: (id: string) => uploading[id] ?? 0,
      memberName: (id: string | null) => (id ? (members?.find((m) => m.id === id)?.name ?? null) : null),
      coverFor: (id: string) =>
        resolveCover(
          boardListings?.find((l) => l.id === id),
          photoList.filter((p) => p.listingId === id)
        ),
      setCover: (id: string, cover: string) => void patch(id, { cover }),
      setStreetView: (id: string, show: boolean) => {
        const l = boardListings?.find((x) => x.id === id);
        // Hiding Street View also drops it as the cover, so the next photo leads.
        void patch(id, show || l?.cover !== "street" ? { streetView: show } : { streetView: show, cover: null });
        setNotice(show ? "Street View is back for this place." : "Street View hidden for this place.");
      },
      async add(listingId: string, files: File[]) {
        const room = MAX_PHOTOS_PER_PLACE - photoList.filter((p) => p.listingId === listingId).length - (uploading[listingId] ?? 0);
        const batch = files.slice(0, Math.max(0, room));
        if (files.length > batch.length) {
          setNotice(room > 0 ? `Only room for ${room} more photo${room === 1 ? "" : "s"} on this place.` : `A place can have up to ${MAX_PHOTOS_PER_PLACE} photos.`);
        }
        bump(listingId, batch.length);
        for (const file of batch) {
          try {
            const photo = await addPhoto(listingId, await shrinkPhoto(file));
            setPhotoList((list) => (list.some((p) => p.id === photo.id) ? list : [...list, photo]));
          } catch (e) {
            setNotice(e instanceof Error ? e.message : "Couldn't add that photo.");
          } finally {
            bump(listingId, -1);
          }
        }
      },
      async remove(photo: Photo) {
        try {
          await deletePhoto(photo);
          setPhotoList((list) => list.filter((p) => p.id !== photo.id));
          setNotice("Photo removed.");
        } catch (e) {
          setNotice(e instanceof Error ? e.message : "Couldn't remove that photo.");
        }
      }
    };
  }, [store, photoList, uploading, members, boardListings, patch]);

  async function add(input: ListingInput, files: File[] = []) {
    // Place the pin from the address; dropping it by hand is only the fallback.
    const pin = input.lat === null ? await lookupPin(input.address) : null;
    const created = await store.addListing(pin ? { ...input, ...pin } : input);
    setSnap((s) => (s ? { ...s, listings: [created, ...s.listings] } : s));
    setSelectedId(created.id);
    // Photos picked in the form upload in the background; the place shows them as they land.
    if (files.length && photoCtx) void photoCtx.add(created.id, files);
    // The add flow says "…is in the corral" itself; the board only follows up when the pin needs a hand.
    afterAdd.current =
      created.lat === null
        ? created.address
          ? `Couldn't find ${streetHeadline(created.address, created.title)} on the map. Click the map to drop its pin.`
          : `Add an address for ${streetHeadline(created.address, created.title)}, or click the map to drop its pin.`
        : null;
    return created;
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
    setPhotoList((list) => list.filter((p) => p.listingId !== listing.id));
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
    setPhotoList([]);
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
  // Starred places first in each group; the Rank tab keeps its own order.
  const open = starredFirst(listings.filter((l) => !isClosedStatus(l.status)));
  const washed = starredFirst(listings.filter((l) => isClosedStatus(l.status)));
  const selected = listings.find((l) => l.id === selectedId) ?? null;
  const sheet = listings.find((l) => l.id === sheetId) ?? null;
  const checkedPlaces = checked.map((id) => listings.find((l) => l.id === id)).filter((l): l is Listing => Boolean(l));
  const onMap = listings.filter((l) => l.lat !== null).length;

  if (loadError === NOT_ON_BOARD && store.kind === "private") {
    return (
      <div role="alert" className="mx-auto mt-16 max-w-lg rounded-[30px] bg-sea-100 p-8 text-center">
        <h1 className="font-display text-[26px] text-tar">You&apos;re no longer on this board</h1>
        <p className="mt-2 text-stone-800">It was deleted, or you were removed. Ask a roommate for a new invite link to get back in.</p>
        <Link href="/boards" className="mt-5 inline-block font-semibold text-sea-700 underline underline-offset-4">
          Back to your boards
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <p role="alert" className="m-6 rounded-[22px] bg-sunset-100 px-5 py-4 text-danger">
        {loadError}
      </p>
    );
  }

  if (!snap) return <BoardSkeleton />;

  if (comparing && checkedPlaces.length >= 2) {
    return (
      <TourPhotosContext.Provider value={photoCtx}>
        <CompareView places={checkedPlaces} board={snap.board} photos={photos} onBack={() => setComparing(false)} />
      </TourPhotosContext.Provider>
    );
  }

  const board = snap.board;
  const isDemo = store.kind === "demo";
  // Boards don't repeat the UCSB line from the public pages; only the demo needs a note.
  const footNote = isDemo ? "Demo data is fictional." : null;
  const kicker = `Isla Vista & Goleta · Lease ${board.leaseYear}`;
  const tabToggle = (
    <BandToggle
      label="View"
      value={tab}
      onChange={setTab}
      options={[
        { value: "map", label: "Map" },
        { value: "status", label: "Status" },
        { value: "rank", label: "Rank" }
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
        <div className="flex items-center gap-1">
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
    <TourPhotosContext.Provider value={photoCtx}>
    <div
      className={cn(
        "flex min-h-screen flex-col",
        // Phone map: exactly one screen tall, so the map, card and switch all fit.
        tab === "map" && pane === "map" && "max-lg:h-dvh max-lg:min-h-0 max-lg:overflow-hidden",
        // Desktop map and rank: one screen tall, with each side scrolling on its own.
        tab !== "status" && "lg:h-dvh lg:min-h-0 lg:overflow-hidden"
      )}
    >
      {/* ---------- Desktop header band: one slim band on every tab, so switching
          views doesn't jump and the board name always says where you are. ---------- */}
      <div className="hidden lg:block">
        <Band variant="compact" sun={false}>
          <div className="flex items-center gap-6 px-10 py-3">
            <Link href="/" aria-label="Corral home" className="shrink-0">
              <Wordmark />
            </Link>
            <span aria-hidden="true" className="h-9 w-px shrink-0 bg-tar/20" />
            <div className="min-w-0">
              <p className="label truncate text-tar">{kicker}</p>
              <h1 className="truncate font-display text-[28px] leading-tight text-tar">{board.name}</h1>
            </div>
            {/* Open sky between the name and the controls: the sun sets here, when there's room for it.
                The name gets space first; the gap only takes what's left. */}
            <div className="@container relative min-w-0 flex-1 self-stretch">
              <BandSun className="hidden @min-[140px]:block" />
            </div>
            <div className="flex shrink-0 items-center gap-3">
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
              {store.settings ? <SettingsButton onClick={() => setSettingsOpen(true)} /> : null}
              <CrewBoards members={board.members} size="sm" />
              <AddBoardButton size="sm" onClick={() => openForm({ mode: "add" })} />
            </div>
          </div>
        </Band>
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
              <div className="flex shrink-0 items-start gap-1">
                {store.settings ? <SettingsButton onClick={() => setSettingsOpen(true)} className="mt-3.5" /> : null}
                <AddBoardButton size="sm" onClick={() => openForm({ mode: "add" })} />
              </div>
            </div>
          </Band>
        ) : (
          <Band variant="compact" sun={false}>
            <div className="flex items-center gap-3 px-4 py-3">
              <Link href="/" aria-label="Corral home" className="shrink-0">
                <Wordmark size="sm" />
              </Link>
              {tab === "status" ? (
                <h1 className="min-w-0 truncate font-display text-lg text-tar">Where things stand</h1>
              ) : tab === "rank" ? (
                <h1 className="min-w-0 truncate font-display text-lg text-tar">Best fit for you</h1>
              ) : null}
              <div className="@container relative min-w-0 flex-1 self-stretch">
                <BandSun size="sm" className="hidden @min-[76px]:block" />
              </div>
              {tab === "map" ? <p className="label shrink-0 text-tar">{onMap} on the map</p> : null}
              {store.settings ? <SettingsButton onClick={() => setSettingsOpen(true)} className="-my-1 -mr-1.5" /> : null}
            </div>
          </Band>
        )}
      </div>

      {/* ---------- Content ---------- */}
      {tab === "status" ? (
        <main className="flex-1 px-4 pt-5 lg:px-6 lg:pt-6">
          <StatusBoard listings={listings} board={board} photos={photos} onPatch={patch} onOpen={activate} />
        </main>
      ) : tab === "rank" ? (
        <main className="flex-1 px-4 pt-5 lg:min-h-0 lg:px-6 lg:pt-0">
          <RankView
            footNote={footNote}
            listings={listings}
            board={board}
            photos={photos}
            checked={checked}
            checkDisabled={(id) => !checked.includes(id) && checked.length >= MAX_COMPARE}
            onToggleCheck={toggleCheck}
            onCompare={(ids) => {
              setChecked(ids);
              setComparing(true);
              window.scrollTo({ top: 0 });
            }}
            onOpen={activate}
            onEdit={(id) => {
              const l = listings.find((x) => x.id === id);
              if (l) openForm({ mode: "edit", listing: l });
            }}
          />
          {/* Desktop: places roped in on Rank get the same tray as on the map. */}
          {checked.length > 0 ? <div className="fixed bottom-6 right-6 z-30 hidden lg:block">{tray("")}</div> : null}
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[540px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-5 lg:px-6 lg:pb-6">
          <div className={cn("pane-scroll px-2 pb-28 pt-4 lg:-mr-2 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:px-0 lg:pb-6 lg:pr-2", pane === "map" && "max-lg:hidden")}>
            {ledger}
            <FinePrint note={footNote} className="mt-8 hidden lg:flex" />
          </div>

          <section
            aria-label="Map of places"
            className={cn(
              "relative overflow-hidden bg-shell-light",
              // Desktop: fills its side of the screen and never scrolls; the list beside it does.
              "lg:mt-4 lg:block lg:min-h-0 lg:rounded-[32px]",
              pane === "list" ? "max-lg:hidden" : "max-lg:min-h-0 max-lg:flex-1"
            )}
          >
            <div className="h-full">
              <MapBoundary>
                <MapPanel listings={listings} selectedId={selectedId} onSelect={selectFromMap} onMovePin={movePin} />
              </MapBoundary>
            </div>

            {/* Desktop: the selected place, bottom-left; the compare tray, bottom-right.
                With square map corners the card never runs under a curve, so its close button stays visible. */}
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
            {tray("absolute bottom-[30px] right-[18px] z-20 hidden lg:flex")}

            {/* Desktop map credit, on the frame rather than the map: the map's own bottom edge can be clipped. */}
            <p className="absolute bottom-1.5 right-5 z-10 hidden text-[11px] text-stone-700 lg:block">
              <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenFreeMap</a>{" "}
              <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer" className="hover:underline">© OpenMapTiles</a> Data from{" "}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenStreetMap</a>
            </p>

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

      {/* The fence footer closes pages that scroll as a whole: Status on desktop, the list on phones.
          Map and Rank on desktop end each pane with the same fine print instead. */}
      <div className={cn("hidden", tab === "status" && "lg:block", tab === "map" && pane === "list" && "max-lg:block")}>
        <FenceFooter note={footNote} className="mt-6 lg:mt-2" />
      </div>

      {/* Phones: List / Map / Status switch */}
      <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center lg:hidden">
        <div role="group" aria-label="View" className="inline-flex rounded-full bg-sea-800 p-1 shadow-lg">
          {(
            [
              { key: "list", label: "List", icon: List, active: tab === "map" && pane === "list" },
              { key: "map", label: "Map", icon: MapIcon, active: tab === "map" && pane === "map" },
              { key: "status", label: "Status", icon: SquareKanban, active: tab === "status" },
              { key: "rank", label: "Rank", icon: ListOrdered, active: tab === "rank" }
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={o.active}
              onClick={() => {
                if (o.key === "status" || o.key === "rank") setTab(o.key);
                else {
                  setTab("map");
                  setPane(o.key);
                }
              }}
              className={cn(
                "inline-flex h-11 items-center gap-1 rounded-full px-3 font-display text-[15px] transition min-[400px]:gap-1.5 min-[400px]:px-4",
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

      {settingsOpen && store.settings ? (
        <BoardSettingsDialog
          settings={store.settings}
          board={board}
          isDemo={isDemo}
          onClose={() => setSettingsOpen(false)}
          onChanged={() => {
            store
              .load()
              .then((s) => setSnap(s))
              .catch(() => {});
          }}
          onInvite={
            makeInviteLink
              ? () => {
                  setSettingsOpen(false);
                  setInviting(true);
                }
              : undefined
          }
          onGone={() => router.push("/boards")}
        />
      ) : null}

      {form?.mode === "add" ? (
        <AddPlaceFlow
          key={formKey}
          onClose={() => {
            setForm(null);
            setIncoming(null);
            if (afterAdd.current) setNotice(afterAdd.current);
            afterAdd.current = null;
          }}
          onSubmit={(input, files) => add(input, files)}
          onAnother={() => {
            setIncoming(null);
            openForm({ mode: "add" });
          }}
          incoming={incoming ?? undefined}
          canAddPhotos={photoCtx !== null}
          sampleScreenshot={isDemo ? "/samples/listing-screenshot.jpg" : undefined}
          streetPhotos={photos}
          people={groupSizeOf(board)}
          budgetPerPersonCents={board.budgetPerPersonCents}
        />
      ) : form ? (
        <ListingForm
          key={formKey}
          open
          listing={form.mode === "edit" ? form.listing : null}
          onClose={() => setForm(null)}
          onSubmit={async (input, files) => {
            if (form.mode === "edit") await saveEdit(form.listing.id, input);
            else await add(input, files);
          }}
          canAddPhotos={photoCtx !== null}
          onDelete={form.mode === "edit" ? remove : undefined}
          sampleScreenshot={isDemo ? "/samples/listing-screenshot.jpg" : undefined}
          streetPhotos={photos}
          people={groupSizeOf(board)}
          budgetPerPersonCents={board.budgetPerPersonCents}
        />
      ) : null}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-6">
        {notice ? (
          <p className="pointer-events-auto rounded-full bg-tar px-5 py-2.5 text-sm font-semibold text-shell shadow-lg">{notice}</p>
        ) : null}
      </div>
    </div>
    </TourPhotosContext.Provider>
  );
}

/** A listing sent to this board from /send, taken once (so a reload doesn't reopen it). */
function takeIncoming(boardId: string): SentPage | null {
  try {
    const raw = window.sessionStorage.getItem(INCOMING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Incoming;
    if (parsed.boardId !== boardId) return null;
    window.sessionStorage.removeItem(INCOMING_KEY);
    return readMessage({ type: "corral:page", page: parsed.page });
  } catch {
    return null;
  }
}

function SettingsButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Board settings"
      title="Board settings"
      className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-tar transition hover:bg-tar/10 lg:h-11 lg:w-11", className)}
    >
      <Settings className="h-[18px] w-[18px] lg:h-5 lg:w-5" strokeWidth={2.5} aria-hidden="true" />
    </button>
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
        <div className="h-[150px] lg:h-[72px]" />
      </Band>
      <div className="flex flex-1 items-center justify-center px-4 pb-24">
        <GateLoading />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRent, peopleLiving, totalRent } from "@/lib/compare";
import { centsToDollarsInput, parseDollars } from "@/lib/format";
import { ROOM_TYPES, type Listing, type Member, type RoomType, type Split } from "@/lib/listing";
import { defaultRoomTypes, ROOM_SIZE, shareRange, sharesByRoom } from "@/lib/split";
import { cn } from "@/lib/utils";
import { CREW } from "./status-style";

type Mode = "undecided" | "even" | "by_room" | "custom";
const MODES: [Mode, string][] = [
  ["undecided", "Not decided"],
  ["even", "Even"],
  ["by_room", "By room"],
  ["custom", "Custom"]
];
const ROOM_LABEL: Record<RoomType, string> = { single: "Single", double: "Double", triple: "Triple" };

/** "$1,350–$1,800 each", or "$1,200 each" when everyone pays the same. */
export function rangeText(lo: number, hi: number): string {
  return lo === hi ? `${formatRent(lo)} each` : `${formatRent(lo)}–${formatRent(hi)} each`;
}

/** The Split row on a place: what each person pays, and a way to change it. */
export function SplitRow({ listing, members, group, onSave }: { listing: Listing; members: Member[]; group: number | null; onSave: (split: Split | null) => Promise<boolean | void> }) {
  const [open, setOpen] = useState(false);
  const range = shareRange(listing, group);
  const people = peopleLiving(listing, group);
  if (!range || listing.priceBasis === "per_person") return null;
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-shell-mid px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="label block text-stone-700">Split · {range.decided ? `${people} people` : "not decided"}</span>
        <span className="mt-0.5 block font-display text-[17px] text-tar">{rangeText(range.lo, range.hi)}</span>
      </span>
      <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-bold text-sea-700 underline-offset-4 hover:underline">
        Change
      </button>
      {open ? <SplitEditor listing={listing} members={members} group={group} onSave={onSave} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

/**
 * How the group splits a place's rent. Not decided shows the range; Even,
 * By room (each room single, double or triple) and Custom set each person's
 * amount. Spots to fill get their own lines. Custom checks that it adds up.
 */
export function SplitEditor({
  listing,
  members,
  group,
  onSave,
  onClose
}: {
  listing: Listing;
  members: Member[];
  group: number | null;
  onSave: (split: Split | null) => Promise<boolean | void>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const people = peopleLiving(listing, group) ?? Math.max(1, members.length);
  const rent = totalRent(listing, group) ?? 0;
  const who = (i: number) => (i < members.length ? members[i]!.id : `spot-${i - members.length + 1}`);
  const whoOptions = [
    ...members.map((m) => ({ id: m.id, name: m.name })),
    ...Array.from({ length: Math.max(0, people - members.length) }, (_, i) => ({ id: `spot-${i + 1}`, name: `Spot to fill ${i + 1}` }))
  ];

  const [mode, setMode] = useState<Mode>(listing.split?.mode ?? "undecided");
  const [rooms, setRooms] = useState<RoomType[]>(listing.split?.rooms ?? defaultRoomTypes(people, listing.beds));
  const roomShares = sharesByRoom(rent, rooms.map((r) => ROOM_SIZE[r]));
  const roomOf = rooms.flatMap((r, i) => Array.from({ length: ROOM_SIZE[r] }, () => `Room ${i + 1}`));
  const [rows, setRows] = useState<{ who: string; amount: string }[]>(() => {
    const saved = listing.split?.shares;
    if (saved?.length) return saved.map((s) => ({ who: s.who, amount: centsToDollarsInput(s.cents) }));
    const each = Math.round(rent / people / 100) * 100;
    return Array.from({ length: people }, (_, i) => ({ who: who(i), amount: centsToDollarsInput(each) }));
  });
  const [roomWho, setRoomWho] = useState<string[]>(() => (listing.split?.mode === "by_room" ? (listing.split.shares ?? []).map((x) => x.who) : []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // By room: one line per spot in the rooms, amounts from the room setup.
  const roomRows = roomShares.map((cents, i) => ({ who: roomWho[i] ?? who(i), cents }));
  const customCents = rows.map((r) => parseDollars(r.amount));
  const customTotal = customCents.reduce<number>((a, b) => a + (Number.isNaN(b) || b === null ? 0 : b), 0);
  const range = shareRange({ ...listing, split: null }, group);

  async function save() {
    setError(null);
    let split: Split | null = null;
    if (mode === "even") split = { mode: "even" };
    if (mode === "by_room") {
      if (roomRows.length !== people) return setError(`These rooms fit ${roomRows.length}, but ${people} are living here. Change a room so everyone has a spot.`);
      split = { mode: "by_room", rooms, shares: roomRows.map((r) => ({ who: r.who, cents: r.cents })) };
    }
    if (mode === "custom") {
      if (customCents.some((c) => c === null || Number.isNaN(c))) return setError("Give everyone an amount, like 1350.");
      if (customTotal !== rent) return setError(`These add up to ${formatRent(customTotal)}, not ${formatRent(rent)}.`);
      split = { mode: "custom", shares: rows.map((r, i) => ({ who: r.who, cents: customCents[i] as number })) };
    }
    setSaving(true);
    const ok = await onSave(split);
    setSaving(false);
    if (ok !== false) ref.current?.close();
  }

  const whoSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 min-w-0 flex-1 rounded-full border border-divider bg-shell-light px-3 text-sm">
      {whoOptions.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
  const board = (whoId: string) => {
    const m = members.findIndex((x) => x.id === whoId);
    return (
      <span
        aria-hidden="true"
        className={cn("block h-6 w-3.5 shrink-0 rounded-t-full rounded-b-[2px]", m >= 0 ? CREW[m % CREW.length]!.bg : "border-[1.5px] border-dashed border-sunset-600")}
      />
    );
  };

  return (
    <dialog
      ref={ref}
      onClose={(e) => {
        e.stopPropagation();
        onClose();
      }}
      aria-labelledby={`${id}-title`}
      className="mb-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[30px] bg-shell p-0 text-tar shadow-lift backdrop:bg-tar/40 sm:m-auto sm:w-[min(40rem,calc(100vw-2rem))] sm:rounded-[30px]"
    >
      <div className="space-y-4 p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <h2 id={`${id}-title`} className="min-w-0 flex-1 font-display text-[24px] leading-tight">
            How you&apos;ll split {formatRent(rent)}
          </h2>
          <span className="pt-1.5 text-sm text-stone-700">{people} people</span>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-shell-deep hover:bg-shell-mid">
            <X className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
          </button>
        </div>

        <div role="radiogroup" aria-label="How to split" className="flex flex-wrap gap-1.5">
          {MODES.map(([m, label]) => (
            <label
              key={m}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center rounded-full px-3.5 text-[13px] transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
                mode === m ? "bg-sea-800 font-semibold text-shell" : "border border-divider bg-shell-light hover:bg-shell-mid"
              )}
            >
              <input type="radio" name={`${id}-mode`} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>

        {mode === "undecided" ? (
          <p className="rounded-[16px] bg-shell-light p-4 text-sm text-stone-800">
            {range ? <span className="font-display text-[18px] text-tar">{rangeText(range.lo, range.hi)}</span> : null}
            <span className="mt-1 block">From a spot in a shared room up to a room of your own. Decide whenever you&apos;re ready.</span>
          </p>
        ) : null}

        {mode === "even" ? (
          <p className="rounded-[16px] bg-shell-light p-4 text-sm text-stone-800">
            <span className="font-display text-[18px] text-tar">{formatRent(Math.ceil(rent / people))} each</span> for all {people}.
          </p>
        ) : null}

        {mode === "by_room" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="label text-stone-700">Rooms</p>
              {rooms.map((r, i) => (
                <div key={i} role="radiogroup" aria-label={`Room ${i + 1}`} className="flex items-center gap-1.5">
                  <span className="w-16 text-sm font-semibold">Room {i + 1}</span>
                  {ROOM_TYPES.map((t) => (
                    <label
                      key={t}
                      className={cn(
                        "inline-flex h-8 cursor-pointer items-center rounded-full px-2.5 text-[12px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
                        r === t ? "bg-sea-800 font-semibold text-shell" : "border border-divider bg-shell-light"
                      )}
                    >
                      <input type="radio" name={`${id}-room-${i}`} checked={r === t} onChange={() => setRooms((list) => list.map((x, j) => (j === i ? t : x)))} className="sr-only" />
                      {ROOM_LABEL[t]}
                    </label>
                  ))}
                </div>
              ))}
              <p className="text-xs text-stone-700">
                {roomRows.length === people ? "A single pays more than a spot in a shared room." : `These rooms fit ${roomRows.length}; ${people} are living here.`}
              </p>
            </div>
            <div className="space-y-2">
              <p className="label text-stone-700">Who pays what</p>
              {roomRows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  {board(r.who)}
                  {whoSelect(
                    r.who,
                    (v) =>
                      setRoomWho((list) => {
                        const next = [...list];
                        next[i] = v;
                        return next;
                      }),
                    `Who's in ${roomOf[i]} (spot ${i + 1})`
                  )}
                  <span className="w-20 text-right font-display text-[16px]">{formatRent(r.cents)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {mode === "custom" ? (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                {board(r.who)}
                {whoSelect(r.who, (v) => setRows((list) => list.map((x, j) => (j === i ? { ...x, who: v } : x))), `Person ${i + 1}`)}
                <span className="font-display text-stone-700">$</span>
                <input
                  aria-label={`Amount for person ${i + 1}`}
                  inputMode="decimal"
                  value={r.amount}
                  onChange={(e) => setRows((list) => list.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                  className="h-9 w-24 rounded-full border border-divider bg-shell-light px-3 font-display text-[16px]"
                />
              </div>
            ))}
            <p className={cn("flex justify-between border-t-[1.5px] border-dashed border-stone-400 pt-2 text-sm", customTotal === rent ? "text-glass-800" : "text-sunset-800")}>
              <span>Adds up to</span>
              <b className="font-display text-[16px]">
                {formatRent(customTotal)} {customTotal === rent ? "✓" : `of ${formatRent(rent)}`}
              </b>
            </p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => ref.current?.close()}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            Save split
          </Button>
        </div>
      </div>
    </dialog>
  );
}

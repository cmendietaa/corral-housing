"use client";

import { useId, useState } from "react";
import { CrewPill } from "@/components/brand/band";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDueShort } from "@/lib/format";
import type { Listing, ListingPatch, Member } from "@/lib/listing";
import { cn } from "@/lib/utils";
import { CREW } from "./status-style";

/** "Maya · Fri" (rendered in caps by the .label style), or null when nothing is assigned or due. */
export function ownerDue(listing: Pick<Listing, "nextActionAssignee" | "nextActionDue">, members: Member[]) {
  const owner = members.find((m) => m.id === listing.nextActionAssignee);
  const due = listing.nextActionDue ? formatDueShort(listing.nextActionDue) : null;
  const text = [owner?.name, due?.text].filter(Boolean).join(" · ");
  return text ? { text, overdue: Boolean(due?.overdue), owner } : null;
}

type Props = {
  listing: Listing;
  members: Member[];
  onSave: (patch: ListingPatch) => Promise<boolean | void> | void;
  /** `inline`: "NEXT" beside the task, with "MAYA · FRI" under it (selected-place card). `crew`: owner's board beside the task (Status cards, phone sheet). */
  variant?: "inline" | "crew";
  className?: string;
};

export function NextAction({ listing, members, onSave, variant = "inline", className }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <NextActionEditor
        listing={listing}
        members={members}
        onCancel={() => setEditing(false)}
        onSave={async (patch) => {
          // If it didn't save, keep the editor (and what they typed) open.
          if ((await onSave(patch)) !== false) setEditing(false);
        }}
      />
    );
  }

  if (!listing.nextAction) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Add a next step for ${listing.title}`}
        className={cn(
          "flex w-full items-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-stone-500 px-4 py-3 text-left text-sm text-stone-700 transition hover:bg-shell-mid",
          className
        )}
      >
        <span className="label text-stone-700">Next</span>
        Add a next step
      </button>
    );
  }

  const od = ownerDue(listing, members);
  const ownerIndex = members.findIndex((m) => m.id === listing.nextActionAssignee);

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`Edit next step: ${listing.nextAction}${od ? `, ${od.text}` : ""}`}
      className={cn(
        "flex w-full items-center gap-3 rounded-[20px] bg-shell-mid px-4 py-3 text-left transition hover:bg-shell-deep",
        className
      )}
    >
      {variant === "inline" ? (
        <>
          <span className="label shrink-0 text-stone-700">Next</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm leading-snug text-tar">{listing.nextAction}</span>
            {od ? (
              <span className={cn("label mt-0.5 block", od.overdue ? "text-danger" : "text-stone-700")}>{od.text}</span>
            ) : null}
          </span>
        </>
      ) : (
        <>
          {ownerIndex >= 0 ? <CrewPill name={members[ownerIndex].name} index={ownerIndex} size="xs" /> : null}
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] leading-snug text-tar">{listing.nextAction}</span>
            {od ? (
              <span className={cn("label mt-0.5 block", od.overdue ? "text-danger" : "text-stone-700")}>{od.text}</span>
            ) : null}
          </span>
        </>
      )}
    </button>
  );
}

function NextActionEditor({
  listing,
  members,
  onSave,
  onCancel
}: {
  listing: Listing;
  members: Member[];
  onSave: (patch: ListingPatch) => Promise<boolean | void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [text, setText] = useState(listing.nextAction ?? "");
  const [assignee, setAssignee] = useState(listing.nextActionAssignee ?? "");
  const [due, setDue] = useState(listing.nextActionDue ?? "");
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const dayChips = upcomingDays();
  // A saved date that isn't one of the chips shows as "Pick a date".
  const dueChoice = picking ? "pick" : dayChips.some((c) => c.value === due) ? due : due ? "pick" : "";

  async function submit(patch: ListingPatch) {
    setSaving(true);
    try {
      await onSave(patch);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="w-full space-y-2.5 rounded-[20px] bg-shell-mid p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const description = text.trim();
        void submit({
          nextAction: description || null,
          nextActionAssignee: description ? assignee || null : null,
          nextActionDue: description ? due || null : null
        });
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <label htmlFor={`${id}-text`} className="label block text-stone-700">
        Next step
      </label>
      <Input
        id={`${id}-text`}
        autoFocus
        value={text}
        maxLength={200}
        placeholder="e.g. Ask whether parking is included"
        onChange={(e) => setText(e.target.value)}
      />
      {/* Who: tap a roommate's board (the chosen one stands taller). */}
      <div role="radiogroup" aria-label="Who" className="flex flex-wrap items-end gap-2.5 pt-1">
        {[{ id: "", name: "Unassigned" }, ...members].map((m, i) => {
          const on = assignee === m.id;
          const crew = m.id ? CREW[(i - 1) % CREW.length]! : null;
          return (
            <label key={m.id || "none"} className="flex cursor-pointer flex-col items-center gap-1 has-[:focus-visible]:[&>span:first-of-type]:ring-2 has-[:focus-visible]:[&>span:first-of-type]:ring-focus">
              <input type="radio" name={`${id}-who`} value={m.id} checked={on} onChange={() => setAssignee(m.id)} className="sr-only" />
              <span
                aria-hidden="true"
                className={cn(
                  "flex w-8 justify-center rounded-t-full rounded-b-[6px] pt-1.5 font-display text-[13px] transition-[height]",
                  crew ? cn(crew.bg, crew.fg) : "border-2 border-dashed border-stone-500 text-stone-700",
                  on ? "h-14 ring-2 ring-tar ring-offset-2 ring-offset-shell-mid" : "h-10"
                )}
              >
                {crew ? m.name[0] : ""}
              </span>
              <span className={cn("max-w-[64px] truncate text-[11px]", on ? "font-bold text-tar" : "text-stone-800")}>{m.name}</span>
            </label>
          );
        })}
      </div>

      {/* By: the usual days as chips; "Pick a date" for anything else. */}
      <div role="radiogroup" aria-label="By" className="flex flex-wrap gap-1.5">
        {dayChips.map((c) => (
          <label
            key={c.label}
            className={cn(
              "inline-flex h-9 cursor-pointer items-center rounded-full px-3 text-[13px] transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
              dueChoice === c.value ? "bg-sea-800 font-semibold text-shell" : "border border-divider bg-shell-light text-tar hover:bg-shell"
            )}
          >
            <input
              type="radio"
              name={`${id}-by`}
              checked={dueChoice === c.value}
              onChange={() => {
                setPicking(c.value === "pick");
                if (c.value !== "pick") setDue(c.value);
              }}
              className="sr-only"
            />
            {c.label}
          </label>
        ))}
      </div>
      {dueChoice === "pick" ? (
        <div>
          <label htmlFor={`${id}-due`} className="sr-only">
            Due date
          </label>
          <Input id={`${id}-due`} type="date" value={due} onChange={(e) => setDue(e.target.value)} className="px-3" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving}>
          Save next step
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        {listing.nextAction ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto"
            disabled={saving}
            onClick={() => void submit({ nextAction: null, nextActionAssignee: null, nextActionDue: null })}
          >
            Mark done
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** "No date", Today, Tomorrow, the next two weekdays by name, and "Pick a date". Values are local yyyy-mm-dd. */
function upcomingDays(): { label: string; value: string }[] {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
  };
  const weekday = (d: Date) => new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
  return [
    { label: "No date", value: "" },
    { label: "Today", value: iso(day(0)) },
    { label: "Tomorrow", value: iso(day(1)) },
    { label: weekday(day(2)), value: iso(day(2)) },
    { label: weekday(day(3)), value: iso(day(3)) },
    { label: "Pick a date", value: "pick" }
  ];
}

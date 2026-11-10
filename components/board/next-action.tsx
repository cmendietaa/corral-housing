"use client";

import { useId, useState } from "react";
import { CrewPill } from "@/components/brand/band";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDueShort } from "@/lib/format";
import type { Listing, ListingPatch, Member } from "@/lib/listing";
import { cn } from "@/lib/utils";

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
  onSave: (patch: ListingPatch) => Promise<void> | void;
  /** `inline`: "NEXT  task  MAYA · FRI" in one box (selected-place card). `crew`: owner's board beside the task (Status cards, phone sheet). */
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
          await onSave(patch);
          setEditing(false);
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
          <span className="min-w-0 flex-1 text-sm leading-snug text-tar">{listing.nextAction}</span>
          {od ? <span className={cn("label shrink-0", od.overdue ? "text-danger" : "text-tar")}>{od.text}</span> : null}
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
  onSave: (patch: ListingPatch) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [text, setText] = useState(listing.nextAction ?? "");
  const [assignee, setAssignee] = useState(listing.nextActionAssignee ?? "");
  const [due, setDue] = useState(listing.nextActionDue ?? "");
  const [saving, setSaving] = useState(false);

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
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${id}-who`} className="label text-stone-700">
            Who
          </label>
          <select
            id={`${id}-who`}
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="mt-1 h-11 w-full rounded-full border border-divider bg-shell-light px-3 text-sm"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-due`} className="label text-stone-700">
            By
          </label>
          <Input id={`${id}-due`} type="date" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1 px-3" />
        </div>
      </div>
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

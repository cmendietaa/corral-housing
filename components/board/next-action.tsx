"use client";

import { useId, useState } from "react";
import { CalendarClock, Pencil, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDue, isOverdue } from "@/lib/format";
import type { Listing, ListingPatch, Member } from "@/lib/listing";
import { cn } from "@/lib/utils";

type Props = {
  listing: Listing;
  members: Member[];
  onSave: (patch: ListingPatch) => Promise<void> | void;
};

export function NextAction({ listing, members, onSave }: Props) {
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
        className="flex w-full items-center gap-2 rounded-sm border border-dashed border-line px-3 py-2 text-left text-sm text-muted transition hover:border-ocean/40 hover:text-ocean focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add a next step
      </button>
    );
  }

  const assignee = members.find((m) => m.id === listing.nextActionAssignee);
  const overdue = listing.nextActionDue ? isOverdue(listing.nextActionDue) : false;

  return (
    <div className="flex items-start gap-3 rounded-sm bg-sand px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{listing.nextAction}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            {assignee ? assignee.name : "Unassigned"}
          </span>
          {listing.nextActionDue ? (
            <span className={cn("inline-flex items-center gap-1", overdue && "font-semibold text-danger")}>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {overdue ? "Overdue · " : "Due "}
              {formatDue(listing.nextActionDue)}
            </span>
          ) : null}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Edit next step for ${listing.title}`}
        className="-mr-1 rounded-full p-1.5 text-muted transition hover:bg-sand-deep hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
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
      className="space-y-2 rounded-sm border border-line bg-sand p-3"
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
      <label htmlFor={`${id}-text`} className="text-xs font-semibold text-muted">
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
          <label htmlFor={`${id}-who`} className="text-xs font-semibold text-muted">
            Who
          </label>
          <select
            id={`${id}-who`}
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="mt-1 h-11 w-full rounded-sm border border-line bg-surface px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
          <label htmlFor={`${id}-due`} className="text-xs font-semibold text-muted">
            By
          </label>
          <Input
            id={`${id}-due`}
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="mt-1 px-2"
          />
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
            className="ml-auto text-danger hover:text-danger"
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

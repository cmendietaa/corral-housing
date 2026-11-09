"use client";

import { useId, useState } from "react";
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

/** One line in a ledger row: "Next  Ask whether parking is included — Maya, by Fri, Nov 13". */
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
        aria-label={`Add a next step for ${listing.title}`}
        className="rounded-sm text-sm font-medium text-ocean underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Add a next step
      </button>
    );
  }

  const assignee = members.find((m) => m.id === listing.nextActionAssignee);
  const overdue = listing.nextActionDue ? isOverdue(listing.nextActionDue) : false;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`Edit next step for ${listing.title}: ${listing.nextAction}`}
      className="group/next flex min-w-0 max-w-full items-baseline gap-2 rounded-sm text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span className="shrink-0 font-semibold text-ocean">Next</span>
      <span className="min-w-0">
        <span className="text-ink group-hover/next:underline group-hover/next:underline-offset-4">
          {listing.nextAction}
        </span>
        <span className="text-muted">
          {" "}
          — {assignee ? assignee.name : "unassigned"}
          {listing.nextActionDue ? (
            <span className={cn(overdue && "font-semibold text-danger")}>
              , {overdue ? "overdue since" : "by"} {formatDue(listing.nextActionDue)}
            </span>
          ) : null}
        </span>
      </span>
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
      className="w-full space-y-2 rounded-md border border-line bg-sand p-3"
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

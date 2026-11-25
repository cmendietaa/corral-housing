"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, Crown, Link2, UserPlus, X } from "lucide-react";
import { CrewPill } from "@/components/brand/band";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { centsToDollarsInput, parseDollars } from "@/lib/format";
import { boardDetailsSchema, displayNameSchema, type Board } from "@/lib/listing";
import type { BoardSettings, MemberInfo, SettingsSnapshot } from "@/lib/stores/types";
import { cn } from "@/lib/utils";
import { SendSetup } from "./send-setup";

type Confirm = { kind: "remove" | "owner"; member: MemberInfo } | { kind: "leave" } | { kind: "delete" } | null;

/**
 * Board settings: the board's details, your name, the roommates on it, open
 * invite links, and leaving or deleting. A sheet on phones, a dialog on desktop.
 * Every rule (only the owner edits details or removes people, the owner can't
 * leave) is enforced by the database; the screen only hides what won't work.
 */
export function BoardSettingsDialog({
  settings,
  board,
  isDemo,
  onClose,
  onChanged,
  onInvite,
  onGone
}: {
  settings: BoardSettings;
  board: Board;
  isDemo: boolean;
  onClose: () => void;
  /** Reload the board after a change (name, budget, members). */
  onChanged: () => void;
  /** Open the invite dialog. */
  onInvite?: () => void;
  /** You left or deleted the board. */
  onGone: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [snap, setSnap] = useState<SettingsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const refresh = useCallback(async () => {
    try {
      setSnap(await settings.load());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the settings.");
    }
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    settings
      .load()
      .then((s) => !cancelled && setSnap(s))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load the settings."));
    return () => {
      cancelled = true;
    };
  }, [settings]);

  /** Runs one change, then refreshes the settings and the board. */
  async function run(action: () => Promise<void>, after?: () => void): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      setConfirm(null);
      if (after) {
        after();
        return true;
      }
      await refresh();
      onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const me = snap?.members.find((m) => m.isMe) ?? null;
  const owner = snap?.members.find((m) => m.role === "owner") ?? null;
  const iOwn = me?.role === "owner";
  const nameOf = (id: string | null) => snap?.members.find((m) => m.id === id)?.name ?? "A roommate";

  return (
    <dialog
      ref={ref}
      onClose={(e) => {
        e.stopPropagation();
        onClose();
      }}
      aria-labelledby="settings-title"
      className={cn(
        "bg-shell-deep p-0 text-tar shadow-lg backdrop:bg-tar/40",
        // Phones: a sheet from the bottom. Desktop: a centered dialog.
        "mb-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-[32px]",
        "sm:m-auto sm:max-h-[min(860px,calc(100dvh-4rem))] sm:w-[min(36rem,calc(100vw-2rem))] sm:rounded-[32px]"
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-shell-deep px-5 pb-3 pt-5 sm:px-6">
        <h2 id="settings-title" className="font-display text-2xl">
          Board settings
        </h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close settings"
          className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-shell-mid"
        >
          <X className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-4 px-5 pb-6 sm:px-6">
        {error ? (
          <p role="alert" className="rounded-[18px] bg-sunset-100 px-4 py-2.5 text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}

        {!snap ? (
          error ? null : <p className="px-1 py-6 text-sm text-stone-700">Loading…</p>
        ) : (
          <>
            <DetailsSection
              board={board}
              canEdit={snap.canEditBoard}
              ownerName={owner?.name ?? null}
              onSave={(d) => run(() => settings.updateBoard(d))}
              busy={busy}
            />

            {me && settings.renameMe ? (
              <Section title="Your name" hint="How you show up on this board: on next steps, photos and the crew boards.">
                <NameForm key={me.name} current={me.name} busy={busy} onSave={(n) => run(() => settings.renameMe!(n))} />
              </Section>
            ) : null}

            <Section
              title={`Roommates · ${snap.members.length}`}
              hint={
                isDemo
                  ? "The demo's roommates are fictional. On your own board, the owner can remove people or hand the board to someone else."
                  : iOwn
                    ? "You're the owner: you can remove people and hand the board to someone else."
                    : `${owner?.name ?? "The owner"} is the owner and can remove people.`
              }
            >
              <ul className="-my-1 divide-y divide-divider">
                {snap.members.map((m, i) => (
                  <li key={m.id} className="py-2.5">
                    <div className="flex items-center gap-3">
                      <CrewPill name={m.name} index={i} size="xs" />
                      <p className="min-w-0 flex-1 truncate text-sm text-tar">
                        <span className="font-semibold">{m.name}</span>
                        {m.isMe ? <span className="text-stone-700"> (you)</span> : null}
                      </p>
                      {m.role === "owner" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sunset-100 px-2.5 py-1 text-xs font-semibold text-tar">
                          <Crown className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                          Owner
                        </span>
                      ) : null}
                      {iOwn && !m.isMe && m.role !== "owner" ? (
                        <span className="flex shrink-0 gap-1">
                          {settings.makeOwner ? (
                            <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "owner", member: m })} aria-label={`Make ${m.name} the owner`}>
                              Make owner
                            </Button>
                          ) : null}
                          {settings.removeMember ? (
                            <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "remove", member: m })} aria-label={`Remove ${m.name}`} className="text-danger hover:text-danger">
                              Remove
                            </Button>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                    {confirm && "member" in confirm && confirm.member.id === m.id ? (
                      <ConfirmBox
                        busy={busy}
                        danger={confirm.kind === "remove"}
                        action={confirm.kind === "remove" ? `Remove ${m.name}` : `Make ${m.name} the owner`}
                        onCancel={() => setConfirm(null)}
                        onConfirm={() =>
                          run(() => (confirm.kind === "remove" ? settings.removeMember!(m.id) : settings.makeOwner!(m.id)))
                        }
                      >
                        {confirm.kind === "remove"
                          ? `${m.name} loses access right away. Their next steps become unassigned and invite links they made stop working. Places and photos they added stay.`
                          : `${m.name} becomes the owner and you become a regular roommate. Only they can undo this.`}
                      </ConfirmBox>
                    ) : null}
                  </li>
                ))}
              </ul>
              {onInvite ? (
                <Button variant="secondary" size="sm" className="mt-3" onClick={onInvite}>
                  <UserPlus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                  Invite someone
                </Button>
              ) : null}
            </Section>

            <Section title="Send to Corral" hint="Add a listing from any site in one tap, rent included. Pasting a link still works.">
              <SendSetup />
            </Section>

            {settings.revokeInvite && snap.invites.length > 0 ? (
              <Section title={`Open invite links · ${snap.invites.length}`} hint="Anyone with one of these links can join. Turn off any you didn't mean to share.">
                <ul className="-my-1 divide-y divide-divider">
                  {snap.invites.map((inv) => (
                    <li key={inv.token} className="flex items-center gap-3 py-2.5">
                      <Link2 className="h-4 w-4 shrink-0 text-stone-700" strokeWidth={2.5} aria-hidden="true" />
                      <p className="min-w-0 flex-1 text-sm text-tar">
                        Made by {snap.members.find((m) => m.id === inv.createdBy)?.isMe ? "you" : nameOf(inv.createdBy)}
                        <span className="block text-xs text-stone-700">Works until {formatDay(inv.expiresAt)}</span>
                      </p>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => settings.revokeInvite!(inv.token))}>
                        Turn off
                      </Button>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {me && (settings.leave || settings.deleteBoard) ? (
              <Section title={iOwn ? "Delete this board" : "Leave this board"} tone="danger">
                {iOwn ? (
                  <>
                    <p className="text-sm text-stone-800">
                      Deletes every place, note and photo on this board for everyone. This can&apos;t be undone.
                      {snap.members.length > 1 ? " To leave but keep the board going, make someone else the owner first." : ""}
                    </p>
                    {confirm?.kind === "delete" ? (
                      <DeleteConfirm
                        boardName={board.name}
                        busy={busy}
                        onCancel={() => setConfirm(null)}
                        onConfirm={() => run(() => settings.deleteBoard!(), onGone)}
                      />
                    ) : (
                      <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirm({ kind: "delete" })}>
                        Delete board…
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-stone-800">You&apos;ll stop seeing this board. Places and photos you added stay for everyone else.</p>
                    {confirm?.kind === "leave" ? (
                      <ConfirmBox
                        busy={busy}
                        danger
                        action="Leave board"
                        onCancel={() => setConfirm(null)}
                        onConfirm={() => run(() => settings.leave!(), onGone)}
                      >
                        To come back, you&apos;ll need a new invite link from a roommate.
                      </ConfirmBox>
                    ) : (
                      <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirm({ kind: "leave" })}>
                        Leave board…
                      </Button>
                    )}
                  </>
                )}
              </Section>
            ) : null}
          </>
        )}
      </div>
    </dialog>
  );
}

function Section({ title, hint, tone, children }: { title: string; hint?: string; tone?: "danger"; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("rounded-[24px] p-4", tone === "danger" ? "bg-shell ring-1 ring-inset ring-danger/25" : "bg-shell")}>
      <h3 id={id} className="font-display text-[17px] text-tar">
        {title}
      </h3>
      {hint ? <p className="mt-0.5 text-xs text-stone-700">{hint}</p> : null}
      <div className={hint ? "mt-3" : "mt-2"}>{children}</div>
    </section>
  );
}

function DetailsSection({
  board,
  canEdit,
  ownerName,
  busy,
  onSave
}: {
  board: Board;
  canEdit: boolean;
  ownerName: string | null;
  busy: boolean;
  onSave: (d: { name: string; leaseYear: string; budgetPerPersonCents: number | null }) => Promise<boolean>;
}) {
  const id = useId();
  const [name, setName] = useState(board.name);
  const [leaseYear, setLeaseYear] = useState(board.leaseYear);
  const [budget, setBudget] = useState(centsToDollarsInput(board.budgetPerPersonCents));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = name !== board.name || leaseYear !== board.leaseYear || budget !== centsToDollarsInput(board.budgetPerPersonCents);

  if (!canEdit) {
    return (
      <Section title="Board" hint={`Only ${ownerName ?? "the owner"} can change these.`}>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-stone-700">Name</dt>
          <dd className="font-semibold">{board.name}</dd>
          <dt className="text-stone-700">Lease year</dt>
          <dd>{board.leaseYear || "Not set"}</dd>
          <dt className="text-stone-700">Budget</dt>
          <dd>{board.budgetPerPersonCents === null ? "Not set" : `$${centsToDollarsInput(board.budgetPerPersonCents)} per person`}</dd>
        </dl>
      </Section>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseDollars(budget);
    if (Number.isNaN(cents)) return setError("Enter the budget as a number, like 1400.");
    const parsed = boardDetailsSchema.safeParse({ name, leaseYear, budgetPerPersonCents: cents });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check these and try again.");
    setError(null);
    if (!(await onSave(parsed.data))) return;
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Section title="Board">
      <form onSubmit={(e) => void submit(e)} className="space-y-3" noValidate>
        <div>
          <label htmlFor={`${id}-name`} className="text-[13px] font-semibold">
            Board name
          </label>
          <Input id={`${id}-name`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor={`${id}-lease`} className="text-[13px] font-semibold">
              Lease year
            </label>
            <Input id={`${id}-lease`} value={leaseYear} maxLength={20} placeholder="2027–28" onChange={(e) => setLeaseYear(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor={`${id}-budget`} className="text-[13px] font-semibold">
              Budget per person
            </label>
            <div className="relative mt-1.5">
              <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-stone-700">
                $
              </span>
              <Input id={`${id}-budget`} inputMode="numeric" value={budget} placeholder="No budget" onChange={(e) => setBudget(e.target.value)} className="pl-8" />
            </div>
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={!dirty || busy}>
            Save changes
          </Button>
          {saved ? (
            <span role="status" className="inline-flex items-center gap-1 text-sm font-semibold text-sea-900">
              <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
              Saved
            </span>
          ) : null}
        </div>
      </form>
    </Section>
  );
}

function NameForm({ current, busy, onSave }: { current: string; busy: boolean; onSave: (name: string) => Promise<boolean> }) {
  const id = useId();
  const [name, setName] = useState(current);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check your name.");
    setError(null);
    await onSave(parsed.data);
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-2" noValidate>
      <label htmlFor={`${id}-me`} className="sr-only">
        Your name
      </label>
      <div className="flex gap-2">
        <Input id={`${id}-me`} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1" />
        <Button type="submit" size="md" variant="secondary" disabled={busy || name.trim() === current}>
          Save
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function ConfirmBox({
  action,
  danger,
  busy,
  children,
  onConfirm,
  onCancel
}: {
  action: string;
  danger?: boolean;
  busy: boolean;
  children: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2.5 rounded-[18px] bg-shell-mid p-3.5">
      <p className="text-sm text-stone-800">{children}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant={danger ? "danger" : "sea"} disabled={busy} onClick={onConfirm}>
          {action}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Deleting a whole board asks for its name, so it can't happen by a stray tap. */
function DeleteConfirm({ boardName, busy, onConfirm, onCancel }: { boardName: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const id = useId();
  const [typed, setTyped] = useState("");
  const match = typed.trim().toLowerCase() === boardName.trim().toLowerCase();
  return (
    <div className="mt-3 rounded-[18px] bg-shell-mid p-3.5">
      <label htmlFor={`${id}-confirm`} className="text-sm text-stone-800">
        Type <span className="font-semibold text-tar">{boardName}</span> to confirm.
      </label>
      <Input id={`${id}-confirm`} value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} className="mt-2" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="danger" disabled={!match || busy} onClick={onConfirm}>
          Delete board forever
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

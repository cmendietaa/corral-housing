"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, UserPlus, X } from "lucide-react";
import { LassoIcon } from "@/components/brand/motifs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { centsToDollarsInput, parseDollars } from "@/lib/format";
import { boardDetailsSchema, displayNameSchema, type Board } from "@/lib/listing";
import type { BoardSettings, MemberInfo, SettingsSnapshot } from "@/lib/stores/types";
import { cn } from "@/lib/utils";
import { SendSetup } from "./send-setup";
import { CREW } from "./status-style";

/** Slightly uneven, like a real fence. */
const BOARD_HEIGHTS = ["h-[92px]", "h-[84px]", "h-[88px]", "h-20"] as const;

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

  const [picked, setPicked] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const pickedMember = snap?.members.find((m) => m.id === picked) ?? null;

  return (
    <dialog
      ref={ref}
      onClose={(e) => {
        e.stopPropagation();
        onClose();
      }}
      aria-labelledby="settings-title"
      className={cn(
        "bg-shell p-0 text-tar shadow-lg backdrop:bg-tar/40",
        // Phones: a sheet from the bottom. Desktop: a centered dialog.
        "mb-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-[32px]",
        "sm:m-auto sm:max-h-[min(880px,calc(100dvh-4rem))] sm:w-[min(40rem,calc(100vw-2rem))] sm:rounded-[34px]"
      )}
    >
      {/* The board's own band: its name over the sunset, the stripe and the wave. */}
      <div className="relative overflow-hidden bg-sunset-300 px-5 pt-5 sm:px-7">
        <span aria-hidden="true" className="absolute -bottom-10 right-24 h-24 w-24 rounded-full bg-sunset-200" />
        <div className="relative flex items-start gap-4 pb-4">
          <div className="min-w-0 flex-1">
            <h2 id="settings-title" className="text-xs font-bold uppercase tracking-[0.12em] text-sunset-800">
              Board settings
            </h2>
            <p className="mt-1 font-display text-[28px] leading-tight text-tar">{board.name}</p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close settings"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-shell-light hover:bg-shell"
          >
            <X className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
          </button>
        </div>
        <div aria-hidden="true" className="-mx-7 h-[5px] bg-sunset-400" />
        <div aria-hidden="true" className="-mx-7 h-[5px] bg-sunset-500" />
        <div aria-hidden="true" className="-mx-7 h-1.5 bg-sea-500" />
      </div>
      <div aria-hidden="true" className="h-4" style={{ background: "radial-gradient(circle at 50% 0, var(--color-sea-500) 12px, transparent 13px) -2px 0 / 26px 16px repeat-x" }} />

      <div className="space-y-6 px-5 pb-2 pt-2 sm:px-7">
        {error ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}

        {!snap ? (
          error ? null : <p className="px-1 py-6 text-sm text-stone-700">Opening the gate…</p>
        ) : (
          <>
            <DetailsSection
              board={board}
              canEdit={snap.canEditBoard}
              ownerName={owner?.name ?? null}
              onSave={(d) => run(() => settings.updateBoard(d))}
              busy={busy}
            />

            <section aria-labelledby="crew-title">
              <h3 id="crew-title" className="font-display text-[22px] text-tar">
                The crew <span className="font-sans text-sm text-stone-700">· {snap.members.length}</span>
              </h3>
              {/* Each roommate is a fence board in their color; the owner has the sun behind them. */}
              <ul className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3 pl-2 pt-5">
                {snap.members.map((m, i) => {
                  const c = CREW[i % CREW.length]!;
                  const selectable = m.isMe ? Boolean(settings.renameMe) : iOwn && m.role !== "owner";
                  const on = picked === m.id;
                  const boardEl = (
                    <>
                      {m.role === "owner" ? <span aria-hidden="true" className="absolute -top-6 left-1/2 h-[76px] w-[76px] -translate-x-1/2 rounded-full bg-sunset-200" /> : null}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "relative flex w-12 justify-center rounded-t-full rounded-b-[9px] pt-2.5 font-display text-lg",
                          c.bg,
                          c.fg,
                          BOARD_HEIGHTS[i % BOARD_HEIGHTS.length],
                          on && "ring-2 ring-tar ring-offset-2 ring-offset-shell"
                        )}
                      >
                        {m.name[0]}
                      </span>
                      <span className="relative mt-1.5 block max-w-[84px] truncate text-sm font-bold text-tar">
                        {m.name}
                        {m.isMe ? <span className="font-normal text-stone-700"> (you)</span> : null}
                      </span>
                      <span className="relative block h-4 text-xs text-stone-700">{m.role === "owner" ? "Owner" : ""}</span>
                    </>
                  );
                  return (
                    <li key={m.id} className="relative flex flex-col items-center">
                      {selectable ? (
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={m.isMe ? "Change your name" : `${m.name}: roommate options`}
                          onClick={() => {
                            setPicked(on ? null : m.id);
                            setConfirm(null);
                          }}
                          className="relative flex flex-col items-center rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
                        >
                          {boardEl}
                        </button>
                      ) : (
                        <div className="relative flex flex-col items-center">{boardEl}</div>
                      )}
                    </li>
                  );
                })}
                {onInvite ? (
                  <li className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={onInvite}
                      className="flex flex-col items-center rounded-[14px] text-sunset-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
                    >
                      <span aria-hidden="true" className="flex h-20 w-12 items-center justify-center rounded-t-full rounded-b-[9px] border-2 border-dashed border-sunset-600">
                        <UserPlus className="h-5 w-5" strokeWidth={2.5} />
                      </span>
                      <span className="mt-1.5 text-sm font-bold">Invite</span>
                      <span className="h-4" />
                    </button>
                  </li>
                ) : null}
              </ul>

              {pickedMember?.isMe && settings.renameMe ? (
                <div className="mt-3 rounded-[20px] bg-shell-light p-3.5">
                  <NameForm key={pickedMember.name} current={pickedMember.name} busy={busy} onSave={(n) => run(() => settings.renameMe!(n))} />
                </div>
              ) : null}
              {pickedMember && !pickedMember.isMe && iOwn ? (
                <div className="mt-3 rounded-[20px] bg-shell-light p-3.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <p className="min-w-0 flex-1 font-display text-[17px] text-tar">{pickedMember.name}</p>
                    {settings.makeOwner ? (
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "owner", member: pickedMember })}
                        aria-label={`Make ${pickedMember.name} the owner`}
                        className="text-sm font-bold text-sea-700"
                      >
                        Hand the board to {pickedMember.name}
                      </button>
                    ) : null}
                    {settings.removeMember ? (
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "remove", member: pickedMember })}
                        aria-label={`Remove ${pickedMember.name}`}
                        className="text-sm font-bold text-danger"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {confirm && "member" in confirm && confirm.member.id === pickedMember.id ? (
                    <ConfirmBox
                      busy={busy}
                      danger={confirm.kind === "remove"}
                      action={confirm.kind === "remove" ? `Remove ${pickedMember.name}` : `Make ${pickedMember.name} the owner`}
                      onCancel={() => setConfirm(null)}
                      onConfirm={() =>
                        run(
                          () => (confirm.kind === "remove" ? settings.removeMember!(pickedMember.id) : settings.makeOwner!(pickedMember.id)),
                          undefined
                        ).then((ok) => ok && setPicked(null))
                      }
                    >
                      {confirm.kind === "remove"
                        ? `${pickedMember.name} loses access right away. Their next steps become unassigned and invite links they made stop working. Places and photos they added stay.`
                        : `${pickedMember.name} becomes the owner and you become a regular roommate. Only they can undo this.`}
                    </ConfirmBox>
                  ) : null}
                </div>
              ) : null}
            </section>

            {settings.revokeInvite && snap.invites.length > 0 ? (
              <section aria-labelledby="links-title">
                <h3 id="links-title" className="font-display text-[19px] text-tar">
                  Invite links
                </h3>
                <ul className="mt-2.5 space-y-2">
                  {snap.invites.map((inv) => (
                    <li key={inv.token} className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-l-[10px] rounded-r-[18px] border-[1.5px] border-tar bg-shell-light py-1.5 pl-2.5 pr-4 text-sm">
                        <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full border-[1.5px] border-tar" />
                        {snap.members.find((m) => m.id === inv.createdBy)?.isMe ? "Your link" : `${nameOf(inv.createdBy)}'s link`} · until {formatDay(inv.expiresAt)}
                      </span>
                      <button type="button" disabled={busy} onClick={() => run(() => settings.revokeInvite!(inv.token))} className="text-sm font-bold text-danger disabled:opacity-50">
                        Turn off
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="send-title" className="rounded-[20px] bg-sea-100 p-3.5">
              <div className="flex items-center gap-3">
                <LassoIcon className="h-6 w-6 shrink-0 text-sea-800" strokeWidth={2.2} />
                <h3 id="send-title" className="min-w-0 flex-1 font-display text-[18px] text-sea-800">
                  Send to Corral
                </h3>
                <button type="button" aria-expanded={sendOpen} onClick={() => setSendOpen((o) => !o)} className="text-sm font-bold text-sea-700">
                  {sendOpen ? "Hide" : "Set it up"}
                </button>
              </div>
              {sendOpen ? (
                <div className="mt-3">
                  <SendSetup />
                </div>
              ) : null}
            </section>
          </>
        )}
      </div>

      {snap && me && (settings.leave || settings.deleteBoard) ? (
        <section aria-labelledby="tide-title" className="mt-6">
          <div aria-hidden="true" className="h-3.5" style={{ background: "radial-gradient(circle at 50% 100%, var(--color-shell-deep) 12px, transparent 13px) -2px 0 / 26px 14px repeat-x" }} />
          <div className="bg-shell-deep px-5 pb-6 pt-2 sm:px-7">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <h3 id="tide-title" className="min-w-0 flex-1 font-display text-[17px] text-stone-800">
                Low tide
              </h3>
              {iOwn ? (
                <button type="button" onClick={() => setConfirm({ kind: "delete" })} className="text-sm font-bold text-danger">
                  Delete the board…
                </button>
              ) : (
                <button type="button" onClick={() => setConfirm({ kind: "leave" })} className="text-sm font-bold text-danger">
                  Leave the board…
                </button>
              )}
            </div>
            {confirm?.kind === "delete" ? (
              <>
                <p className="mt-2 text-sm text-stone-800">
                  Deletes every place, note and photo on this board for everyone. This can&apos;t be undone.
                  {snap.members.length > 1 ? " To leave but keep the board going, hand it to someone else first." : ""}
                </p>
                <DeleteConfirm boardName={board.name} busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => run(() => settings.deleteBoard!(), onGone)} />
              </>
            ) : null}
            {confirm?.kind === "leave" ? (
              <ConfirmBox busy={busy} danger action="Leave board" onCancel={() => setConfirm(null)} onConfirm={() => run(() => settings.leave!(), onGone)}>
                You&apos;ll stop seeing this board, and you&apos;ll need a new invite link to come back. Places and photos you added stay.
              </ConfirmBox>
            ) : null}
          </div>
        </section>
      ) : (
        <div className="h-6" />
      )}
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
    <section aria-label="Board details">
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
            {/* A rent tag: knot on the left, rounded on the right. */}
            <div className="mt-1.5 flex h-11 items-center gap-2 rounded-l-[12px] rounded-r-[22px] border-[1.5px] border-tar bg-shell-light pl-3 pr-4 focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-shell">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full border-[1.5px] border-tar" />
              <span aria-hidden="true" className="font-display text-lg text-tar">
                $
              </span>
              <input
                id={`${id}-budget`}
                inputMode="numeric"
                value={budget}
                placeholder="No budget"
                onChange={(e) => setBudget(e.target.value)}
                className="w-full min-w-0 border-0 bg-transparent font-display text-lg text-tar outline-none placeholder:font-sans placeholder:text-sm placeholder:text-stone-600"
              />
              <span className="shrink-0 text-xs text-stone-700">each</span>
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
    </section>
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

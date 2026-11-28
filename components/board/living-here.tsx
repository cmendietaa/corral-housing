"use client";

import { evenShare, formatRent, totalRent } from "@/lib/compare";
import { parseDollars } from "@/lib/format";
import { PRICE_BASES, PRICE_BASIS_LABELS, type PriceBasis } from "@/lib/listing";
import { cn } from "@/lib/utils";
import { Stepper, Tile } from "./fields";
import type { Draft } from "./place-draft";

/** The fence-board colors of the group's own boards; spots to fill are dashed. */
const BOARD_COLORS = ["bg-sunset-400", "bg-sea-500", "bg-glass-500", "bg-sea-300", "bg-sunset-300"] as const;

/** The draft's price basis ("" is the whole place). */
export function draftBasis(d: Pick<Draft, "priceBasis">): PriceBasis {
  return (PRICE_BASES as readonly string[]).includes(d.priceBasis) ? (d.priceBasis as PriceBasis) : "whole";
}

/** The price tile's label, which follows how the price is quoted. */
export function priceLabel(basis: PriceBasis): string {
  return basis === "per_person" ? "Price per person" : basis === "our_part" ? "Price for your part" : "Rent for the whole place";
}

/** Whole place / Per person / Just our part, as chips. */
export function PriceBasisChoices({ name, value, onChange }: { name: string; value: PriceBasis; onChange: (v: PriceBasis) => void }) {
  return (
    <div role="radiogroup" aria-label="How the price is quoted" className="mt-2 flex flex-wrap gap-1.5">
      {PRICE_BASES.map((b) => (
        <label
          key={b}
          className={cn(
            "inline-flex h-8 cursor-pointer items-center rounded-full px-3 text-[13px] transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
            value === b ? "bg-sea-800 font-semibold text-shell" : "border border-divider bg-shell-light text-tar hover:bg-shell-mid"
          )}
        >
          <input type="radio" name={name} value={b} checked={value === b} onChange={() => onChange(b)} className="sr-only" />
          {PRICE_BASIS_LABELS[b]}
        </label>
      ))}
    </div>
  );
}

/**
 * How many people would live there, and what that means for each of them.
 * Starts at the group's size; going past it shows dashed boards for the spots
 * to fill, and the rent then splits by everyone.
 */
export function LivingHereTile({
  id,
  draft,
  onPeople,
  group,
  budgetPerPersonCents,
  error,
  className
}: {
  id: string;
  draft: Pick<Draft, "rent" | "priceBasis" | "people">;
  /** "" means the group's size. */
  onPeople: (value: string) => void;
  group: number | null;
  budgetPerPersonCents: number | null;
  error?: string;
  className?: string;
}) {
  const basis = draftBasis(draft);
  const own = draft.people.trim() === "" ? null : Number(draft.people);
  const people = own !== null && Number.isFinite(own) ? own : group;
  const rent = parseDollars(draft.rent);
  const priced = { rentCents: Number.isNaN(rent) ? null : rent, priceBasis: basis, peopleCount: own !== null && Number.isFinite(own) ? own : null };
  const each = evenShare(priced, group);
  const total = totalRent(priced, group);
  const spots = group !== null && people !== null ? Math.max(0, people - group) : 0;
  const setPeople = (n: number) => onPeople(group !== null && n === group ? "" : String(n));

  return (
    <Tile found={false} roped={false} labelFor={`${id}-people`} label="Living here" className={className}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="w-[150px]">
          <Stepper
            inputProps={{
              id: `${id}-people`,
              value: people === null ? "" : String(people),
              inputMode: "numeric",
              onChange: (e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                onPeople(group !== null && v === String(group) ? "" : v);
              },
              "aria-describedby": error ? `${id}-people-error` : undefined
            }}
            less="One fewer person"
            more="One more person"
            onStep={(d) => setPeople(Math.min(20, Math.max(1, (people ?? 1) + d)))}
          />
        </div>
        <span className="text-sm text-stone-800">
          {people === group || people === null ? "people · your group" : spots > 0 ? "people" : `of your ${group}`}
        </span>
      </div>

      {spots > 0 && group !== null ? (
        <div className="mt-2 flex items-center gap-2">
          <span aria-hidden="true" className="flex items-end gap-[3px]">
            {Array.from({ length: Math.min(group, 12) }, (_, i) => (
              <span key={i} className={cn("block h-[22px] w-2.5 rounded-t-full rounded-b-[2px]", BOARD_COLORS[i % BOARD_COLORS.length])} />
            ))}
            {Array.from({ length: Math.min(spots, 8) }, (_, i) => (
              <span key={`s${i}`} className="block h-[22px] w-2.5 rounded-t-full rounded-b-[2px] border-[1.5px] border-dashed border-sunset-600" />
            ))}
          </span>
          <span className="text-sm font-bold text-sunset-800">
            {group} of you + {spots} {spots === 1 ? "spot" : "spots"} to fill
          </span>
        </div>
      ) : null}

      {each !== null ? (
        <p className="mt-2.5 rounded-[14px] bg-glass-200 px-3 py-2 text-sm text-glass-900">
          <span className="font-display text-[17px]">{formatRent(each)} each</span>
          {basis === "per_person"
            ? total !== null
              ? ` · ${formatRent(total)} for ${spots > 0 || people !== group ? `all ${people}` : `your ${people}`}`
              : ""
            : people === group
              ? " · split evenly"
              : ` · split by ${people}`}
          {budgetPerPersonCents ? (
            <span className={each <= budgetPerPersonCents ? "text-glass-800" : "text-sunset-800"}>
              {each <= budgetPerPersonCents ? " · within budget" : " · over budget"}
            </span>
          ) : null}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-people-error`} className="mt-1 text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </Tile>
  );
}

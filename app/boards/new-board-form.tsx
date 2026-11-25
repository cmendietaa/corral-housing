"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBoard, type CreateBoardState } from "./actions";

export function NewBoardForm() {
  const [state, action, pending] = useActionState<CreateBoardState, FormData>(createBoard, { error: null });
  return (
    <form action={action} className="rounded-[30px] border-2 border-dashed border-sunset-600/80 p-5 sm:p-6">
      <h2 className="flex items-center gap-3 font-display text-xl text-sunset-800">
        <span aria-hidden="true" className="block h-9 w-3 rounded-t-full rounded-b-[2px] border-2 border-dashed border-sunset-600" />
        Start a new board
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="block">
          <span className="label text-stone-700">Board name</span>
          <Input name="name" required maxLength={80} placeholder="Our place by the bluffs" className="mt-1" />
        </label>
        <label className="block">
          <span className="label text-stone-700">Lease year</span>
          <Input name="leaseYear" maxLength={20} placeholder="2027–28" className="mt-1" />
        </label>
        <label className="block">
          <span className="label text-stone-700">Budget / person</span>
          <Input name="budget" inputMode="decimal" maxLength={12} placeholder="1400" className="mt-1" />
        </label>
      </div>
      {state.error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="mt-4" disabled={pending}>
        {pending ? "Creating…" : "Create board"}
      </Button>
    </form>
  );
}

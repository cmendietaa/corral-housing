"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { redeemInvite, type RedeemState } from "@/app/boards/actions";

export function JoinForm({ token, boardName }: { token: string; boardName: string }) {
  const [state, action, pending] = useActionState<RedeemState, FormData>(redeemInvite, { error: null });
  return (
    <form action={action} className="mt-6 flex flex-col items-center gap-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Joining…" : `Join ${boardName}`}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

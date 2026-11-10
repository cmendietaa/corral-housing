import Link from "next/link";
import { Band, FenceFooter } from "@/components/brand/band";
import { Wordmark } from "@/components/brand/wave-mark";

/** Simple pages (boards list, invites, sign-in): compact band, content, fence footer. */
export function PageShell({
  title,
  right,
  children
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Band variant="compact">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Corral home">
            <Wordmark />
          </Link>
          {title ? <h1 className="hidden font-display text-[22px] text-tar sm:block">{title}</h1> : null}
          <div className="ml-auto flex items-center gap-2">{right}</div>
        </div>
      </Band>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-8 sm:px-6">{children}</main>
      <FenceFooter />
    </div>
  );
}

/** POSTs to /auth/signout so a link or prefetch can never sign someone out. */
export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className="h-10 rounded-full px-4 text-sm font-semibold text-stone-800 hover:bg-shell-mid">
        Sign out
      </button>
    </form>
  );
}

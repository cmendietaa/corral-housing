import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/brand/page-shell";

export const metadata: Metadata = { title: "Privacy · Corral" };

const CONTACT = "https://github.com/cmendietaa/corral-housing/issues";
const UPDATED = "November 9, 2026";

export default function PrivacyPage() {
  return (
    <PageShell title="Privacy">
      <article className="mx-auto max-w-2xl space-y-5 text-[15px] leading-relaxed text-stone-900 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-tar">
        <h1 className="font-display text-[32px] leading-tight text-tar">Privacy policy</h1>
        <p className="label text-stone-700">Last updated {UPDATED}</p>
        <p>
          Corral is a student project: a shared board where a roommate group saves, maps and compares rentals in Isla Vista
          and Goleta. It is not affiliated with UCSB. This page explains what it stores and why.
        </p>

        <h2>The demo board</h2>
        <p>
          The demo at <Link href="/demo" className="text-sea-700 underline underline-offset-4">/demo</Link> needs no account. Its
          data is fictional and is kept only in your own browser&apos;s local storage. Nothing you do there is sent to Corral.
        </p>

        <h2>What we collect when you sign in</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            From Google: your name, email address and profile picture, through Google Sign-In. Corral asks for no other Google
            data.
          </li>
          <li>What you put on a board: its name, the places you add (links, addresses, rent and other details), notes, statuses and next steps.</li>
          <li>Which boards you&apos;re a member of, and invite links you create.</li>
        </ul>

        <h2>How it&apos;s used</h2>
        <p>
          Only to run Corral: to sign you in, to show your boards to you and the roommates you invite, and to show your first
          name to the people on your boards. We don&apos;t sell or share your data, show ads, or use it to train AI models.
        </p>

        <h2>Who can see your boards</h2>
        <p>
          A board is visible only to its members. Anyone you send an invite link to can join while the link is valid (7 days).
          This is enforced by the database itself, not just by the app.
        </p>

        <h2>Where it&apos;s stored</h2>
        <p>
          Accounts and boards are stored with Supabase. The site is hosted on Vercel. Maps use OpenFreeMap and OpenStreetMap
          data; if street photos are turned on, they come from Google Street View using a place&apos;s map location.
        </p>

        <h2>Deleting your data</h2>
        <p>
          You can remove places from a board at any time. To delete your account and everything tied to it, open a request at{" "}
          <a href={CONTACT} className="text-sea-700 underline underline-offset-4">
            the project&apos;s GitHub issues
          </a>{" "}
          and we&apos;ll remove it.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy:{" "}
          <a href={CONTACT} className="text-sea-700 underline underline-offset-4">
            {CONTACT.replace("https://", "")}
          </a>
          .
        </p>
      </article>
    </PageShell>
  );
}

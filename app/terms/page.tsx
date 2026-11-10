import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/brand/page-shell";

export const metadata: Metadata = { title: "Terms · Corral" };

const CONTACT = "https://github.com/cmendietaa/corral-housing/issues";

export default function TermsPage() {
  return (
    <PageShell title="Terms">
      <article className="mx-auto max-w-2xl space-y-5 text-[15px] leading-relaxed text-stone-900 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-tar">
        <h1 className="font-display text-[32px] leading-tight text-tar">Terms of use</h1>
        <p className="label text-stone-700">Last updated November 9, 2026</p>
        <p>
          Corral is a free student project for organizing a roommate group&apos;s housing search. It is not affiliated with
          UCSB, and it isn&apos;t a rental listing service: it only keeps the links and notes you add.
        </p>
        <h2>Using Corral</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Only add content you have the right to share, and only invite people you want on your board.</li>
          <li>Rent, availability and other details are whatever you and your roommates enter. Always confirm them with the landlord or listing.</li>
          <li>Don&apos;t use Corral to harass anyone, to store other people&apos;s personal information without permission, or to try to access boards you weren&apos;t invited to.</li>
        </ul>
        <h2>No warranty</h2>
        <p>
          Corral is provided as is, without guarantees of availability or accuracy. It may change or shut down, so keep your own
          copy of anything important.
        </p>
        <h2>Privacy</h2>
        <p>
          See the <Link href="/privacy" className="text-sea-700 underline underline-offset-4">privacy policy</Link> for what Corral stores and why.
        </p>
        <h2>Contact</h2>
        <p>
          <a href={CONTACT} className="text-sea-700 underline underline-offset-4">
            {CONTACT.replace("https://", "")}
          </a>
        </p>
      </article>
    </PageShell>
  );
}

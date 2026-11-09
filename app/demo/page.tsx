import Link from "next/link";

export default function DemoPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold">The demo board is on its way</h1>
      <p className="text-muted">
        A fictional board of Isla Vista and Goleta places will live here. Check back soon.
      </p>
      <Link href="/" className="font-semibold text-sky underline underline-offset-4">
        Back to home
      </Link>
    </main>
  );
}

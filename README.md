# Corral

A private shared board for UCSB roommate groups hunting for Isla Vista and Goleta leases. Save listings from any site, see them on one map, compare two or three side by side, and give each place a status and a next action with an owner.

> Work in progress for ACM.Industry 2027. Live demo link coming once deployed.

## Run it locally

```bash
npm install
cp .env.example .env.local   # optional: without Supabase keys, only the demo works
npm run dev
```

## Checks

```bash
npm run lint && npm test && npm run build
```

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · Supabase (Google auth, Postgres, RLS) · react-leaflet · Zod · Vitest · Playwright · Vercel

See [PRD.md](PRD.md) for the product scope and [PLAN.md](PLAN.md) for the build plan and data model.

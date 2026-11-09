# Corral

Shared apartment-search board for UCSB roommate groups (Isla Vista / Goleta).

- Read PRD.md (product contract) and PLAN.md (schedule, stack, data model) before changing scope.
- Work on one milestone from PLAN.md at a time. State the user outcome and how you verified it.
- Private board access is enforced server-side with Supabase RLS. Never rely on client checks alone.
- The public demo (`/demo`) uses localStorage only and must never touch the database.
- Never commit secrets or real roommate data. Use `.env.local`; list variable names in `.env.example`.
- Keep database changes in `supabase/migrations/`.
- Run lint, tests and build before committing, and report anything you could not verify.
- Commits: no `Co-Authored-By` or other Claude attribution trailers, and no "Generated with Claude Code" lines in commits or PRs.

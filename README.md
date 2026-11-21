# Literary World Map

Log the books you read and see each one pinned where its story is set. See `SPEC.md` for the full spec and `CLAUDE.md` for conventions.

## Setup

Requirements: Node.js LTS, pnpm, Docker.

```bash
pnpm install
cp .env.example .env.local   # fill keys from `pnpm exec supabase status`
pnpm db:start                # local Supabase + migrations
pnpm dev
```

Sign in locally with any email: the magic link lands in Mailpit at http://127.0.0.1:54324.

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration` and `pnpm test:e2e`. The last two need local Supabase running.

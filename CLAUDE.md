# Guitar practice tracker

Single-user app for tracking guitar practice items, a weekly routine, and BPM progress. See `ROADMAP.md` for the stack and the milestone plan.

## Layout

npm workspaces, TypeScript everywhere (Node 26, see `.nvmrc`):

- `shared/` — `@practice/shared`: types (and later zod schemas) used by both client and server. Consumed as TS source; no build step.
- `server/` — Express 5 API under `/api/*`. `createApp()` in `src/app.ts` is separate from `src/index.ts` (listen) so tests can use supertest. Prisma 7 with the better-sqlite3 adapter; client generated into `src/generated/prisma/`.
- `client/` — React 19 + Vite + Tailwind 4 + TanStack Query. Vite proxies `/api` to `localhost:3001`. Fetch helpers live in `src/api.ts`.

## Commands (run from the repo root)

- `npm run dev` — server and client together
- `npm test` — server tests (Vitest + supertest)
- `npm run typecheck` — all workspaces
- `npm run lint` / `npm run format`
- `npm run db:migrate -- --name <name>` — create and apply a Prisma migration (`prisma migrate dev`); always pass `--name`, since it prompts for one otherwise

The server needs `server/.env` (copy `server/.env.example`).

## Conventions

- Request and response shapes go in `shared` and are imported by both sides — don't redeclare them in client or server.
- Database changes: edit `server/prisma/schema.prisma`, then `npm run db:migrate -- --name <name>`. Never hand-edit `src/generated/prisma/` or existing migrations.
- SQLite now, Postgres at deploy (milestone 7) — avoid SQLite-only features in queries.
- New API routes get a Vitest test next to them.
- Imports inside `server/` use `.js` extensions (ESM).

## Workflow

- Build one milestone from `ROADMAP.md` at a time. When it's done (typecheck, tests and lint pass), tick its box in `ROADMAP.md` and stop for review — don't start the next one.
- Hooks in `.claude/settings.json` run Prettier after every edit and typecheck at the end of each turn.

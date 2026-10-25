# Roadmap

Guitar practice tracker: a multi-user app (open sign-up) for managing practice items, a weekly routine, and BPM progress over time. Each user sees only their own data.

## Stack

- **Language:** TypeScript throughout, npm workspaces (`client`, `server`, `shared`)
- **Client:** React, Vite, Tailwind, TanStack Query
- **Server:** Express, zod
- **Database:** Prisma — SQLite for development, Postgres in production
- **BPM model:** each item tracks a current and target BPM, with a `BpmLog` history

## Milestones

Each milestone is built and reviewed before the next one starts.

- [x] **1. Scaffold** — monorepo, tooling, client/server/shared packages
- [x] **2. Auth** — sign-up, login and logout
- [ ] **3. Items CRUD** — create, edit, and delete practice items
- [ ] **4. Weekly routine** — assign items to days of the week
- [ ] **5. BPM updates + history chart** — log BPM changes and chart progress
- [ ] **6. Polish / PWA** — UX polish, installable PWA
- [ ] **7. Deploy** — move to Postgres and deploy

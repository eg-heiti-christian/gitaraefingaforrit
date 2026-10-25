---
name: milestone
description: Build the next unchecked milestone from ROADMAP.md (or the one named in the arguments), verify it, tick it off, and stop for review. Use when the user says "next milestone", "start milestone N", or /milestone.
---

# Build a milestone

1. **Pick the milestone.** Read `ROADMAP.md`. Use the milestone named in the arguments, otherwise the first unchecked one. If an earlier milestone is still unchecked, ask before skipping it.

2. **Plan it.** Read the code it touches (`CLAUDE.md` describes the layout). Write a short plan for the user: Prisma models, API routes, shared types, client screens, and tests. List any open product questions (for example what fields an item has). Wait for the user to agree to the plan before writing code.

3. **Build it** in this order, following the conventions in `CLAUDE.md`:
   - schema changes → `npm run db:migrate -- --name <short_name>` (the name is required: there is no terminal for Prisma to prompt in)
   - shared types/schemas in `shared/src`
   - server routes, each with a Vitest test
   - client: fetch helpers in `client/src/api.ts`, TanStack Query hooks, UI

4. **Verify.** Run `npm run typecheck`, `npm test` and `npm run lint` until all pass. If the milestone changes the UI, start the app and check that the new flow works.

5. **Finish.** Tick the milestone's box in `ROADMAP.md`. Report what was built, how it was verified, and anything left undone or decided along the way. Suggest `/code-review` (and `/security-review` for milestones 2 and 7). Don't commit unless asked, and don't start the next milestone.

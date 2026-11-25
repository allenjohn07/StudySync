@AGENTS.md

# StudySync frontend

Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (the `base-nova` style, built on Base UI)
and TanStack Query. The backend is in `../backend`; the root `README.md` has the setup and the full flow.

## Pages

- `/` landing page, `/login` (a single button; the "logged in" flag is in `localStorage`, see `hooks/use-local-auth.ts`).
- `/dashboard` is the app: an oklch.fyi-style shell (full-width header, collapsible `AppSidebar` with sessions grouped by
  subject) around the live recording, transcript and summary. `NewSessionDialog` runs before every recording: pick or
  create a subject, or continue an earlier session. `/dashboard/demo` only redirects here.

## Conventions

- **Data fetching**: one `hooks/use-<resource>.ts` per resource with React Query hooks; the typed client is
  `lib/api.ts` and the shared types are in `lib/types.ts`. See `use-lessons.ts` for how mutations update the cache.
- **shadcn/ui is on Base UI, not Radix**: there is no `asChild`. To render a trigger as another element, pass
  `render={<Link href="..." />}` and put the content as `children` of the outer primitive; when the render target
  isn't a native `<button>`, also pass `nativeButton={false}` on `Button`. `TooltipProvider` takes `delay`.
  Check the generated source in `components/ui/` before wiring up a new component. Add components with
  `npx shadcn@latest add <name>`, then restyle them to the design system.
- **Design system**: the guide is `.claude/skills/studysync-design/SKILL.md` (neutral greys in OKLCH, Inter, hairline
  borders, yellow used sparingly, light and dark mode via `next-themes`). Tokens live in `src/app/globals.css`
  (`:root` and `.dark`; Tailwind v4: no `tailwind.config`).
- **Page frame**: the landing and login pages are a rounded full-window card on the page margin (`p-3 sm:p-4`), and
  landing sections are sized in `dvh`. The dashboard is edge to edge (header + sidebar + main).
- **Text effects**: `WritingText` / `WritingWord` (`components/ui/writing-text.tsx`) reveal titles word by word and
  `Words` reuses the effect for the live transcript; `ShimmeringText` marks things that are being generated.
  Their CSS is in `globals.css` and respects reduced motion.
- **Hydration**: don't put `Date.now()`, `Math.random()` or unrounded numbers into markup that is rendered on the
  server (round inline styles, read the browser state in effects).
- **Global CSS**: scrollbars are hidden everywhere and clickable elements get the pointer cursor, both in `globals.css`.
- **No automated tests yet.**

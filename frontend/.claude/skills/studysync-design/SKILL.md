---
name: studysync-design
description: StudySync frontend design system — the neutral, Geist-based look (modelled on oklch.fyi, interfaces.dev and jakub.kr) with light and dark mode. Exact tokens, type, borders, motion and component patterns. Load this before building, restyling, or adding any page or component in frontend/ so new UI matches instead of drifting to defaults.
---

# StudySync design system

In November 2026 the user replaced the old cream/ink/yellow "poster" style with a refined, neutral design language
modelled on **oklch.fyi**, **interfaces.dev** and **jakub.kr**: greys in OKLCH, Geist (the Next.js/Vercel font), hairline borders, soft
shadows, small purposeful motion, and **light + dark mode**. The marker yellow stays as the brand accent, but
**used sparingly**. The whole site (landing, login, dashboard) follows this. The pre-redesign version is on `main`
(the redesign started on the `redesign-neutral-ui` branch), if you ever need to compare.

## Tokens (`src/app/globals.css`)

Colors are OKLCH custom properties in `:root` (light) and `.dark`, mapped to Tailwind via `@theme inline`. Use the
semantic classes, never a hex value or a raw grey from Tailwind's palette (subject dots are the one exception, see
below).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | 0.985 | 0.165 | page mat; dashboard main in dark |
| `card` | white | 0.185 | surfaces; dashboard main in light |
| `sidebar` | 0.975 | 0.155 | dashboard header + sidebar (slightly off the main area, as on oklch.fyi) |
| `foreground` | 0.18 | 0.96 | text |
| `muted-foreground` | 0.53 | 0.68 | secondary text, icons, meta |
| `border` | 0.92 | white/9% | every hairline |
| `accent` / `sidebar-accent` | 0.955 / ink 6% | 0.25 / white 7% | hover and selected rows |
| `primary` | ink | near-white | the main button (inverts in dark) |
| `highlight` | yellow 0.9 0.17 100 | 0.88 0.16 98 | brand accent, sparingly |
| `destructive` | red | red | recording dot, errors, delete |

**Where yellow is allowed:** the logo bars, the hero's marked word, due-date chips in a summary, the armed `Ctrl`
keycap, the "processing" status dot, and text selection. Not on buttons, borders or large surfaces.

Utilities: `.label-mono` (11px mono uppercase eyebrow, e.g. summary section labels), `.section-rule` (a medium-weight
heading with a hairline running to the right, as on oklch.fyi: "Transcript"), `.dot-grid` (faint dot background for
empty and decorative panels).

## Dark mode

`next-themes` (`ThemeProvider attribute="class" defaultTheme="system"` in `components/providers.tsx`; `<html
suppressHydrationWarning>`). `ThemeToggle` (`components/theme-toggle.tsx`) is the light/dark/system segmented control
with a sliding thumb, shown in the dashboard header, the landing nav and the login header. Every new surface must
look right in both themes: rely on tokens; where a translucent tint reads better in dark, add
`dark:bg-white/[0.03]`-style overrides (as `Button` outline and `Input` do).

## Type

- **Geist** for everything (`font-sans`; `font-display` also maps to Geist). The user picked Geist over Inter for its
  slightly rounder, Next.js-site feel; don't switch back to Inter. **Geist Mono** for `font-mono`
  (timestamps, timer, `.label-mono`). Loaded in `app/layout.tsx`.
- Headings are `font-semibold` with negative tracking that grows with size: `tracking-[-0.01em]` at 15px,
  `-0.02em` at 20px, `-0.03em` at 24–28px, `-0.045em/-0.05em` for the hero. **No `font-extrabold`, no condensed
  widths** (those belonged to the old style).
- Body copy is 15px (`text-[15px]`) with `leading-relaxed`; meta text is 13px/12px/11px in `text-muted-foreground`.
- Numbers that change (timers, counts, times) get `tabular-nums`.

## Shape, borders, depth

- One hairline everywhere: `border border-border` (1px). No `border-2`.
- Radii: controls `rounded-lg`; cards/panels `rounded-xl`/`rounded-2xl`; dialogs `rounded-2xl`; pills and status
  chips `rounded-full`.
- Depth comes from soft shadows, not borders: `shadow-xs` on controls; large floating things (dialog, landing demo
  window) get a long, soft drop shadow like `shadow-[0_24px_64px_-16px_oklch(0_0_0/0.25)]`. The old hard yellow
  offset shadow is gone; don't bring it back.
- Nested "card in card" for info blocks follows oklch.fyi's sidebar card: an outer `rounded-xl border p-1` with an
  inner `rounded-lg border` row (see the "Saved on this computer" card in `AppSidebar`).

## Motion

Small and quick, `ease-out`, 150–300 ms:
- Buttons press with `active:scale-[0.97]` (built into `Button`); rows `active:scale-[0.98]`.
- Segmented controls (theme toggle, the dialog's tabs) slide a thumb with `transition-transform`.
- Collapsible groups animate height with the grid trick (`grid-rows-[0fr]` → `grid-rows-[1fr]`).
- Dialogs fade, scale from 0.97 and un-blur (`data-open:blur-in`).
- The sidebar slides its width with `ease-[cubic-bezier(0.32,0.72,0,1)]`.
- Text effects (`WritingText`, `Words`, `ShimmeringText`) are unchanged and respect reduced motion.

## Primitives (`components/ui/`)

- `Button`: `default` (ink fill, inverts in dark, subtle inner highlight), `outline` (card fill + hairline +
  `shadow-xs`), `secondary` (neutral fill), `highlight` (yellow, use rarely), `ghost` (muted text, accent on hover),
  `destructive`, `link`. Sizes are the shadcn defaults; `lg` (h-9) is the largest app button, and the landing CTAs use
  `size="lg"` with `h-11 px-5 text-[15px]`.
- `Input`: `rounded-lg`, hairline, neutral focus ring (`focus-visible:ring-foreground/10`, never yellow).
- `Dialog` (added for the new-recording flow), `Popover`, `Tooltip`, `Badge` (`outline` = hairline pill for topics,
  `highlight` = yellow due-date chip), `Kbd` (hairline keycap with a 1px bottom shadow), `Checkbox` (hairline).

## Layouts

- **Dashboard (`app/dashboard/page.tsx`)** — modelled on oklch.fyi: edge-to-edge, `h-dvh`.
  - Header `h-14`, `bg-sidebar`, bottom hairline: sidebar toggle (`PanelLeft`) + `BrandMark` in a 272px column,
    then a breadcrumb (subject dot, subject / session title) and, on the right, the **Search… ⌘L** button (opens
    `CommandPalette`, `components/command-palette.tsx`; ⌘L / ⌘K anywhere), `ThemeToggle` + Log out. Search lives only in the
    palette, not in the sidebar.
  - `AppSidebar` (`components/app-sidebar.tsx`), 272px, open by default on desktop (remembered in `localStorage`),
    an overlay on phones: "New recording" row (round ink plus icon that rotates on hover), an **Upcoming** deadlines list,
    a `SUBJECTS` eyebrow, then one collapsible group per subject (color dot, name, count; chevron on hover) with its
    sessions indented under a guide line; the open session has an ink tick on that line. Info card and "Clear all
    sessions" pinned at the bottom.
  - Main: two columns. Left: status pill (Ready / Recording in red with a ping / Processing with a yellow dot),
    timer, waveform, `.section-rule` "Transcript", transcript, then the actions ("New recording", and "Continue this
    session" when a finished one is open) and the `Ctrl Ctrl` hint. Right: "Summary" title + date + "Saved" pill,
    then `SummaryStream`; an empty state is a dashed `.dot-grid` panel.
- **New recording dialog (`components/new-session-dialog.tsx`)**: a two-tab segmented control. "New session" =
  subject chips (dot + name, selected = darker border + check; "Unsorted"; dashed "+ New subject" that turns into an
  inline field) and an optional name. "Continue a session" = search + radio list of finished sessions. Footer: the
  `Ctrl Ctrl` hint on the left, Cancel + "Start recording" (red dot) on the right. The last subject used is
  preselected.
- **Landing / login**: edge to edge like the dashboard (the user asked for one uniform full-width look; the old
  rounded card on a page margin is gone). `SiteHeader` (`components/site-header.tsx`) is the same `h-14 bg-sidebar
  border-b` bar as the dashboard header, sticky and slightly translucent on the landing page; the page itself is
  `bg-card dark:bg-background`, like the dashboard's main area. Hero: a small status pill above a huge semibold Geist
  headline (red strike on "writing.", yellow mark on "listening."), muted lede, two CTAs. The demo band is `bg-muted/40
  .dot-grid`, not yellow. Login's right panel is the same dotted neutral panel and the page fits one screen.
- Sidebar rows (New recording, Clear all sessions, subjects, sessions) are all full width (`w-full`) so their hover
  fills the sidebar.

## Subjects

Subjects (classes) group sessions. Each has a color from a fixed palette (`lib/subjects.ts` `SUBJECT_DOT`, kept in
sync with `SUBJECT_COLORS` in `backend/src/routes/subjects.ts`); the color only ever appears as a small dot (size-2)
next to the subject's name. Unsorted sessions use a hollow ring dot. Don't tint backgrounds or text with subject colors.

## Illustrations and stickers (the playful layer)

The user wants the site to feel friendly and student-made, not like a dev tool, and asked for "more characters" and
"more space, less text". Two pieces carry that:

- **Illustrations** (`components/illustration.tsx`, files in `public/illustrations/*.webp`): hand-drawn halftone line
  art of students (listening-class, recording, notebook, listening, checklist, private). They are stored as **black ink on a transparent
  background** and get `dark:invert`, so they sit on any surface in both themes. To add one, convert the paper
  background to alpha the same way (alpha = darkness relative to the paper colour; trim the margins; save as WebP
  ~900px). **No glow/blob behind them** (the user removed it); the drawing sits straight on the surface. Use one per section at most.
- **Stickers** (`components/sticker.tsx`): tilted line icons with a thick pastel backing (green, yellow, purple,
  peach, blue, pink) and a dark `#24262b` line, which stays dark in dark mode on purpose. `float` makes them bob
  gently (off with reduced motion), and they pop on hover. Scatter 2–4 around an illustration or a section's edges
  (`max-sm:hidden` when they'd crowd a phone), or use one next to a feature's eyebrow label. Icons: mic, book, pencil,
  list, check, chart, bulb, cap, headphones, calendar, clock, lock, sparkle. Add new ones as simple 24px line paths.
- **Copy stays short**: one-sentence bodies, a single short lede in the hero. Sections breathe (`py-28 sm:py-36`,
  `gap-28` between feature rows).

- **Transcribe band** (`components/landing/transcribe-band.tsx`, CSS in `globals.css`): a strip along the bottom of
  the hero showing "sound in, words out". A waveform slides in from the left into a centred-left pill (pink mic
  sticker, pulsing red dot, "Transcribing live"), and the transcript slides out of it to the right, key phrases
  `font-semibold text-foreground`. Pure CSS: each track holds two copies and slides by 50% (`band-slide`), and the bars
  also breathe (`band-bar`); both stop with reduced motion. Edges fade with `mask-image`. The user rejected three
  earlier versions (a wavy text ribbon, text flowing into the character's ear, faint text across the whole background).

Landing order: hero (text left; the `listening-class` drawing, made for the tagline: eyes closed listening, notes crossed out,
laptop on REC, with three stickers in its open space) → demo band ("A
lecture, turned into notes") → three alternating feature rows (checklist, notebook, private) → centred closing CTA ringed by floating stickers →
slim footer (brand, three links, the `StudySync` watermark). The login page is fixed to one screen (`h-dvh`, no scroll); its panel shows the `listening` drawing (lying back
with headphones; deliberately different from the hero's), sized by the height left over (`aspect-[848/640] h-full
max-h-[360px]`).

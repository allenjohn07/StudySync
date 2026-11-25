---
name: studysync-design
description: StudySync frontend design system — the neutral, Inter-based look (modelled on oklch.fyi, interfaces.dev and jakub.kr) with light and dark mode. Exact tokens, type, borders, motion and component patterns. Load this before building, restyling, or adding any page or component in frontend/ so new UI matches instead of drifting to defaults.
---

# StudySync design system

In November 2026 the user replaced the old cream/ink/yellow "poster" style with a refined, neutral design language
modelled on **oklch.fyi**, **interfaces.dev** and **jakub.kr**: greys in OKLCH, Inter, hairline borders, soft
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

- **Inter** for everything (`font-sans`; `font-display` also maps to Inter). **Geist Mono** for `font-mono`
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
    then a breadcrumb (subject dot, subject / session title) and, on the right, `ThemeToggle` + Log out.
  - `AppSidebar` (`components/app-sidebar.tsx`), 272px, open by default on desktop (remembered in `localStorage`),
    an overlay on phones: "New recording" row (round ink plus icon that rotates on hover), search (`/` focuses it),
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
- **Landing / login**: still the rounded full-window card on a page margin (`p-3 sm:p-4`, `rounded-[22px] border
  border-border bg-card`), sections sized in `dvh`. Hero: a small status pill above a huge semibold Inter headline
  (red strike on "writing.", yellow mark on "listening."), muted lede, two CTAs. The demo band is `bg-muted/40
  .dot-grid`, not yellow. Login's right panel is the same dotted neutral panel.
- `SiteHeader` (`h-16`) is for landing/login only; the dashboard has its own header.

## Subjects

Subjects (classes) group sessions. Each has a color from a fixed palette (`lib/subjects.ts` `SUBJECT_DOT`, kept in
sync with `SUBJECT_COLORS` in `backend/src/routes/subjects.ts`); the color only ever appears as a small dot (size-2)
next to the subject's name. Unsorted sessions use a hollow ring dot. Don't tint backgrounds or text with subject colors.

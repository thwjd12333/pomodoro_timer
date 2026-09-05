---
name: FocusCal
description: 뽀모도로 + 일정 타이머를 스티키노트 형태로 관리하는 Chrome 확장 팝업의 글래스 컨트롤센터
colors:
  cobalt-accent: "#3a5fe0"
  cobalt-accent-hover: "#3151c7"
  cobalt-accent-active: "#2944ad"
  urgent-coral: "#e2543d"
  break-green: "#2fb673"
  schedule-teal: "#1fa97c"
  status-paused-amber: "#e0a72e"
  status-done-green: "#128f66"
  status-skipped-ochre: "#a8752e"
  tag-purple: "#7d74e6"
  tag-teal: "#1fa97c"
  tag-coral: "#e2653d"
  tag-amber: "#c98a3b"
  tag-blue: "#3a8de0"
  tag-pink: "#d4568a"
  bg-primary-light: "#eef0f6"
  bg-primary-dark: "#101114"
  text-primary-light: "#14151a"
  text-primary-dark: "#f5f6f8"
  text-secondary-light: "#6b6f7c"
  text-secondary-dark: "#999ca6"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.4px"
  numeral:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.4px"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  hero: "24px"
  card: "20px"
  field: "12px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.cobalt-accent}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.cobalt-accent-hover}"
  button-primary-active:
    backgroundColor: "{colors.cobalt-accent-active}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  card:
    backgroundColor: "{colors.bg-primary-light}"
    rounded: "{rounded.card}"
    padding: "16px"
  hero-widget:
    backgroundColor: "{colors.bg-primary-light}"
    rounded: "{rounded.hero}"
    padding: "16px 20px"
---

# Design System: FocusCal

## Overview

**Creative North Star: "The Glass Control Center"**

FocusCal's popup is a small frosted-glass instrument panel: one glass hero widget states what's running right now, and everything else recedes into a compressed, scannable list of glass cards. The world is deliberately quiet — a single graphite/white surface language, one cobalt accent, and a continuous (never stepped) color language for urgency — because the product's job is a 1-second glance while working, not a destination to linger in. Nothing here shouts; the hero widget is the only thing allowed to be large, and it earns that size by being the one note currently holding the timer.

Two disciplines were inherited from the direction contract's near-miss challenger and are now load-bearing: state is never color-only (every dot pairs with a neutral-text label), and action buttons are differentiated by shape as well as color (filled pill for the confirming action, outlined pill for the secondary one). Depth comes entirely from translucency and soft, deeply-blurred shadows, never from hard offsets or borders alone — this is a frosted-glass world, and its blur is structural, not decorative.

Confirmed visual rejection: no flat, opaque card system. Glass (background tint + backdrop blur + hairline border) is the only surface treatment used for any container in this build — headers, cards, hero, sheet, dialogs, alerts.

**Key Characteristics:**
- One cobalt accent (#3a5fe0), used sparingly against a graphite/white neutral field
- A single hero widget per screen state; everything else is a compact card
- Continuous, color-mix–driven ring color rather than discrete status colors
- State is always dot + neutral-text label, never color alone
- Primary vs. secondary actions differ in shape (filled pill vs. outline pill), not just color

## Colors

A near-monochrome graphite/white/ink field carries one cobalt accent; semantic color (urgent, break, status, tag) is reserved for small dots, thin rings, and icon fills — never for large surfaces.

### Primary
- **Cobalt Accent** (`#3a5fe0`, hover `#3151c7`, active `#2944ad`): the only brand color. Used on the primary action button fill, running/progress states, the add-note button, focus rings, text selection, and the header wash gradient. Also the resting end of the ring-dial's continuous color-mix.

### Secondary
- **Urgent Coral** (`#e2543d`): the ring's low-time-remaining end (continuously blended in via `color-mix`, never applied as a flat color-swap), the delete/destructive action, and the "failed" status dot.
- **Break Green** (`#2fb673`): fixed, calm ring color during a break phase — the one place the ring intentionally stops being continuous, because a break has nothing to rush toward.

### Neutral
- **Graphite Field / Cool Mist** (light `#eef0f6`, dark `#101114`): the page background beneath a soft radial cobalt wash (`--bg-wash`).
- **Ink / Off-White Text** (light `#14151a`, dark `#f5f6f8`): primary text.
- **Slate Secondary Text** (light `#6b6f7c`, dark `#999ca6`): metadata, subtitles, labels — always paired with a colored dot rather than colored itself.
- **Glass Card Tint** (`color-mix(in srgb, white 68%, transparent)` light / `color-mix(in srgb, white 7%, transparent)` dark): the translucent fill behind every glass surface, combined with `backdrop-filter: saturate(180%) blur(20px)`.
- **Hairline Border** (light `rgba(20,21,26,0.08)`, dark `color-mix(in srgb, white 10%, transparent)`): the single-pixel edge on every glass surface.

### Named Rules
**The Dot-Plus-Label Rule.** Every semantic state (note type, tag, status) is shown as a small color dot beside a neutral-colored text label. Color alone never carries meaning — the dot is the color channel, the label is the reading channel, and they always travel together.

**The Continuous Urgency Rule.** The timer ring's color is not a palette of discrete steps; it is `color-mix(in srgb, var(--color-urgent) {urgency%}, var(--color-accent))`, where `urgency` is a cubic ease of remaining-time progress. The ring visibly warms as time runs out rather than jumping between fixed colors — except during a break phase, where it holds flat at Break Green because there is nothing to hurry.

## Typography

**Body/Display Font:** `-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif` (the OWN-WORLD's explicit commitment to the system font's native character — this is a chosen material for this world, not a default left unset).

**Character:** A single system-native family carries every role; hierarchy comes entirely from size, weight, and tabular-numeral treatment on timers, not from a second typeface.

### Hierarchy
- **Headline** (700, 19px, tight `-0.4px` tracking): the "FocusCal" wordmark in the header — the only headline-scale text in the surface.
- **Numeral** (700, 22px in compact cards / 16px inside the hero ring, tabular-nums, `-0.3px`–`-0.4px` tracking): the countdown display. Always tabular so digits don't shift width as they tick.
- **Title** (600, 15–16px): note titles in cards and the hero widget.
- **Body** (400–500, 12–13px): subtitles, dialog copy, form field text.
- **Label** (500, 11px): type/status/tag text, date-group headings — always the smaller, neutral-colored partner to a dot.

### Named Rules
**The Tabular Timer Rule.** Any digit display representing a live countdown or duration uses `tabular-nums`. A ticking timer must never cause surrounding layout to jitter.

## Layout

The popup is a fixed 380×580px canvas (`entrypoints/popup`), also opened as a same-sized standalone `chrome.windows.create` popup window for pinned use. Content is a single vertical flex column: a shrink-0 glass header, then a scrollable region (native scrollbar hidden via `.scroll-area`, scrolling still functional) holding date-grouped note groups.

Within the scroll region, groups stack with a `10px` (`gap-2.5`) rhythm; a thin-rule date heading (a short fixed dash + a flexible hairline, both `var(--border)`) separates date groups, with "· 오늘" appended for the current date. Inside a date group, the currently-active note renders as the single full-width hero widget; every other note in that group renders as a compact card of uniform width. Card internal padding runs `px-4 pt-3.5 pb-4` (compact) vs. the hero's `px-5 pt-4 pb-[18px]` — the hero is only slightly more generous, not a different density tier.

## Elevation & Depth

This is a frosted-glass, layered-translucency system, not a flat one and not a hard-shadow one. Every surface (header, hero, card, bottom sheet, dialogs, alerts, the empty-state icon disc) shares `.glass-surface`: a translucent tinted background plus `backdrop-filter: saturate(180%) blur(20px)`, plus a soft, deeply-diffused drop shadow keyed to how "raised" the surface is. Depth is communicated by blur-and-shadow pairing, never by borders alone or by hard, offset shapes.

### Shadow Vocabulary
- **Card** (`0 1px 2px rgba(0,0,0,0.05), 0 10px 24px -12px rgba(0,0,0,0.22)`): resting compact cards and the empty-state icon.
- **Hero** (`0 2px 4px rgba(0,0,0,0.06), 0 20px 44px -16px rgba(0,0,0,0.3)`): the one active hero widget — deliberately the heaviest ambient shadow on screen, matching its role as the single thing that should read as "closest."
- **Sheet** (`0 -12px 36px -8px rgba(0,0,0,0.28)`): the bottom sheet, shadow cast upward since it enters from the bottom edge.
- **Pop** (`0 12px 36px -8px rgba(0,0,0,0.32)`): centered modal dialogs (delete confirm, alert, session-end decision).

### Named Rules
**The Inline Blur Rule.** `backdrop-filter` is applied via an inline `style` object (`glassBlur` in `src/utils/colorUtils.ts`), never as a plain CSS class rule. This project's Tailwind v4 / Lightning CSS build silently strips an unprefixed `backdrop-filter` declaration when written in `global.css`, keeping only the `-webkit-` prefix (which alone does not render blur in this Chromium build). `.glass-surface` therefore only owns `background`; any new glass surface must pair `className="glass-surface ..."` with `style={{ ...glassBlur, ... }}` or it silently renders flat and non-blurred, double-exposing whatever is stacked behind it.

## Shapes

A rounded-squircle language at two scales, plus fully-pill controls. Hero widget and the bottom sheet's top corners use the largest radius (**24px**, `--radius-hero`); every other card-like container — compact cards, dialogs, the empty-state disc's siblings — uses **20px** (`--radius-card`), matching the OWN-WORLD's 20px+ commitment. Form fields and input rows sit at **10–14px** (not tokenized as CSS variables; used as literal Tailwind arbitrary values per field). Every interactive control that is a button, chip, tag, dot, or toggle is fully rounded (`rounded-full`) — there are no sharp-cornered buttons anywhere in this system.

### Named Rules
**The Squircle-Or-Pill Rule.** A surface is either a large rounded rectangle (24px or 20px) or a fully-rounded pill/circle. There is no intermediate corner radius used for a whole container — 10–14px radii are reserved for nested form controls inside a 20px+ parent, never for a top-level card.

## Components

### Buttons
- **Shape:** fully rounded pill (`rounded-full`) at every scale, from the 44×26px settings toggle to the full-width "저장하기" save button.
- **Primary (`ActionButton primary`, save, confirm-decision):** filled cobalt (`#3a5fe0` → hover `#3151c7` → active `#2944ad`), white text, paired with a solid/checkmark-style icon (check, filled square).
- **Secondary (`ActionButton` default, cancel, back):** transparent fill, hairline border (`var(--border)`), neutral text, paired with an outline/play-style icon (play triangle, pause bars).
- **Hover/Focus:** primary buttons darken one step; secondary buttons gain the hover card tint (`--bg-card-hover`); all buttons scale to `0.97`–`0.99` on press (`active:scale-*`), never grow.

### Named Rules
**The Shape-Not-Just-Color Rule.** Primary and secondary actions are never distinguished by color alone: primary is always filled + a "commit" icon shape, secondary is always outlined + a "start/neutral" icon shape. A confirming action must be visually assignable even in grayscale.

### Cards / Containers (`NoteCardFrame`, `FinishedNoteRow`)
- **Corner Style:** 20px (`--radius-card`).
- **Background:** glass tint (`--bg-card`) + blur, per Elevation & Depth.
- **Border:** hairline `var(--border)`, except a paused-elsewhere card, whose border swaps to the paused status color (`#e0a72e`) as a quiet inline cue.
- **Internal Padding:** `16px` sides, `14px`/`16px` top/bottom.
- **Finished-state variant:** `opacity-60` glass card; the leading status glyph is a small solid-fill circle (status color) with a white SVG glyph (check / minus / chevron) — never raw text characters — chosen for guaranteed contrast against any of the three status colors.

### Signature Component: NoteHero + RingDial
The one full-width glass widget per screen state that currently holds the timer. A `RingDial` SVG progress ring (84px, 6px stroke) sits at its left, its stroke color driven by `ringColorFor()` — a continuous `color-mix` between the cobalt accent and urgent coral as remaining time shrinks, held flat at Break Green during break phases. The ring's center holds the tabular countdown numeral; to its right, a phase dot+label, note title, and subtitle stack. Order-reorder and delete controls sit top-right; primary/secondary action buttons sit bottom-right. Every other note in the same date group demotes to `NoteCardFrame`, the compact sibling of this same visual vocabulary (same radius family, same glass treatment, smaller footprint, thin linear progress bar instead of a ring).

### Inputs / Fields
- **Style:** flat-filled (`bg-primary` token, not glass) rounded rectangles (10–14px), no visible border at rest — matches the "nested control inside a glass card" role from Shapes.
- **Focus:** an inset colored ring (`shadow-[inset_0_0_0_1.5px_var(--color-accent)]`), not a border-color swap or glow — keeps the flat-fill field's silhouette unchanged on focus.
- **Selection chips (preset/tag pickers):** unselected = flat neutral fill, neutral text; selected = 16%-opacity color tint background + a 1.5px inset ring in that color, text stays neutral — the same "color signals via wash/ring, text stays neutral" logic as the Dot-Plus-Label Rule, applied to chips instead of dots.

### Navigation
No persistent nav; the header is a single glass bar (wordmark left, icon actions right: standalone-window toggle shown only outside window mode, cobalt-filled add button always present). Screen-level navigation is a bottom sheet (add note) and centered modal dialogs (delete confirm, decision flow), not routed pages.

## Do's and Don'ts

### Do:
- **Do** pair every color-carrying dot with a neutral-text label (Dot-Plus-Label Rule).
- **Do** apply `backdrop-filter` via the `glassBlur` inline-style object alongside `.glass-surface`, never as a plain CSS class declaration (Inline Blur Rule).
- **Do** drive the timer ring's color through the continuous `ringColorFor()` color-mix rather than a stepped palette, holding it flat only for the break phase.
- **Do** keep the hero widget singular — one active note gets the large glass treatment; every other note in view stays a compact card.
- **Do** use `tabular-nums` on any live-updating countdown or duration digit.

### Don't:
- **Don't** introduce a flat, opaque (non-glass) container for any card/dialog/sheet surface — glass tint + blur + hairline border is this system's only container treatment.
- **Don't** differentiate primary/secondary actions by color alone — shape (filled pill vs. outline pill) and icon style must differ too.
- **Don't** use a hard-offset, non-blurred shadow anywhere in this world; all shadows here are large, soft, and negatively-offset (ambient), matching the Shadow Vocabulary above.
- **Don't** raise a card's radius above 20px or below it for a top-level container — 24px is reserved for the hero/sheet; 20px is the card/dialog standard; nothing top-level sits between them or below them.

# Design guideline: Anthropic style for the highlighter UI

Derived from computed styles and CSS variables read on 2026-10-31 from claude.com/marketplace, code.claude.com/docs/en/overview, academy.claude.com and anthropic.com. Values are measured, not guessed. Section 8 maps every rule to this repo's tokens in `highlighter/src/ui-style.js`.

## 1. Principles
1. **Warm and flat.** Warm neutrals, hairline borders, almost no shadow, no gradients or glows.
2. **Editorial.** Serif for things people read (headings, prose), sans for chrome (labels, buttons, meta).
3. **Restraint with colour.** One clay accent, used rarely; everything else is ink and paper.
4. **Quiet motion.** Short ease-out fades, nothing that bounces.
5. **Both themes are first-class.** Same roles, inverted values.

## 2. Colour
No pure black or white in text or surfaces (`#fff`/`#000` appear on the sites only as the ends of the gray ramp).

**Neutral ramp (shared by all four sites)**
| Step | Hex | Typical use |
|---|---|---|
| 050 | `#faf9f5` | light page, light text on dark |
| 100 | `#f5f4ed` | chips, raised light surface |
| 150 | `#f0eee6` | subtle fill |
| 200 | `#e8e6dc` | hairline on light, hover fill |
| 300 | `#d1cfc5` | stronger line |
| 400 | `#b0aea5` | disabled, secondary icon |
| 500 | `#87867f` | tertiary text on dark only (3.47:1 on light fails AA) |
| 600 | `#5e5d59` | secondary body text on light |
| 700 | `#3d3d3a` | strong text on light, hairline on dark |
| 800 / 850 | `#262624` / `#1f1e1d` | raised dark surface |
| 950 | `#141413` | ink on light, page on dark |

**Accent:** clay `#d97757` (2.96:1 on paper: decoration and large marks only, never text or a required UI border), hover/interactive `#c6613f` (3.85:1), focus ring `#c46849` (3.68:1 light, 4.76:1 dark). Error `#bf4d43` (4.57:1 light, 3.83:1 dark: on dark use the tuned `--danger`, section 8).
**Supporting hues** (illustration, tags, charts; flat fills, never gradients; 2.8-3.6:1 on paper, so never text and never the only carrier of meaning): sky `#6a9bcc`, olive `#788c5d`, mineral `#629987`, plum `#827dbd`, fig `#c46686`, cactus `#bcd1ca`, heather `#cbcadb`, oat `#e3dacc`, peach `#ebc9b7`, coral `#ebcece`.

**Rules**
- Text: ink on paper; secondary text steps down the ramp (600 on light, ~`#b0aea5` on dark). Check 4.5:1 for body text, 3:1 for large text and UI borders.
- Clay marks the one thing to do next, a focus ring, or a small highlight. Not backgrounds of large areas, not decoration.
- Text on a clay fill is ink `#141413` (5.90:1), not paper (2.96:1).
- Borders that must be seen (inputs, focus) need 3:1 against the page. Hairlines at 1.2-1.7:1 (`#e8e6dc` on paper, `#3d3d3a` on ink) are decoration only.
- Status never relies on colour alone: pair with icon or word.

## 3. Typography
- **Serif** (Source Serif 4, then Georgia): reading text, and headings of content pages. Weight 400-500, tight leading (about 1.1-1.3 for headings), slight negative tracking on large sizes (-0.01em at 34px).
- **Sans** (Source Sans 3, then Arial): body, buttons, navigation, labels. 15-16px at line-height 1.5-1.6. Small headings may use 600. Titles of tool chrome (panel, dialog, editor) are sans, not serif: only text the user reads or wrote (notes, item text, help prose) is serif.
- **Mono** (ui-monospace): code and keys.
- Measured scale: display 42-44/46-48 serif; section 28/36 serif; card title 20-22 serif or sans 600-700; body 16/26; UI small 12-13 sans, weight 500, letter-spacing +0.01em.
- Measure: body lines 60ch (max 70-80ch). Weights stay at 400/500; 600+ only for small titles.
- Don't skip heading levels; don't use heading styles for non-headings.
- Use the real `…` character and curly quotes; non-breaking spaces inside key combos and units (Alt+Shift+O, 12 px); tabular numerals in aligned numbers; `text-wrap: balance` on headings.
- Copy is sentence case for headings and buttons (a deliberate choice), active voice, specific button labels, and errors that say the next step.

## 4. Spacing, radius, borders, elevation
- **Spacing** on a 4px base: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96. Group related things tightly (4-12), separate groups generously (24-48). No off-scale values.
- **Radius:** 2 / 4 / 6 / 8 / 12 / 16 / 24 (2, 6 and 24 are unused in this repo). Buttons 8 (corporate site 10), cards and callouts 16, chips fully round. Use one radius per component family.
- **Borders:** hairlines 0.5-1px; on dark `rgba(255,255,255,.1)`. Borders do the separating work that shadows do elsewhere.
- **Elevation:** flat. The only shadow seen is a card micro-shadow (`0 1px 2px` at ~5-25% black). Menus and dialogs rely on a hairline plus a dimmed overlay.

## 5. Components
- **Primary button:** inverted ink (ink fill, paper text; on dark pages paper fill, ink text). Corporate site: pad 12x24, radius 10. Product/marketplace: 12px text, weight 500, pad 4x12, radius 8.
- **Secondary button:** page-colour fill with a 1px `#3d3d3a` ring (dark) or `#e8e6dc` border (light).
- **Chip / tab:** `#f5f4ed` fill, 0.8px `#e8e6dc` border, `#3d3d3a` text, 13px, fully round.
- **Card:** raised surface (`#20201f` on dark, `#f5f4ed` on light), 16px radius, 1px hairline, no shadow beyond the micro-shadow, serif title + sans description.
- **Callout:** 16px radius, 1px hairline, tinted fill at ~10% of ink, padding 16x20, sans text 16/28.
- **Dialog/panel:** card styling plus overlay `rgba(20,20,19,.4-.5)`; title sans 500 (chrome), header separated by a hairline; content scrolls inside, header stays.
- **Lists of entries (e.g. changelog):** hairline between rows, version/meta in small muted sans, description in serif, 12px vertical padding.
- **Focus:** 2px ring in contrast colour with a 2px inner gap, always visible on keyboard focus. Skip link uses clay border.
- **Inputs:** same radius as buttons, border at 3:1 against the page (`--line-strong`, not the hairline), placeholder at 4.5:1.
- **Long and empty content:** containers truncate, clamp or wrap long text (flex children need `min-width: 0`); every list has an empty state that says what to do.

## 6. Motion and accessibility
- Durations 100-300ms; ease-out (`cubic-bezier(0,0,.2,1)` or `(.165,.84,.44,1)`); fade and small translate only.
- Respect `prefers-reduced-motion`.
- Animate only `transform` and `opacity`; never `transition: all`, list the properties.
- Panels and menus use `overscroll-behavior: contain`; controls set `touch-action: manipulation`.
- Toasts and async status go in a polite live region (`aria-live="polite"`).
- Dark theme sets `color-scheme: dark` so native controls follow; give native `<select>` explicit colours.
- WCAG 2.1 AA: contrast above, full keyboard operation, focus visible, labelled icon buttons, dialog traps and returns focus.
- Layout works from 320px to 1440px; side gutters >= 16px.

## 7. Do / don't
**Do:** warm neutrals; serif for reading; hairlines; clay sparingly; consistent radius; real content in layouts.
**Don't:** pure black/white; purple/indigo defaults; gradients, glows, heavy or layered shadows; maximum rounding everywhere; clay as a general fill; more than two weights per view; decorative colour with no meaning.

## 8. Mapping to this repo (`highlighter/src/ui-style.js`)
| Guideline | Repo token |
|---|---|
| ink `#141413` / paper `#faf9f5` | `--ink` / `--surface` (swap in dark) |
| ramp 700 `#3d3d3a` | `--ink-2` (light), `--line` (dark) |
| secondary text | `--ink-3` (`#66655f` light: darker than the sites' 600 to keep 4.5:1; `#b0aea5` dark) |
| ramp 200 / 400 / 500 | `--surface-hover` / `--ink-disabled`,`--line-hover` / `--line-strong`,`--ink-4` |
| hairline | `--line` (`#e8e6dc` light, `#3d3d3a` dark), `--divider` |
| clay + hover | `--accent` `#d97757`, `--accent-hover` `#c6613f` (defined, unused: reserved for small highlights) |
| primary button | `.btn-primary`: `--ink` fill, `--on-ink` text (paper fill on dark) |
| error | `--danger` (`#a8321a` light, `#e5867a` dark; tuned for contrast) |
| radius 4 / 8 / 12 / 16 | `--radius-md` / `--radius-button` / `--radius-lg` / `--radius-card` |
| UI small / body | `--text-sm` 12 / `--text-md` 16 (+ `--leading-*`) |
| motion | `--duration-fast/normal/slow` 100/150/300ms, `--ease-out` |
| serif reading text | `SERIF_FONT` constant (`.help-text`, notes, item text); panel and dialog titles use sans |
| overlay | `--overlay` |

**Deliberate differences (decide before changing):**
1. Fonts: the proprietary Anthropic Serif/Sans cannot be shipped in a userscript, and the stacks no longer name them. They use the free Source Sans 3 (sans) and Source Serif 4 (serif), then Arial and Georgia: sans `"Source Sans 3", Arial`, serif `"Source Serif 4", Georgia` (`SANS_FONT`, `SERIF_FONT`). This differs from the brand-guidelines skill (Poppins, Lora) by choice. The code constants in `src/ui-style.js` still need to be switched to match.
2. Supporting hues (sky, mineral, plum...) have no tokens; add one only when a feature needs a categorical colour.

## 9. Sources
Measured 2026-10-31; values may drift.
- https://claude.com/marketplace (dark; tokens `--color-*`, `--br-*`, `--sp-*`)
- https://code.claude.com/docs/en/overview (dark docs; callout 16px radius, mono code)
- https://academy.claude.com/ (dark; `--cds-*` tokens, 16px cards, micro-shadow)
- https://www.anthropic.com/ (light default; chips, 10px ink button, extended palette)

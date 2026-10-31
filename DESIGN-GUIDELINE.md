# Design guideline: Anthropic style for the highlighter UI

Derived from computed styles and CSS variables read on 2026-10-31 from claude.com/marketplace, code.claude.com/docs/en/overview, academy.claude.com and anthropic.com. Values are measured, not guessed. Section 8 maps every rule to this repo's tokens in `highlighter/src/ui-style.js`.

## 1. Principles
1. **Warm and flat.** Warm neutrals, hairline borders, almost no shadow, no gradients or glows.
2. **Editorial.** Serif for things people read (headings, prose), sans for chrome (labels, buttons, meta).
3. **Restraint with colour.** One clay accent, used rarely; everything else is ink and paper.
4. **Quiet motion.** Short ease-out fades, nothing that bounces.
5. **Both themes are first-class.** Same roles, inverted values.

## 2. Colour
Never pure `#000` / `#fff` for text or surfaces (the sites only use `#fff`/`#000` as the ends of the gray ramp).

**Neutral ramp (shared by all four sites)**
| Step | Hex | Typical use |
|---|---|---|
| 050 | `#faf9f5` | light page, light text on dark |
| 100 | `#f5f4ed` | chips, raised light surface |
| 150 | `#f0eee6` | subtle fill |
| 200 | `#e8e6dc` | hairline on light, hover fill |
| 300 | `#d1cfc5` | stronger line |
| 400 | `#b0aea5` | disabled, secondary icon |
| 500 | `#87867f` | tertiary text (fails AA on light for small text) |
| 600 | `#5e5d59` | secondary body text on light |
| 700 | `#3d3d3a` | strong text on light, hairline on dark |
| 800 / 850 | `#262624` / `#1f1e1d` | raised dark surface |
| 950 | `#141413` | ink on light, page on dark |

**Accent:** clay `#d97757`, hover/interactive `#c6613f`, focus ring `#c46849`. Error `#bf4d43`.
**Supporting hues** (illustration, tags, charts; flat fills, never gradients): sky `#6a9bcc`, olive `#788c5d`, mineral `#629987`, plum `#827dbd`, fig `#c46686`, cactus `#bcd1ca`, heather `#cbcadb`, oat `#e3dacc`, peach `#ebc9b7`, coral `#ebcece`.

**Rules**
- Text: ink on paper; secondary text steps down the ramp (600 on light, ~`#b0aea5` on dark). Check 4.5:1 for body text, 3:1 for large text and UI borders.
- Clay marks the one thing to do next, a focus ring, or a small highlight. Not backgrounds of large areas, not decoration.
- Status never relies on colour alone: pair with icon or word.

## 3. Typography
- **Serif** (Anthropic Serif; fallback Georgia): headings and reading text. Weight 400-500, tight leading (about 1.1-1.3 for headings), slight negative tracking on large sizes (-0.01em at 34px).
- **Sans** (Anthropic Sans; fallback system-ui): body, buttons, navigation, labels. 15-16px at line-height 1.5-1.6. Small headings may use 600.
- **Mono** (Paper Mono / anthropic-mono; fallback ui-monospace): code and keys.
- Measured scale: display 42-44/46-48 serif; section 28/36 serif; card title 20-22 serif or sans 600-700; body 16/26; UI small 12-13 sans, weight 500, letter-spacing +0.01em.
- Measure: body lines 60ch (max 70-80ch). Weights stay at 400/500; 600+ only for small titles.
- Don't skip heading levels; don't use heading styles for non-headings.

## 4. Spacing, radius, borders, elevation
- **Spacing** on a 4px base: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96. Group related things tightly (4-12), separate groups generously (24-48). No off-scale values.
- **Radius:** 2 / 4 / 6 / 8 / 12 / 16 / 24. Buttons 8 (corporate site 10), cards and callouts 16, chips fully round. Use one radius per component family.
- **Borders:** hairlines 0.5-1px; on dark `rgba(255,255,255,.1)`. Borders do the separating work that shadows do elsewhere.
- **Elevation:** flat. The only shadow seen is a card micro-shadow (`0 1px 2px` at ~5-25% black). Menus and dialogs rely on a hairline plus a dimmed overlay.

## 5. Components
- **Primary button:** inverted ink (ink fill, paper text; on dark pages paper fill, ink text). Corporate site: pad 12x24, radius 10. Product/marketplace: 12px text, weight 500, pad 4x12, radius 8.
- **Secondary button:** page-colour fill with a 1px `#3d3d3a` ring (dark) or `#e8e6dc` border (light).
- **Chip / tab:** `#f5f4ed` fill, 0.8px `#e8e6dc` border, `#3d3d3a` text, 13px, fully round.
- **Card:** raised surface (`#20201f` on dark, `#f5f4ed` on light), 16px radius, 1px hairline, no shadow beyond the micro-shadow, serif title + sans description.
- **Callout:** 16px radius, 1px hairline, tinted fill at ~10% of ink, padding 16x20, sans text 16/28.
- **Dialog/panel:** card styling plus overlay `rgba(20,20,19,.4-.5)`; title serif, header separated by a hairline; content scrolls inside, header stays.
- **Lists of entries (e.g. changelog):** hairline between rows, version/meta in small muted sans, description in serif, 12px vertical padding.
- **Focus:** 2px ring in contrast colour with a 2px inner gap, always visible on keyboard focus. Skip link uses clay border.
- **Inputs:** same radius as buttons, hairline border, placeholder at 4.5:1.

## 6. Motion and accessibility
- Durations 100-300ms; ease-out (`cubic-bezier(0,0,.2,1)` or `(.165,.84,.44,1)`); fade and small translate only.
- Respect `prefers-reduced-motion`.
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
| hairline | `--line` (`#cccbc8` light, `#3d3d3a` dark), `--divider` |
| clay + hover | `--accent` `#d97757`, `--accent-hover` `#c6613f` |
| error | `--danger` (`#a8321a` light, `#e5867a` dark; tuned for contrast) |
| radius 4 / 8 / 12 / 16 | `--radius-md` / `--radius-button` / `--radius-lg` / `--radius-card` |
| UI small / body | `--text-sm` 12 / `--text-md` 14 (+ `--leading-*`) |
| motion | `--duration-fast/normal/slow` 100/150/300ms, `--ease-out` |
| serif reading text | `SERIF_FONT` constant (`.help-text`, notes) |
| overlay | `--overlay` |

**Deliberate differences (decide before changing):**
1. Sites' primary button is inverted ink; here the primary action is clay-filled (`.btn-primary`, `--on-accent` ink). Kept per CLAUDE.md ("clay only for the one primary action").
2. Page type is 15-16px; this tool is dense chrome on top of other people's pages, so body is 14px and captions 12px.
3. Light hairline is `#cccbc8`, darker than site `#e8e6dc`, so borders stay visible over arbitrary page backgrounds.
4. Fonts: the proprietary Anthropic Serif/Sans cannot be shipped in a userscript, so the stacks name them first (they apply only where installed), then the free look-alikes Poppins (sans) and Lora (serif), then Arial and Georgia: sans `"Anthropic Sans", Poppins, Arial`, serif `"Anthropic Serif", Lora, Georgia` (`SANS_FONT`, `SERIF_FONT`). The install hint for Poppins and Lora was retired in 9.49.
5. Supporting hues (sky, mineral, plum...) have no tokens; add one only when a feature needs a categorical colour.

## 9. Sources
- https://claude.com/marketplace (dark; tokens `--color-*`, `--br-*`, `--sp-*`)
- https://code.claude.com/docs/en/overview (dark docs; callout 16px radius, mono code)
- https://academy.claude.com/ (dark; `--cds-*` tokens, 16px cards, micro-shadow)
- https://www.anthropic.com/ (light default; chips, 10px ink button, extended palette)

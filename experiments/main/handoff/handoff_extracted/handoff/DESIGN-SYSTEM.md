# Design System · Cobalt

> Visual language for the main study. Committed Cobalt direction. All tokens live in `prototype/styles.css` under `:root` and `.fm-*` classes.

## Design principles

1. **Type does the work.** Hierarchy comes from size/weight/color, not from boxes or decorations.
2. **Neutral backgrounds.** Warm off-white `#F4F3EE` — not cool, not blue-tinted.
3. **One accent, used quietly.** Navy `#2E4F8B` for the primary affordance and the question-number tag. Warm tan `#B58A56` for the filled-state input border (so the navy isn't doing all the visual work).
4. **No decorative chrome.** No quote marks around the utterance, no chat bubbles, no SVG glyphs next to inputs, no progress dots.
5. **Real research instrument.** Looks like a serious lab study, not a SaaS demo. Section + trial progress always visible at the top.

---

## Tokens

### Colors

| Token | Hex | Role |
|---|---|---|
| `--c-bg` | `#F4F3EE` | Page background (warm neutral off-white) |
| `--c-card` | `#FFFFFF` | Card surface |
| `--c-ink` | `#161B2E` | Primary text (deep navy black) |
| `--c-muted` | `#4A536B` | Secondary text |
| `--c-faint` | `#8A91A2` | Hints, placeholders, meta labels |
| `--c-hairline` | `#E2E1DC` | Borders, dividers |
| `--c-accent` | `#2E4F8B` | Primary accent (navy) |
| `--c-accent-bg` | `rgba(46,79,139,.08)` | Focus ring, accent button shadow |
| `--c-accent-text` | `#FFFFFF` | Text on accent surfaces |
| `--c-secondary` | `#B58A56` | Filled-state border (warm tan) |
| `--c-success` | `#4F7A52` | Correct comprehension answer |
| `--c-warn` | `#B45A2E` | Wrong comprehension answer, warning copy |

### Typography

All fonts loaded from Google Fonts. Pick exactly these — not Inter, not Source Serif, not Fraunces.

| Token | Family | Use |
|---|---|---|
| `--c-serif` | **DM Serif Display** | Titles, utterance text |
| `--c-sans` | **Schibsted Grotesk** | Body, UI, buttons, inputs |
| `--c-mono` | **JetBrains Mono** | Labels, eyebrows, completion code, progress label |

Google Fonts import (already in `prototype.html`):

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap">
```

### Type scale

| Use | Size | Weight | Line-height | Letter-spacing |
|---|---|---|---|---|
| **Title (big)** `.fm-title` — welcome screen | 44px | 400 | 1.05 | -1.5px |
| **Title (small)** `.fm-title.small` — most other titles | 26px | 400 | 1.15 | -0.5px |
| **Utterance** `.fm-utt` — the "Can you…?" line | 27px | 400 | 1.2 | -0.5px |
| **Scenario** `.fm-scenario` — italic vignette text | 17px | 400 italic | 1.6 | — |
| **Body** `.fm-body` | 15.5px | 400 | 1.65 | — |
| **Body fine** `.fm-body.fine` | 13.5px | 400 | 1.65 | — |
| **List item** `.fm-list li` | 15px | 400 | 1.6 | — |
| **Field label** `.fm-field-lbl` | 12.5px | 600 | — | -0.05px |
| **Question prompt** `.fm-q-prompt` | 12.5px | 500 (muted color) | 1.55 | -0.05px |
| **Textarea text** `.fm-ta` | 15px | 400 | 1.6 | — |
| **Input text** `.fm-input` | 14.5px | 400 | — | — |
| **Eyebrow** `.fm-eyebrow` | 10px | 700 caps | 1.4px tracking | accent color |
| **Section label** `.fm-section-label` | 10px | 700 caps | 1.4px tracking | faint color |
| **Progress label** `.fm-top-section/-trial` | 10px | 600/700 caps | 1.4px tracking | mono |
| **Q number tag** `.fm-q-num` | 10px | 700 caps | 1.2px tracking | mono, accent color |
| **Brand strip** `.fm-brand` | 10px | 600 caps | 1.6px tracking | mono |

### Spacing

Use 4px multiples. The card uses a baseline grid of ~22px vertical rhythm.

| Token | Value | Notes |
|---|---|---|
| Card padding | `48px 56px 32px` | top/right=bottom/left ratio is intentional |
| Card border | `1px solid var(--c-hairline)` | |
| Card radius | `6px` | sharp — not pillowy |
| Card max-width | `720px` | |
| Stage padding | `56px 32px 40px` | breathing room around card |
| Section gap (within card) | `20–28px` | |
| Input padding | `12px 14px` | (`11.5px 13.5px` when `.filled` to compensate for thicker border) |

### Shadows

One shadow recipe, used on the card only:

```css
box-shadow: 0 1px 0 rgba(0,0,0,.02), 0 14px 50px rgba(16,18,30,.05);
```

---

## Components

### Brand strip (`.fm-brand`)
Top-of-page lab label. Always shows `Social Interaction Lab · Stanford University` in mono caps.

```html
<div class="fm-brand">
  <span class="fm-brand-lab">Social Interaction Lab</span>
  <span class="fm-brand-sep">·</span>
  <span class="fm-brand-uni">Stanford University</span>
</div>
```

### Progress bar (`.fm-top`)
Below the brand. Two rows:

1. **Label row** — section name on the left (`SECTION 04 / 06 · SCENARIOS`), trial label on the right (`TRIAL 07 / 30`).
2. **Bar** — 3px tall, hairline track, navy fill, vertical tick marks at each section boundary.

The bar fill is weighted by section weight (so the scenarios section spans ~60% of the bar width). Within the scenarios section, fill grows by `trialIdx / trialTotal`.

See `prototype.jsx` → `progressInfo()` for the calculation.

### Card (`.fm-card`)
The single container for screen content. Always centered, always 720px max-width.

### Eyebrow (`.fm-eyebrow`)
Tiny mono accent-colored text above the title — sets the tone for the screen (e.g. `— about this task —`, `— quick check —`).

### Title (`.fm-title` / `.fm-title.small`)
Display serif (DM Serif Display). Big for welcome, small for everything else.

### Body (`.fm-body`)
Schibsted Grotesk. Body uses `--c-muted`; `em` is italic + ink; `strong` is bold + ink.

### Meta strip (`.fm-meta`)
Three-column grid showing Time / Payment / Scenarios on the welcome screen. Bordered top + bottom with hairlines.

### Consent (`.fm-consent`)
A clickable row: 18×18 checkbox + body text. Checked state shows navy fill + white checkmark.

### List (`.fm-list`)
Reset `<ul>` with `→` arrows in accent color as bullets.

### Field (`.fm-field` + `.fm-field-lbl` + `.fm-input`)
Standard label-above-input. `.fm-input` is a single-line text input; on focus, border goes to navy + 3px accent-bg ring. When non-empty, gets the `.filled` class → warm tan 1.5px border (compensated padding so layout doesn't shift).

### Textarea (`.fm-ta`)
Same focus/filled treatment as input. Min-height 80px, resizes naturally.

### Trial form (`.fm-card` containing `.fm-scenario` + `.fm-utt` + 2 `.fm-q`)
**The key UX detail**: Box 02 is hidden initially with class `.fm-q-reveal`. When the participant types in box 01 *and pauses for ~700ms*, the class `.in` is added, triggering:
- `max-height: 0 → 280px` (slide down)
- `opacity: 0 → 1`
- `transform: translateY(-6px) → 0`
- `margin-bottom: 0 → 20px`

Transitions over ~480ms with `cubic-bezier(.2,.8,.2,1)`. See `.fm-q-reveal` in `styles.css` and the `useEffect` in `TrialForm` in `prototype.jsx`.

### Practice tag (`.fm-practice-tag`)
Soft tan pill at top of the card body. Mono caps, "practice — not recorded".

### Radio group (`.fm-radio-group` + `.fm-radio`)
Used for the comprehension check. Each row: 16×16 circle dot + text. Selected state shows colored border + filled dot (green if correct, orange-red if wrong). Both states have a subtle tinted background.

### Demo inset (`.fm-demo`)
Used in the walkthrough screen. Dashed border with a small "example trial" tag floating on the top edge. Contains scenario + utterance + two fake answer rows. The typing animation:
- `fm-demo-ans.typing` shows a blinking `▏` caret (keyframe `fmCaret`)
- `fm-demo-ans.empty` shows placeholder dots in faint italic

### Buttons (`.fm-btn`, `.fm-btn.ghost`)
- Primary: navy bg, white text, 4px radius, navy-tinted shadow.
- Disabled: `opacity .35`, no shadow, `cursor: not-allowed`.
- Ghost: transparent, muted color text, hover → ink color. Used for "Back".

### Footer (`.fm-foot`)
Row at bottom of card. Hairline border on top. Left = small hint text in mono caps. Right = primary button (or Back ghost + Primary).

### Success badge (`.fm-success-badge`)
56px circle in soft success-tinted background with a checkmark drawn via CSS borders. Shown on the completion screen.

### Code block (`.fm-code`)
Centered mono text in a dashed neutral box. Used for the completion code.

### Restart badge (positioned fixed)
Bottom-right of every screen in the **prototype only** — dark pill that says "demo · restart ↺". **Remove this for production.**

---

## States summary

| State | Treatment |
|---|---|
| `:focus` (inputs) | Border → navy, bg → white, 3px navy-bg ring |
| `.filled` (inputs) | Border → tan (1.5px), bg → white, padding shrunk by 0.5px to compensate |
| `:disabled` (buttons) | `opacity: .35`, no shadow, `cursor: not-allowed` |
| `.fm-radio.selected.correct` | Green border + tinted bg + green dot |
| `.fm-radio.selected.wrong` | Warn-orange border + tinted bg + orange dot |
| `.fm-q-reveal.in` | Slide down + fade in (480ms cubic-bezier) |
| Hover (`.fm-btn`) | No change — keep the button still |
| Hover (`.fm-btn.ghost`) | Color → ink |

---

## Anti-patterns (avoid)

- ❌ Quote marks around the utterance (it's not a literal quotation, it's a moment of speech)
- ❌ Chat bubbles or speech-bubble shapes
- ❌ SVG icons next to inputs
- ❌ Theme strips above cards (used during exploration; removed for production)
- ❌ Bright saturated accents (we tried — they read as "AI demo")
- ❌ Gradient backgrounds
- ❌ Rounded pill cards (sharp 6px radius is intentional)
- ❌ Decorative `—` overlines on every screen (use `.fm-section-label` sparingly)

---

## Responsive

The prototype targets desktop (1100px+). Mobile is **blocked at entry** (see `INFRASTRUCTURE.md`). Below 800px viewport width, show the mobile-block screen instead. No mobile breakpoints needed.

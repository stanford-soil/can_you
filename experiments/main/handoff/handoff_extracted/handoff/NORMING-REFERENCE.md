# Norming Study Reference

> Specific files Claude Code should read from `norming_study/` and what to extract from each. The norming study is the working reference for infrastructure.

The norming study lives at: `can_you/experiments/norming_study/` (in the user's local repo).

---

## Files to read

### `norming_study/index.html`
**Look for:**
- Font import order
- Script load order (Turnstile, jsPsych, etc.)
- The order in which UI is initialized
- Any meta tags or polyfills

**Use to build:** `main_study/index.html` skeleton (similar structure, new styles + scripts).

---

### `norming_study/joint/index.html`
**Look for:**
- Container DOM structure
- Turnstile widget placement
- Consent + viewport check ordering

**Use to build:** Welcome screen wrapper in production.

---

### `norming_study/joint/js/main.js` ⭐ most important
This is the source of truth for ALL infrastructure. Search for:
- `turnstile` / `onTurnstile` — Turnstile integration
- `datapipe` / `pipe.jspsych` — DataPipe upload
- `roundtable` — Roundtable handoff
- `requestFullscreen` / `fullscreenchange` — Fullscreen logic
- `visibilitychange` — Tab visibility
- `localStorage` — Persistence
- `halfway` — Halfway save trigger
- `idle` — Idle warning
- `checkMobile` / `isMobile` — Mobile blocking
- `resize` — Viewport lock
- `logToBrowser` — Event logging

**Mirror each pattern in `main_study/joint/js/main.js`.** Don't copy-paste blindly — the React/jsPsych structure is different. But preserve the **logic** (timing, thresholds, error handling).

---

### `norming_study/joint/js/trials.js`
**Look for:**
- How a trial is structured at the data level (`itemID`, `scenario`, `utterance`, response fields)
- How counterbalance condition is applied per trial
- How trial state is saved to the participant record

**Use to build:** The trial loop in `main_study`. Note we are NOT reusing the visual trial UI — that's totally new (see `prototype/prototype.jsx` → `TrialForm`). But the data structure should match.

---

### `norming_study/config/turnstile.md`
**Look for:**
- Production site key (`0x4AAAAAAA…`)
- Cloudflare dashboard reference
- Any setup notes specific to the lab

**Use:** The exact same site key in `main_study` Turnstile init.

---

### `norming_study/css/style.css`
**Look for:** Existing styling — useful for understanding scope/structure but **DO NOT inherit visual style** from this file. The Cobalt design language replaces it entirely.

**Use:** Reference only.

---

### `norming_study/stimuli/stimuli_full_study.js`
**Look for:** The 100 items, their shape, their item IDs.

**Use:** Copy this file unchanged into `main_study/stimuli/`. We're sampling from the same set.

---

## What to NOT copy from norming

- ❌ Visual style — totally new design language in main study (see `DESIGN-SYSTEM.md`)
- ❌ Trial UI components — new `TrialForm` with slide-in reveal
- ❌ DataPipe experiment ID — create a new one for `whyask_main`
- ❌ Roundtable endpoint — create a new one for `whyask_main`
- ❌ `experimentName: "whyask_norming"` in the data — set to `"whyask_main"`

---

## What the norming study does that THIS study doesn't

- Waffle-grid response interface — replaced by 2× free-text textareas
- Speed-toast warning — keep this, but adjust threshold for typing speed
- AW/WA counterbalance — keep the SAME pattern; new study has the same 50/50 split
- Halfway save at trial 15 — keep at 15 (matches norming)

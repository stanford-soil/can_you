# Implementation Plan

> Recommended build order for Claude Code. Each step has a verification gate. Total estimated time: ~1.5–2 days of focused implementation if mirroring `norming_study` aggressively.

---

## Before you start

**Read in this order:**
1. `README.md` — orientation
2. `SPEC.md` — what the study does
3. `CONTENT.md` — all visible copy
4. `DESIGN-SYSTEM.md` — visual language
5. `INFRASTRUCTURE.md` — every infra piece with code patterns
6. `DATA-SCHEMA.md` — output shape

**Then open and read the working prototype:**
- `prototype/prototype.html`, `prototype/prototype.jsx`, `prototype/styles.css`

**Then open the reference norming study** (Claude Code can read this from the user's local repo):
- `norming_study/index.html`
- `norming_study/joint/index.html`
- `norming_study/joint/js/main.js` (full file — this is the source of truth for infra)
- `norming_study/joint/js/trials.js`
- `norming_study/config/turnstile.md`
- `norming_study/stimuli/stimuli_full_study.js`

---

## Step 0 · Set up the project skeleton

1. Create `can_you/experiments/main_study/` next to `norming_study/` (same parent folder).
2. Copy the **folder structure** from norming (not contents — that comes later):
   ```
   main_study/
   ├── index.html
   ├── joint/
   │   ├── index.html
   │   └── js/
   │       ├── main.js
   │       └── trials.js
   ├── config/
   │   └── turnstile.md   (reference norming's; same site key)
   ├── css/
   │   └── style.css
   ├── stimuli/
   │   └── stimuli_full_study.js   (copy unchanged from norming)
   └── README.md          (project-level — not the handoff README)
   ```
3. Update any package.json / build config to point at `main_study` rather than `norming_study`.

**Verify**: `npm run dev` (or equivalent) starts and serves `main_study/index.html`.

---

## Step 1 · Wire up the design system

1. Replace `main_study/css/style.css` with the contents of `prototype/styles.css` (extract only the `.fm-*` rules + `:root` tokens + brand strip + revealed-question rules — drop earlier exploration rules).
2. Add the Google Fonts `<link>` to `index.html`:
   ```html
   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap">
   ```
3. Render a single welcome card in a sandbox HTML to verify the fonts + colors load.

**Verify**: side-by-side with `prototype/prototype.html`, the welcome card looks identical.

---

## Step 2 · Port the screens

Port each of the 9 screens from `prototype/prototype.jsx` into the production framework. Stay faithful to:
- The exact copy in `CONTENT.md`
- The exact validation rules in `SPEC.md`
- The transitions / states in `DESIGN-SYSTEM.md`

**Order:**
1. `Shell` component (brand strip + progress bar) — used by every screen
2. Welcome
3. Instructions
4. Walkthrough (animated typing — see § "Walkthrough" in `SPEC.md` for timing)
5. `TrialForm` component (reusable; used by practice + main trials)
6. Practice trial
7. Comprehension check
8. Main trial (uses `TrialForm`; cycles through sampled stimuli)
9. Reflection
10. Demographics
11. Completion

**Pay special attention to:**
- `TrialForm` box-02 slide-in reveal (700ms pause detection on box 01 input).
- `Shell` progress bar calculation (see `progressInfo()` in prototype; weight by section duration).
- Walkthrough button is disabled until BOTH animations finish.
- Comprehension check feedback colors (red wrong / green correct).

**Verify**: click through end-to-end with 5 sample stimuli. Behavior matches the prototype.

---

## Step 3 · Hook up real stimuli

1. Copy `norming_study/stimuli/stimuli_full_study.js` into `main_study/stimuli/` unchanged.
2. Implement `sampleStimuli(participantID)`:
   ```js
   function hashStr(s) {
     let h = 2166136261;
     for (let i = 0; i < s.length; i++) {
       h ^= s.charCodeAt(i);
       h = (h * 16777619) >>> 0;
     }
     return h;
   }
   function mulberry32(seed) {
     return function() {
       let t = seed += 0x6D2B79F5;
       t = Math.imul(t ^ (t >>> 15), t | 1);
       t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
       return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
     };
   }
   function sampleStimuli(participantID, n = 30) {
     const seed = hashStr(participantID);
     const rng = mulberry32(seed);
     const all = STIMULI_DATA.items.slice();
     // Fisher–Yates partial shuffle
     for (let i = all.length - 1; i > all.length - 1 - n; i--) {
       const j = Math.floor(rng() * (i + 1));
       [all[i], all[j]] = [all[j], all[i]];
     }
     return all.slice(-n).reverse();  // last n, in shuffle order
   }
   ```
3. Save the sampled list + seed to `participantRecord.stimuliShown` and `participantRecord.rngSeed`.

**Verify**: refresh with `?PROLIFIC_PID=test123` twice; same 30 items in the same order.

---

## Step 4 · Counterbalance order condition (AW / WA)

1. Assign condition from the participantID hash:
   ```js
   function assignCondition(participantID) {
     return (hashStr(participantID) % 2 === 0) ? "AW" : "WA";
   }
   ```
2. In `TrialForm`, swap which question goes in box 01 vs box 02 based on `orderCondition`:
   - **AW**: box 01 = interpretation, box 02 = response
   - **WA**: box 01 = response, box 02 = interpretation
3. The slide-in reveal always applies to box 02 (whichever question that is).
4. Save `order` per trial in the data (`order: "AW" | "WA"`).
5. Update `CONTENT.md` prompts based on condition — see § 6 in `CONTENT.md`.

**Verify**: `assignCondition("test123")` and `assignCondition("test456")` return different values; UI swaps correctly.

---

## Step 5 · Wire up infrastructure

Follow `INFRASTRUCTURE.md` exactly. Each piece has a section number + code pattern.

Implementation checklist (each links to an INFRASTRUCTURE.md section):

- [ ] § 1 · URL params captured from Prolific
- [ ] § 2 · Turnstile widget on welcome screen
  - [ ] Site key matches norming
  - [ ] Begin button disabled until token received
  - [ ] Token saved in participantRecord
  - [ ] Error callback shows refresh prompt
- [ ] § 3 · DataPipe upload function
  - [ ] New experiment ID for whyask_main
  - [ ] Retry logic with exponential backoff
  - [ ] Failed-upload queue in localStorage
- [ ] § 4 · Roundtable session + completion ping
- [ ] § 5 · Entry-time browser/device check
  - [ ] Mobile UA detection
  - [ ] Viewport ≥ 1024 × 600
  - [ ] Browser allowlist
  - [ ] Storage availability check
  - [ ] Block screens for each failure mode (copy in CONTENT.md)
- [ ] § 6 · Mid-study viewport lock overlay
- [ ] § 7 · Fullscreen request on Begin
  - [ ] Exit detection + non-blocking banner
- [ ] § 8 · Idle warning toast (30s)
- [ ] § 9 · Tab visibility logging
- [ ] § 10 · Halfway save at trial 15
  - [ ] Network upload
  - [ ] localStorage backup
- [ ] § 11 · localStorage persistence + resume splash
- [ ] § 12 · Comprehension check gating
- [ ] § 13 · Completion code generation
- [ ] § 14 · Error boundary
- [ ] § 15 · `logEvent` helper used consistently

**Verify each** by walking the entry flow with that piece active.

---

## Step 6 · Final UI polish

Once all infra is wired, take a fresh walkthrough and confirm:

1. **Brand strip** shows on every screen and never reflows the layout below.
2. **Progress bar** advances smoothly across the full study — 0% at welcome, ~100% at completion.
3. **Trial-progress label** ("trial 07 / 30") appears only during main trials.
4. **Filled-state borders** (warm tan) show only when input has content; not on focus alone.
5. **Box 02 slide-in** triggers cleanly after ~700ms pause. Doesn't fight typing momentum.
6. **Continue button** stays disabled until validation passes; enables instantly when it does.
7. **Walkthrough typing** caret blinks during typing, disappears when typing stops.
8. **Comprehension** wrong-feedback turns to right-feedback instantly when the participant picks the correct option.
9. **No "demo · restart ↺" badge** in production (prototype only).
10. **No `5 sample stimuli`** copy in welcome (prototype shows 5; production says 30).

---

## Step 7 · Data integrity testing

1. Run a full end-to-end pilot session yourself. Inspect the DataPipe blob.
2. Confirm every field listed in `DATA-SCHEMA.md` is present and well-formed.
3. Specifically verify:
   - `stimuliShown` has 30 unique itemIDs.
   - `trials` has 30 records, each with non-empty `interpretation` and `response`.
   - `trials[i].order` matches participant-level `orderCondition` for all i.
   - `events` includes at least: `tab_hidden`, `tab_visible` if you switched tabs.
   - `comprehension.attempts` is correct.
   - `timestamps` are monotonically non-decreasing.
4. Test error paths:
   - Refresh mid-study → resume splash appears, state restores correctly
   - Refresh after completion → "Start over" path (no resume)
   - Disable network for halfway save → failed upload queued in localStorage
   - Tab switch during a trial → `tab_hidden` / `tab_visible` events logged
   - Resize window below 1024px during trials → overlay appears, dismisses on resize back
   - Exit fullscreen → banner appears, banner dismisses on re-enter
   - Wait 30s on a trial → toast appears
5. Run on Chrome, Safari, Firefox, Edge — each should work cleanly.

---

## Step 8 · Pilot (n=5)

1. Set up a Prolific listing for 5 participants.
2. Use the production URL — not a test version.
3. Monitor DataPipe submissions in real time.
4. After all 5 complete: download blobs, sanity-check interpretations + responses.
5. Note any participant feedback in Prolific comments.
6. Fix anything that surfaces.

---

## Step 9 · Launch (n=150)

1. Set Prolific listing to 150 participants, single submission per participant.
2. Set pay to $3.00 (≈ $8/hr at 22 min).
3. Monitor first 10 submissions for issues before opening the rest.
4. Pull data from DataPipe daily; verify integrity.

---

## What you should NOT do

- ❌ Don't restyle the prototype. Match it pixel-close.
- ❌ Don't add features not in `SPEC.md`.
- ❌ Don't merge halfway-save into the final-save. They are separate uploads.
- ❌ Don't paraphrase the copy in `CONTENT.md`. Use the exact strings.
- ❌ Don't reuse the norming DataPipe / Roundtable / OSF IDs — create new ones.
- ❌ Don't keep the "demo · restart ↺" badge in production.
- ❌ Don't push to Prolific without running the full Step 7 checklist.
- ❌ Don't change the Turnstile site key — same as norming.

---

## Open questions / TBDs for the user

These need answers BEFORE launch:

- DataPipe experiment ID for `whyask_main` (create one — needs user action)
- Roundtable endpoint ID for `whyask_main` (create one — needs user action)
- Pay rate (assuming $3.00 — confirm)
- Wave 1 N (assuming 150 — confirm)
- Researcher email for error screens
- Final consent form text (modal or new tab)
- OSF pre-registration URL (link from welcome screen footer?)
- Whether to support keyboard nav for back/continue (⌘↵, ⌘← etc) — currently only enter-to-submit in textareas is implied

# Implementation Plan

> Recommended build order for Claude Code. Each step is independently verifiable before moving on. Total ~1.5–2 days of focused implementation if mirroring `norming_study` aggressively.

---

## Step 0 · Set up the project skeleton

1. Copy `norming_study/` as the starting template. Rename folder `main_study/`.
2. Update package metadata to `whyask_main`.
3. Remove norming-specific stimuli logic — we'll re-add a simpler version. Keep the infra (Turnstile, DataPipe, Roundtable, browser check, fullscreen, idle warning, halfway save).
4. Replace the entire UI layer. **Do not try to skin the norming UI** — the new design language is different enough that it's faster to start from the prototype.

**Verify**: `npm run dev` (or equivalent) starts and loads a placeholder page.

---

## Step 1 · Wire up the design system

1. Copy `prototype/styles.css` into the project's CSS.
2. Import the three Google Fonts (DM Serif Display, Schibsted Grotesk, JetBrains Mono).
3. Add `:root` tokens and `.fm-*` rules.

**Verify**: in a sandbox HTML, render the welcome card and check it matches `prototype/prototype.html` pixel-close.

---

## Step 2 · Port the screens

Port each of the 9 screens from `prototype/prototype.jsx` into the production framework. The state machine logic is in `App`. Each screen has clear validation rules — see `SPEC.md` per screen.

Order:
1. Brand strip + progress bar (`Shell` component) — used by every screen
2. Welcome (consent)
3. Instructions
4. Walkthrough (animated typing)
5. Practice trial (reusable `TrialForm`)
6. Comprehension check
7. Main trial (uses `TrialForm` + cycles through stimuli)
8. Reflection
9. Demographics
10. Completion

**Each must pass:**
- Validation rules match `SPEC.md`
- Back navigation works (welcome has no back)
- Forward navigation only when valid
- The "box 02 slides in after pause in box 01" reveal works (see `DESIGN-SYSTEM.md` → Trial form)

**Verify**: click through end-to-end with sample stimuli (5 trials). Match the prototype's behavior.

---

## Step 3 · Hook up real stimuli

1. Copy `norming_study/stimuli/stimuli_full_study.js` into `main_study/stimuli/`.
2. Implement `sampleStimuli(participantID)`:
   - Seed a PRNG with a hash of `participantID`.
   - Sample 30 items without replacement from the 100 in `STIMULI_DATA.items`.
   - Return them in randomized order.
3. Pass the sampled list to the trials section.

**Verify**: refresh the page with a fixed `?PROLIFIC_PID=xxx` and confirm the same 30 items in the same order each time.

---

## Step 4 · Counterbalance order condition (AW / WA)

1. Assign `orderCondition` = `AW` or `WA` based on a deterministic hash of the participantID (so 50/50 split across participants, but reproducible per ID).
2. In `TrialForm`, swap box 01 and box 02 labels + content based on condition:
   - **AW**: box 01 = interpretation, box 02 = response
   - **WA**: box 01 = response, box 02 = interpretation
3. The slide-in reveal applies to box 02 in both conditions.
4. Save `orderCondition` and `order` per trial in the data.

**Verify**: hash two different prolific IDs and confirm one shows AW and one shows WA.

---

## Step 5 · Wire up infrastructure

Mirror from norming:

- [ ] Cloudflare Turnstile on welcome screen (block Begin until token received)
- [ ] DataPipe client + new experiment ID for `whyask_main`
- [ ] Roundtable handoff
- [ ] Browser + viewport + mobile check at entry
- [ ] Fullscreen request on Begin
- [ ] Sidebar / viewport mid-study lock
- [ ] Idle warning toast (30s) + idle save (2min)
- [ ] Tab visibility event logging
- [ ] Halfway save at trial 15
- [ ] localStorage persistence + resume prompt
- [ ] Comprehension check gating
- [ ] Completion code generation + Prolific redirect

**Verify** each box on a fresh participant flow.

---

## Step 6 · Polish + data integrity

1. Run a full pilot session yourself end-to-end (consent → 30 trials → completion). Verify the DataPipe blob has every field listed in `DATA-SCHEMA.md`.
2. Test error paths:
   - Turnstile fails
   - Network drops mid-submission
   - Tab switched during a trial
   - Window resized below threshold
   - Fullscreen exited
3. Test the resume flow: refresh at trial 10, confirm state restores.
4. Confirm mobile UA shows the block screen.

**Verify**: data blob from your pilot run is well-formed and complete.

---

## Step 7 · Pilot (n=5)

1. Recruit 5 friends on Prolific (or via direct link) at the real pay rate.
2. Confirm data lands in DataPipe.
3. Spot-check interpretation/response texts for sense.
4. Review timings (per-trial, total).
5. Fix anything that surfaces.

---

## Step 8 · Launch (n=150)

Single batch. Set Prolific to single-submission-per-participant. Monitor first 10 submissions.

---

## What lives where

| Code area | File(s) |
|---|---|
| Routing / state machine | `App` component in `prototype.jsx` |
| Shell (brand + progress bar) | `Shell` component |
| Trial form (with slide-in) | `TrialForm` component |
| Stimuli sampling | new — port from logic implied by `SPEC.md` |
| Order counterbalancing | new — see Step 4 |
| Infrastructure (Turnstile, DataPipe, etc.) | mirror `norming_study` |
| Stimuli data | copy of `norming_study/stimuli/stimuli_full_study.js` |

---

## Open questions / TBD

- DataPipe experiment ID for `whyask_main` (create one)
- Roundtable endpoint for main study (create one)
- Pay rate ($3.00 assumed — confirm)
- Wave 1 N (150 assumed — confirm with Misha)
- Mobile block copy (write final version before launch)
- Consent form text (link or modal — write final version before launch)
- Pre-registration on OSF (write before launch)

---

## Don't forget

- 🚫 **Remove the "demo · restart ↺" badge** from the production build. It's positioned-fixed in `Shell` and only useful for the prototype.
- 🚫 Remove the "30 short items" → it currently says 5 in the prototype welcome screen meta. The prototype is intentionally short; production says 30.
- ✅ Save `turnstileToken` in the data blob so DataPipe / our pipeline can verify.
- ✅ Generate a fresh `completionCode` per session — don't reuse across participants.
- ✅ Wire the completion screen redirect to use the actual Prolific URL with the participant's code as a query param.

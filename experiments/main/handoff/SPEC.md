# Study Specification

## Purpose

Measure how participants interpret *"Can you…?"* questions in everyday contexts, and what they would do in response. Both DVs are collected as free text and clustered / LLM-tagged downstream. Combined with the `norming_study` priors, the data informs a model of speaker meaning + listener action.

## Target population

- Recruited via **Prolific**.
- 18+, native English speakers.
- Desktop only (mobile blocked at entry).
- Target ~150 participants for the first wave (final N depends on counterbalancing + dropouts).

## Section structure (6 top-level sections; 9 screens internally)

The progress bar shows the **6 top-level sections**:

| # | Section name | Contains screens | Approximate time |
|---|---|---|---|
| 1 | welcome      | consent                                  | ~1 min |
| 2 | how it works | instructions + animated walkthrough      | ~2 min |
| 3 | practice     | practice trial + comprehension check     | ~1 min |
| 4 | scenarios    | 30 main trials                           | ~15 min |
| 5 | wrap-up      | reflection + demographics                | ~3 min |
| 6 | complete     | thank-you + Prolific handoff             | ~0.5 min |

**Total ≈ 22 min.** Section weights for the progress bar:
```
welcome=1, how it works=2, practice=1, scenarios=12, wrap-up=2, complete=0.5
```

The bar fills proportionally to time spent. The scenarios section dominates (~60% of the bar) so the visual progress feels accurate during the bulk of the study.

---

## Screen-by-screen

### 1. Welcome (consent)
- Header: "Everyday Questions"
- Subtitle: short research-study label
- Body: two short paragraphs explaining the study
- Meta strip: Time / Payment / Scenarios (~22 min · $3.00 · 30 short items)
- Single consent checkbox — must be checked to enable "Begin study"
- Optional "View full consent form" ghost button (opens modal or new window)

### 2. Instructions
- Header: "What \"Can you…?\" can mean"
- Two short paragraphs explaining the phenomenon (request vs. ability)
- Short list: "for each scenario, you'll — tell us what you took the question to mean — tell us how you would respond"
- One short closing paragraph: "Answer in your own words — a sentence or two each. There's no right answer."
- Continue button (always enabled)
- Back button (returns to welcome)

### 3. Walkthrough (animated demo)
- Header: "Here's what a trial looks like"
- No body copy — the demo speaks for itself
- Demo box (dashed border, "example trial" tag):
  - Scenario text
  - Utterance text
  - Box 01 with a sample interpretation that **types itself in** character-by-character (~35 ms per char, caret animation)
  - After a short pause (~600 ms), box 02 begins typing
- "Try a practice trial" button — **disabled until both animations finish**

### 4. Practice trial
- Same UI as a main trial but tagged with a "practice — not recorded" pill
- Practice scenario: <em>"You're at a friend's apartment helping them pack. The boxes are stacked near the door. They turn to you and say: Can you grab the tape?"</em>
- Free-text response × 2 (interpretation + response)
- Continue button enabled only when both fields are non-empty (`.trim().length > 0`)
- **Box 02 slides in from above after the participant pauses typing in box 01 for ~700 ms** (see Components → Trial form in `DESIGN-SYSTEM.md`)

### 5. Comprehension check
- Single multiple-choice question gating progression
- Question: <em>"When someone asks \"Can you give me a quick trim?\" — which response goes in the first box?"</em>
- Options:
  - **Correct**: "what they meant by asking the question"
  - **Wrong**: "what I would say or do in response"
- Clicking the wrong option shows red warning copy
- Clicking the correct option shows green confirmation
- Continue enabled only when correct option is selected

### 6. Main trials (30 trials)
- **Stimuli**: 30 items sampled from the 100-item stimulus set (same set as norming).
- **Sampling**: random without replacement per participant. Same RNG seeded by participant ID for reproducibility.
- **Order condition** (between-subject, counterbalanced 50/50):
  - **AW**: interpretation first, then response  ("ask then warrant")
  - **WA**: response first, then interpretation
- **Within a participant, order is fixed** across all 30 trials.
- Same trial UI as practice (without the practice tag).
- The dynamic "box 02 slides in" reveal applies here too — box order swaps if condition = WA.
- Continue enabled only when both fields have content.
- Trial progress label shown on right side of top bar: "trial 07 / 30".

### 7. Reflection (wrap-up part 1)
- Two open-ended questions:
  - Q1: "how did you decide what people meant by their questions?"
  - Q2: "how did you tell apart questions about ability vs. requests for action?"
- Both required.

### 8. Demographics (wrap-up part 2)
- Header: "A bit about you"
- Sub: "Optional, but helpful for analyzing the data. All responses remain anonymous."
- Fields:
  - Age (required, free input)
  - Gender (optional, free input)
  - Native language (required)
  - Highest level of education (required)
- Submit button enabled when required fields filled.

### 9. Completion
- Success checkmark badge
- Header: "Thank you"
- Body: short thanks
- Completion code in a dashed mono box: e.g. `CY-A7F3-2K9D` (generated per session)
- "Return to Prolific" button → redirects to Prolific completion URL with the code

---

## Demand characteristics

It's OK for participants to know the aim of the study. Framing is **direct**: "People mean different things by \"Can you…?\" — we want your natural read." No deception, no concealment.

## Free-text expectations

- A sentence or two per box is the modal answer.
- Don't enforce min-length beyond `.trim().length > 0`.
- Don't enforce max-length, but soft-warn over ~600 chars.

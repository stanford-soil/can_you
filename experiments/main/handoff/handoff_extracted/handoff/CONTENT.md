# Content · final copy strings

> Every visible string in the study, in the exact form participants will read. Production code should pull from this file (or copy these strings verbatim). **No paraphrasing.**

---

## Brand strip (every screen)

```
SOCIAL INTERACTION LAB · STANFORD UNIVERSITY
```

## Top progress bar labels

Format: `SECTION 04 / 06 · SCENARIOS` (left) and `TRIAL 07 / 30` (right, only on main trials).

Section names (in order):
1. welcome
2. how it works
3. practice
4. scenarios
5. wrap-up
6. complete

---

## 1 · Welcome screen

**Eyebrow:** `— a short research study —`

**Title:** `Everyday Questions`

**Body paragraph 1:**
> You'll read short, everyday scenarios in which one person asks another a question like *"Can you give me a quick trim?"*. After each scenario, we'll ask what you think the speaker meant and how you'd respond.

**Body paragraph 2:**
> We're studying how people interpret these questions in everyday situations. There are no right or wrong answers — we just want your natural read.

**Meta strip (3 columns):**
| Label | Value |
|---|---|
| Time | About 22 min |
| Payment | $3.00 via Prolific |
| Scenarios | 30 short items |

**Consent text** (next to checkbox):
> I am 18 or older, have read the consent form, and agree to participate. I understand my responses will be stored anonymously and used for research purposes.

**Buttons:**
- Ghost: `View full consent form`
- Primary (disabled until consent + Turnstile): `Begin study →`

---

## 2 · Instructions screen

**Eyebrow:** `— about this task —`

**Title:** `What "Can you…?" can mean`

**Body paragraph:**
> When someone asks *"Can you pass the salt?"*, they usually want the salt. But *"Can you swim?"* might really be asking about your ability. People mean different things by these questions depending on context.

**Section label:** `— for each scenario, you'll —`

**List:**
- Tell us what you took the question to mean
- Tell us how you would respond to it

**Closing paragraph:**
> Answer in your own words — a sentence or two each. There's no right answer.

**Buttons:**
- Ghost: `← Back`
- Primary: `Continue →`

---

## 3 · Walkthrough screen

**Eyebrow:** `— quick walkthrough —`

**Title:** `Here's what a trial looks like`

**(No body copy — the demo speaks for itself.)**

**Demo content:**
- Tag (floating on top edge): `example trial`
- Scenario:
  > A close friend desperately needs a haircut and can't get an appointment in time. Not knowing who else to ask, they call you and say:
- Utterance: `Can you give me a quick trim?`
- Question 01 prompt: `what they meant by asking`
- Sample answer 01 (types itself in): `they want me to actually cut their hair`
- Question 02 prompt: `how you'd respond`
- Sample answer 02 (types itself in after a 600ms pause): `yeah of course, come by tonight`

**Buttons:**
- Ghost: `← Back`
- Primary (disabled until both animations finish): `Try a practice trial →`

---

## 4 · Practice trial screen

**Practice tag:** `practice — not recorded`

**Scenario:**
> You're at a friend's apartment helping them pack. The boxes are stacked near the door. They turn to you and say:

**Utterance:** `Can you grab the tape?`

**Question 01 prompt:** `what they meant by asking`

**Question 02 prompt:** `how you'd respond`

**Textarea 01 placeholder:** `A sentence or two…`

**Textarea 02 placeholder:** `What you'd say, or do…`

**Footer hint** (when not both filled): `both responses required to continue`

**Footer hint** (when both filled): `auto-saved`

**Primary button:** `Continue →` (disabled until both fields non-empty)

---

## 5 · Comprehension check screen

**Eyebrow:** `— quick check —`

**Title:** `Just to make sure`

**Body:**
> When someone asks *"Can you give me a quick trim?"* — which response goes in the **first** box?

**Options (order randomized OR fixed — pick fixed for simplicity):**
1. `what they meant by asking the question` ← CORRECT
2. `what I would say or do in response`

**Wrong-pick feedback** (under the radio group, italic warn-color):
> Not quite — the first box is for your interpretation of what they meant. The second is for how you'd respond. Pick the other option.

**Right-pick feedback** (italic success-color):
> Right — what they meant by asking goes in the first box, how you'd respond goes in the second.

**Footer hint** (when wrong): `answer correctly to continue`

**Buttons:**
- Ghost: `← Back`
- Primary (disabled until correct): `Begin the 30 scenarios →`

---

## 6 · Main trial screen

**(No practice tag.)**

**Scenario:** *Item-specific — pulled from `stimuli_full_study.js`.*

**Utterance:** *Item-specific.*

**Question 01 prompt (AW condition):** `what they meant by asking`

**Question 02 prompt (AW condition):** `how you'd respond`

**Question 01 prompt (WA condition):** `how you'd respond`

**Question 02 prompt (WA condition):** `what they meant by asking`

**Placeholders, footer hints, button** — same as practice trial.

**Trial 30 button text:** `Finish trials →` (instead of `Continue →`).

---

## 7 · Reflection screen

**Eyebrow:** `— almost done —`

**Title:** `Two quick reflections`

**Question 01 prompt:** `how did you decide what people meant by their questions?`

**Question 02 prompt:** `how did you tell apart questions about ability vs. requests for action?`

**Textarea 01 placeholder:** `Tell us about your approach…`

**Textarea 02 placeholder:** `What helped you distinguish them…`

**Footer hint** (when not both filled): `both required`

**Footer hint** (when both filled): `auto-saved`

**Primary button:** `Continue →` (disabled until both non-empty)

---

## 8 · Demographics screen

**Eyebrow:** `— one more thing —`

**Title:** `A bit about you`

**Body (fine, muted):**
> Optional, but helpful for analyzing the data. All responses remain anonymous.

**Fields:**
| Label | Placeholder | Required |
|---|---|---|
| Age | `e.g. 27` | Yes |
| Gender (self-describe, optional) | `how you'd describe your gender` | No |
| Native language | `e.g. English` | Yes |
| Highest level of education | `e.g. bachelor's degree` | Yes |

**Footer hint** (when missing required): `required fields needed`

**Footer hint** (when all required filled): `ready to submit`

**Primary button:** `Submit →`

---

## 9 · Completion screen

**(Success check badge above eyebrow.)**

**Eyebrow:** `— study complete —`

**Title:** `Thank you`

**Body:**
> Your responses have been recorded. The data you provided will help us understand how people interpret everyday requests.

**Section label:** `— your completion code —`

**Code box content:** `CY-XXXX-XXXX` (generated per session)

**Body (fine):**
> Copy this code into Prolific to receive your payment. If you have any issues, contact the researcher via your Prolific dashboard.

**Footer hint** (during redirect countdown): `redirecting in 3s…`

**Primary button:** `Return to Prolific ↗`

---

## Block screens (browser/device check)

### Mobile

**Title:** `This study requires a computer`

**Body:**
> This study requires typing on a computer keyboard. Please open this link on a laptop or desktop computer.

### Viewport too small

**Title:** `Your browser window is too small`

**Body:**
> Please make your window at least 1024 pixels wide and refresh.

### Unsupported browser

**Title:** `Please use a supported browser`

**Body:**
> Please open this link in Chrome, Safari, Firefox, or Edge.

### Storage disabled

**Title:** `Please enable browser storage`

**Body:**
> Please enable cookies and local storage in your browser settings.

---

## In-study soft prompts

### Sidebar / viewport lock overlay

**Eyebrow:** `— please resize your window —`

**Title:** `Your browser is too small`

**Body:**
> Please make your window at least 1024 × 600 pixels. The study will resume automatically.

### Fullscreen exit nudge (banner)

> You exited fullscreen. **[Return to fullscreen]** for the best experience.

### Idle toast (30s)

> Still there? Your progress is saved.

### Resume splash (on page load with existing session)

**Eyebrow:** `— welcome back —`

**Title:** `Continue where you left off?`

**Body:**
> You started this study earlier. We saved your progress.

**Buttons:**
- Ghost: `Start over`
- Primary: `Resume →`

### Fatal error screen

**Eyebrow:** `— something went wrong —`

**Title:** `We hit an unexpected error`

**Body:**
> Please refresh the page. If the issue persists, contact the researcher at *<researcher email>* with this ID:

**(participant ID shown in code box below)**

### Final upload failed

**Eyebrow:** `— almost there —`

**Title:** `Your data is saved locally`

**Body:**
> Your responses were collected but couldn't be sent to our server right now. Please email *<researcher email>* with the ID below — your data is preserved and we'll process it manually.

**(participant ID shown in code box)**

---

## Substitution variables

Replace these in production:
- `<researcher email>` — actual email for the lead researcher
- `<SITE_KEY_FROM_NORMING>` — Turnstile site key (see `norming_study/config/turnstile.md`)
- `<DATAPIPE_EXPERIMENT_ID>` — new DataPipe experiment ID for `whyask_main`
- `<ROUNDTABLE_STUDY_ID>` — new Roundtable endpoint for `whyask_main`
- `<prolific completion URL>` — `https://app.prolific.com/submissions/complete?cc=<code>`

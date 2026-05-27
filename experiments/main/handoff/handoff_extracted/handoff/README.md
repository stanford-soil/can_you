# can_you · main (listener / actioner) study

> Handoff package for building the main study with Claude Code.

This folder is **self-contained**. Everything Claude Code needs to implement the study end-to-end is in here.

## Read order

For Claude Code (or anyone implementing):

1. **`README.md`** — this file (orientation)
2. **`SPEC.md`** — what the study does, screen by screen
3. **`CONTENT.md`** — every visible string in production form
4. **`DESIGN-SYSTEM.md`** — design tokens, components, states
5. **`INFRASTRUCTURE.md`** — every infra piece (Turnstile / DataPipe / Roundtable / browser-check / idle / halfway-save / etc.) with code patterns
6. **`DATA-SCHEMA.md`** — the JSON blob that gets uploaded per participant
7. **`IMPLEMENTATION-PLAN.md`** — step-by-step build order with verification gates

Then open the prototype (`prototype/prototype.html`) and click through it — it is the **visual + interaction source of truth**.

## What this study is

A free-response listener / actioner study. Participants read 30 short scenarios where one person asks another a *"Can you…?"* question. After each, they (a) say what they took the speaker to mean and (b) say how they'd respond. Both DVs are free-text, clustered / LLM-tagged post-hoc.

Order of the two questions is counterbalanced between participants (AW vs WA, like norming).

## What's reused from `norming_study`

| Thing | Reuse? | Notes |
|---|---|---|
| 100-item stimulus set (`stimuli_full_study.js`) | ✅ Copy unchanged | Same vignettes |
| Cloudflare Turnstile site key | ✅ Same key | See `config/turnstile.md` in norming |
| DataPipe client code pattern | ✅ Same pattern, **new experiment ID** | Create new ID in DataPipe dashboard |
| Roundtable handoff pattern | ✅ Same pattern, **new endpoint** | Create new endpoint in Roundtable |
| Browser + viewport check | ✅ Same checks | Code in `INFRASTRUCTURE.md` § 5 |
| Idle warning + tab visibility | ✅ Same | `INFRASTRUCTURE.md` § 8 + 9 |
| Halfway save | ✅ Same pattern | Fires at trial 15 (was 15 in norming too) |
| Fullscreen / sidebar lock | ✅ Same | `INFRASTRUCTURE.md` § 6 + 7 |
| Mobile blocking | ✅ Same UA check | |
| Demographics block | ✅ Mostly same | Same fields, slightly different copy |
| **Visual design language** | ❌ Totally new | Cobalt direction — see `DESIGN-SYSTEM.md` |
| **Trial UI** | ❌ Totally new | Free-text × 2 with slide-in reveal |
| **Reflection / strategy questions** | ❌ New copy | Two open-ended questions on approach + distinguishing question types |

## File map

```
handoff/
├── README.md                  — this file
├── SPEC.md                    — full study specification
├── CONTENT.md                 — every visible string in production form
├── DESIGN-SYSTEM.md           — design tokens, components, states
├── INFRASTRUCTURE.md          — every infra piece with code patterns
├── DATA-SCHEMA.md             — what gets saved per participant
├── IMPLEMENTATION-PLAN.md     — step-by-step build order
└── prototype/
    ├── prototype.html         — entry point (open this in a browser)
    ├── prototype.jsx          — all 9 screens + state machine
    └── styles.css             — design tokens + component styles
```

## Substitution variables (need real values before launch)

| Variable | Where used | Source |
|---|---|---|
| `<researcher email>` | Error screens, completion-failed message | User to provide |
| `<SITE_KEY_FROM_NORMING>` | Turnstile widget | `norming_study/config/turnstile.md` |
| `<DATAPIPE_EXPERIMENT_ID>` | Data upload | User to create new in DataPipe dashboard |
| `<ROUNDTABLE_STUDY_ID>` | Session verification | User to create new in Roundtable |
| Prolific completion URL | Final redirect | `https://app.prolific.com/submissions/complete?cc=<code>` |

## Status

- ✅ Prototype is feature-complete for the participant-facing flow
- ✅ Design system is documented
- ✅ Data schema is documented
- ✅ Infrastructure is documented
- ⏳ DataPipe experiment ID — needs creation
- ⏳ Roundtable endpoint — needs creation
- ⏳ Production deployment — Claude Code task
- ⏳ Pilot (n=5) and launch (n=150) — after Claude Code finishes

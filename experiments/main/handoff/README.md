# can_you · main (listener / actioner) study

> Handoff package for building the main study in code (via Claude Code or similar).

This folder is **self-contained**. It includes everything you need to implement the study end-to-end without referring back to the design conversation:

- A **clickable working prototype** that demonstrates every screen, transition, and validation rule.
- A **specification** of what the study does (`SPEC.md`).
- A **design system** with every token, component, and state (`DESIGN-SYSTEM.md`).
- A **data schema** for what gets recorded per participant (`DATA-SCHEMA.md`).
- An **infrastructure** doc covering Turnstile, DataPipe, Roundtable, browser check, idle warning, etc. — most of this mirrors `norming_study` (`INFRASTRUCTURE.md`).
- An **implementation plan** with concrete steps in build order (`IMPLEMENTATION-PLAN.md`).

## Quick orientation

1. **Open `prototype/prototype.html` in a browser.** Click through the entire flow as a participant would. The prototype is the source of visual truth — implementation should match it pixel-close.
2. **Read `SPEC.md`.** That's the contract for what the study does.
3. **Read `IMPLEMENTATION-PLAN.md`.** That's the recommended build order.
4. **Use `DESIGN-SYSTEM.md` as you build.** Every color, font, radius, and component variant is documented there.

## What this study is

A free-response listener / actioner study. Participants read 30 short scenarios where one person asks another a *"Can you…?"* question. After each scenario they (a) say what they took the speaker to mean and (b) say how they would respond. Both DVs are free-text, clustered / LLM-tagged post-hoc to recover proportions over interpretive readings (ability vs. indirect request) and response types (action vs. utterance vs. refusal etc).

The order of the two questions is counterbalanced between participants (matches the AW/WA split in `norming_study`).

## What's reused from `norming_study`

| Thing | Reuse? |
|---|---|
| 100-item stimulus set | **Yes** — same items, same vignettes |
| Cloudflare Turnstile bot check | **Yes** — same key, same flow |
| DataPipe upload | **Yes** — new dataset ID, same client |
| Roundtable handoff | **Yes** — same protocol |
| Browser + viewport + fullscreen check | **Yes** |
| Idle warning + tab visibility logging + halfway save | **Yes** |
| Mobile blocking | **Yes** |
| Demographics block | **Yes**, plus one new meta question |
| Visual design language | **No** — totally new (Cobalt — see `DESIGN-SYSTEM.md`) |
| Trial UI | **No** — totally new (free-text × 2 per trial) |

## File map

```
handoff/
├── README.md                  — this file
├── SPEC.md                    — full study specification
├── DESIGN-SYSTEM.md           — design tokens, components, states
├── DATA-SCHEMA.md             — what gets saved per participant
├── INFRASTRUCTURE.md          — Turnstile, DataPipe, Roundtable, etc.
├── IMPLEMENTATION-PLAN.md     — step-by-step build order
└── prototype/
    ├── prototype.html         — entry point
    ├── prototype.jsx          — all 9 screens + state machine
    └── styles.css             — design tokens + component styles
```

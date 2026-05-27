# Data Schema

> What we save per participant. Mirror this from `norming_study`; only the trial-level shape changes.

All data uploaded to **DataPipe** (see `INFRASTRUCTURE.md`) as a single JSON blob per participant at end of study. Halfway save fires a partial blob at trial 15 in case of mid-study dropout.

## Top-level participant record

```jsonc
{
  "experimentName": "whyask_main",      // distinguishes from "whyask_norming"
  "version": "1.0.0",
  "participantID": "uuid-v4",            // session-local UUID
  "prolificID": "string",                // ?PROLIFIC_PID URL param
  "prolificSessionID": "string",         // ?SESSION_ID URL param
  "prolificStudyID": "string",           // ?STUDY_ID URL param
  "completionCode": "CY-XXXX-XXXX",      // shown on completion screen

  "orderCondition": "AW" | "WA",         // counterbalance: interpretation-first or response-first
  "stimuliShown": ["035","042",…],       // 30 item IDs in presentation order
  "rngSeed": 1234567,                    // for reproducibility

  "timestamps": {
    "studyStart":  1717000000000,        // ms since epoch
    "consentGiven": 1717000010000,
    "instructionsDone": …,
    "walkthroughDone": …,
    "practiceDone": …,
    "comprehensionPassed": …,
    "trialsStart": …,
    "trialsDone": …,
    "reflectionDone": …,
    "demographicsDone": …,
    "studyComplete": …
  },

  "browser": {
    "userAgent": "…",
    "viewportWidth": 1440,
    "viewportHeight": 900,
    "devicePixelRatio": 2,
    "languages": ["en-US","en"],
    "platform": "MacIntel"
  },

  "comprehension": {
    "attempts": 2,                       // total clicks before passing
    "wrongPicks": [1],                   // option indices clicked before correct
    "timeToCorrectMs": 8420
  },

  "trials": [ TrialRecord, …×30 ],

  "reflection": {
    "approach": "free text",
    "distinguishing": "free text"
  },

  "demographics": {
    "age": "27",
    "gender": "",                        // optional
    "nativeLanguage": "English",
    "education": "bachelor's degree"
  },

  "events": [ EventRecord, … ]           // tab switches, idle warnings, fullscreen exits
}
```

## TrialRecord

One per main trial (×30):

```jsonc
{
  "itemID": "035",                       // index into stimuli_full_study.js
  "trialIdx": 7,                         // 1-indexed position in this participant's sequence
  "scenario": "A close friend desperately needs a haircut…",
  "utterance": "Can you give me a quick trim?",

  "interpretation": "free text",         // box 01 content
  "response": "free text",               // box 02 content

  "order": "AW" | "WA",                  // copied from participant.orderCondition for convenience

  "shownAtMs": 1717000123000,            // when trial mounted
  "submittedAtMs": 1717000145000,        // when continue clicked
  "totalTimeMs": 22000,

  "timeToFirstInterpKeystrokeMs": 2400,  // box 01
  "timeToFirstRespKeystrokeMs": 11800,   // box 02 (after it slid in)
  "interpKeystrokes": 87,
  "respKeystrokes": 53,
  "interpRevisions": 1,                  // # of times they cleared/heavily edited
  "respRevisions": 0,
  "box2RevealedAtMs": 1717000130000,     // when box 02 first slid into view
  "characters": { "interp": 142, "resp": 38 }
}
```

## EventRecord

Append-only log for anything notable that happens:

```jsonc
{ "t": 1717000050000, "kind": "tab_hidden" }
{ "t": 1717000055000, "kind": "tab_visible" }
{ "t": 1717000120000, "kind": "idle_warning_shown",  "afterMs": 30000 }
{ "t": 1717000125000, "kind": "idle_warning_dismissed" }
{ "t": 1717000300000, "kind": "fullscreen_exit" }
{ "t": 1717000305000, "kind": "fullscreen_resumed" }
{ "t": 1717000400000, "kind": "halfway_save",   "trialsCompleted": 15 }
{ "t": 1717000800000, "kind": "back_button",    "from": "practice", "to": "walkthrough" }
{ "t": 1717000900000, "kind": "comprehension_wrong", "pickedIdx": 1 }
```

## What NOT to save

- The full stimulus catalog (already in code; just save itemIDs)
- IP addresses (DataPipe anonymizes)
- Cursor positions / mouse traces (overkill for this study)
- Per-keystroke timestamps (just counts + first-keystroke time)

## Storage location

- DataPipe: experiment ID **TBD — generate one fresh, do not reuse the norming ID**.
- Halfway save: separate DataPipe submission with `partial: true` flag and same participantID.
- Roundtable handoff: same protocol as norming, separate study.

## Stimuli reference

The 100-item stimulus catalog lives in `norming_study/stimuli/stimuli_full_study.js`:

```js
var STIMULI_DATA = {
  "experimentName": "whyask_norming",
  "items": [
    { "id": "001", "scenario": "…", "utterance": "Can you …?", … },
    …
  ]
};
```

For the main study, **copy this file unchanged** into `stimuli/` (or import from the norming repo). Don't duplicate; reference by symlink or git submodule if practical. Update `experimentName` to `whyask_main` at the participant-record level — not in the stimuli file itself.

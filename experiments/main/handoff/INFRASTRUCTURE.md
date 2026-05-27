# Infrastructure

> Mirror this from `norming_study`. Most of it is identical; flagged differences are called out below.

## Hosting

Static HTML/JS/CSS hosted wherever norming is hosted (GitHub Pages, Vercel, lab server — TBD). No backend. All data submission is client → DataPipe over HTTPS.

## URL parameters (from Prolific)

```
?PROLIFIC_PID=…&SESSION_ID=…&STUDY_ID=…
```

Capture all three at study start and include in the participant record. Use them in the Prolific completion redirect:

```
https://app.prolific.com/submissions/complete?cc=CY-XXXX-XXXX
```

## Cloudflare Turnstile

Bot-protection challenge shown on the welcome screen before the consent checkbox enables.

- **Reuse the same Turnstile site key** as the norming study (see `norming_study/config/turnstile.md`).
- Render via the official Turnstile JS API (`https://challenges.cloudflare.com/turnstile/v0/api.js`).
- The Begin button is disabled until **both** consent is checked AND Turnstile token is received.
- Token is saved in the participant record under `turnstileToken` (DataPipe verifies server-side).

## DataPipe

Anonymous data upload — no auth, no backend.

- **Create a new DataPipe experiment** (don't reuse the norming experiment ID). Name it `whyask_main`.
- Endpoint: `https://pipe.jspsych.org/api/data/`
- Payload: JSON blob (see `DATA-SCHEMA.md`).
- Two submissions per participant:
  1. **Halfway save** at trial 15 — partial blob with everything-so-far + `partial: true`.
  2. **Final save** on the completion screen — full blob.
- Filename convention: `<participantID>_<timestamp>.json` for finals; `<participantID>_partial_<timestamp>.json` for halfway.

## Roundtable

Same handoff protocol as norming. Generates the completion code and verifies the session is legit. **Use the existing Roundtable client; create a new study endpoint for main.**

## Browser + device check

Run at study start, before consent. Block on any failure with a clean explanation screen.

| Check | Threshold | Reason |
|---|---|---|
| Mobile detection | UA matches mobile/tablet | Free-text typing is bad on mobile |
| Viewport width | < 800px | Card layout breaks below this |
| Browser | not Chrome / Safari / Firefox / Edge | Other browsers untested |
| JS enabled | always | Trivially |
| Cookies / localStorage | enabled | For halfway-save resume |

## Fullscreen

Request fullscreen mode (`document.documentElement.requestFullscreen()`) when participant clicks Begin. If they exit fullscreen mid-study, log an event and show a soft prompt: "Please return to fullscreen mode to continue."

## Sidebar / viewport lock

If the participant resizes the window below the threshold mid-study (e.g. opens DevTools sidebar), show a blocking overlay until they restore it. Same as norming.

## Idle warning

After **30 seconds** of no input on a trial screen, show a non-blocking toast: "Still there? The study will save your progress."

After **2 minutes** of no input, save state and show a "Welcome back" prompt when they return.

## Tab visibility logging

Listen for `visibilitychange`. Log every `tab_hidden` and `tab_visible` event with timestamp. Don't block — just record.

## Halfway save

At end of trial 15, fire a partial DataPipe submission. Localstorage stores everything-so-far as a JSON blob keyed by participantID. On reload, prompt to resume.

## Local persistence

`localStorage` keys:

```
whyask_main.participantID
whyask_main.state          // serialized App state for resume
whyask_main.halfwaySaved   // boolean flag
```

Clear all on completion.

## Error handling

- Network error on DataPipe submission → retry 3× with exponential backoff, then queue in localStorage and show "data couldn't be saved — please email researcher" message with email.
- Turnstile failure → block, ask to refresh.
- Fatal JS error → catch in a top-level error boundary, log to console + localStorage, show "Something broke. Please screenshot this and contact the researcher."

## Browser support matrix

Tested in:
- Chrome 120+
- Safari 17+
- Firefox 120+
- Edge 120+

No IE, no mobile browsers.

# Infrastructure

> Every infrastructure piece in this study. **The norming study at `can_you/experiments/norming_study/` is the working reference implementation** — Claude Code should open and read its source as it builds each piece below. This doc tells you what to look for and how to integrate it.

---

## 0 · Files to read from `norming_study/` first

Before implementing any infra, **open and read these files in this exact order** (read fully — don't grep):

| File | Why |
|---|---|
| `norming_study/index.html` | Page skeleton, script load order, font imports, Turnstile script tag |
| `norming_study/joint/index.html` | Inner study skeleton (consent + Turnstile + viewport check ordering) |
| `norming_study/joint/js/main.js` | The state machine, init order, halfway save, DataPipe upload, completion |
| `norming_study/joint/js/trials.js` | Trial rendering — note we are **replacing** the trial UI, not the trial loop |
| `norming_study/config/turnstile.md` | Turnstile site key + setup notes |
| `norming_study/css/style.css` | Existing tokens (we are replacing these with Cobalt — see `DESIGN-SYSTEM.md`) |
| `norming_study/stimuli/stimuli_full_study.js` | The 100 items |

Then read `SPEC.md`, `DESIGN-SYSTEM.md`, `DATA-SCHEMA.md` (in this folder) before writing anything.

---

## 1 · Hosting

Static site. Same hosting platform as norming (check `norming_study/` for a Vercel / GitHub Pages config — replicate exactly). No backend, no server. Single index entry point.

**URL params** received from Prolific:

```
?PROLIFIC_PID=<id>&SESSION_ID=<sid>&STUDY_ID=<study>
```

Capture all three at `window.load` and store in the participant record. If any are missing, that's a test session — generate a placeholder `participantID` and proceed but flag `{ testSession: true }` in the data.

**Final redirect** on completion:

```
https://app.prolific.com/submissions/complete?cc=<completionCode>
```

The `completionCode` is generated at study start (see § 7 below).

---

## 2 · Cloudflare Turnstile (CAPTCHA)

### When it runs
On the welcome screen, **before** the consent checkbox enables. Begin button is disabled until both: (a) consent checked, (b) Turnstile token received.

### How to integrate
1. Add the Turnstile script to `<head>` of the entry HTML:
   ```html
   <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" defer></script>
   ```
2. Render the widget in the welcome card (above the consent checkbox):
   ```html
   <div class="cf-turnstile"
        data-sitekey="<SITE_KEY_FROM_NORMING>"
        data-callback="onTurnstileSuccess"
        data-error-callback="onTurnstileError">
   </div>
   ```
3. Define the callbacks in JS:
   ```js
   window.onTurnstileSuccess = (token) => {
     participantRecord.turnstileToken = token;
     uiState.turnstilePassed = true;
     updateBeginButton();
   };
   window.onTurnstileError = () => {
     showError("Verification failed. Please refresh the page.");
   };
   ```

### Site key
**Read `norming_study/config/turnstile.md` for the production site key**. Do NOT regenerate — use the same key so the existing Cloudflare dashboard tracks both studies' traffic.

### Failure modes
- Token never arrives within 10s → show "Verification timed out. Please refresh."
- Token expires (`error-callback` fires) → re-render the widget.

### Server verification
Turnstile tokens are saved in the participant record as `turnstileToken`. Server-side verification happens **downstream** (in the analysis pipeline) by POSTing the token to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with the secret key (NOT in client code).

---

## 3 · DataPipe (data upload)

### Setup
1. Go to **https://pipe.jspsych.org** and create a new experiment named `whyask_main`.
2. Copy the generated experiment ID (looks like `abcDEF12345`).
3. Store the ID in a constant at the top of the main JS file:
   ```js
   const DATAPIPE_EXPERIMENT_ID = "<TBD — paste real ID after creating>";
   const DATAPIPE_URL = "https://pipe.jspsych.org/api/data/";
   ```

### Upload function

```js
async function uploadToDataPipe(payload, { partial = false } = {}) {
  const filename = partial
    ? `${payload.participantID}_partial_${Date.now()}.json`
    : `${payload.participantID}_${Date.now()}.json`;

  const body = {
    experimentID: DATAPIPE_EXPERIMENT_ID,
    filename,
    data: JSON.stringify(payload),
  };

  const max = 3;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      const res = await fetch(DATAPIPE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "*/*" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === max - 1) {
        // queue in localStorage for manual recovery
        localStorage.setItem(
          `whyask_main.failed_upload_${Date.now()}`,
          JSON.stringify({ filename, payload, error: err.message })
        );
        throw err;
      }
      await new Promise(r => setTimeout(r, 800 * 2 ** attempt));
    }
  }
}
```

### When to upload
- **Halfway save**: right after trial 15 finishes. Payload includes `{ partial: true }`.
- **Final save**: when participant clicks "Submit" on the demographics screen. Full payload.
- **Both** are async — kick off the upload, but don't block the UI. Show a small "saving…" indicator.

### Failure → user message
If 3 retries fail, show this in the completion screen instead of the code:

> Your responses were collected but couldn't be saved to our server right now. Please email `<researcher email>` with the code below — your data is preserved and we'll process it manually.
>
> `<participantID>`

---

## 4 · Roundtable (data quality + verification)

### Integration
Roundtable is the existing tool used by norming. **Read `norming_study/joint/js/main.js` for the exact integration code** — search for "roundtable" or "verification" in that file.

What it does:
1. On study start, the client makes a session-verification call to Roundtable with the Prolific ID.
2. Roundtable returns a `sessionToken` that we include in the final data payload.
3. On completion, we ping Roundtable's completion endpoint with the participant ID + session token to mark the session legitimate.

### What to mirror
- Same Roundtable account / API key as norming (read from norming's config).
- **New study endpoint** in the Roundtable dashboard — name it `whyask_main`. Don't reuse the norming endpoint or completion stats will mix.
- Same token field name in the data blob (whatever norming uses — match it).

---

## 5 · Browser + device check (entry gate)

### When it runs
Before ANY UI renders. If any check fails, show a single full-screen block message and halt.

### Checks (in order)

```js
function checkEntry() {
  const ua = navigator.userAgent;
  const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  if (mobile) return { ok: false, reason: "mobile" };

  if (window.innerWidth < 1024) return { ok: false, reason: "viewport_small" };

  const browserOK = (
    /Chrome\//.test(ua) ||
    /Safari\//.test(ua) ||
    /Firefox\//.test(ua) ||
    /Edg\//.test(ua)
  );
  if (!browserOK) return { ok: false, reason: "browser" };

  try {
    localStorage.setItem("__t","1");
    localStorage.removeItem("__t");
  } catch {
    return { ok: false, reason: "storage" };
  }

  return { ok: true };
}
```

### Block messages (final copy)

| Reason | Message |
|---|---|
| `mobile` | "This study requires typing on a computer keyboard. Please open this link on a laptop or desktop computer." |
| `viewport_small` | "Your browser window is too small. Please make it at least 1024 pixels wide and refresh." |
| `browser` | "Please open this link in Chrome, Safari, Firefox, or Edge." |
| `storage` | "Please enable cookies and local storage in your browser settings." |

Each shows centered in a card on the warm off-white background — match the design system (`DESIGN-SYSTEM.md`).

---

## 6 · Viewport / sidebar lock (mid-study)

### Why
If a participant opens DevTools, resizes the window, or drags the sidebar narrower, our card can break layout. More importantly: window resizing is a known bot-evasion signal.

### Threshold
`window.innerWidth < 1024` OR `window.innerHeight < 600`.

### Behavior
- Listen to `window.resize` event.
- When threshold crosses below, show a full-viewport blocking overlay.
- When width/height comes back above threshold, hide the overlay.
- Log every transition as a `viewport_lock` / `viewport_unlock` event in the data.

### Overlay UI

```html
<div class="fm-block-overlay">
  <div class="fm-card" style="text-align: center;">
    <p class="fm-eyebrow">— please resize your window —</p>
    <h1 class="fm-title small">Your browser is too small</h1>
    <p class="fm-body">
      Please make your window at least 1024 × 600 pixels.
      The study will resume automatically.
    </p>
  </div>
</div>
```

```css
.fm-block-overlay {
  position: fixed;
  inset: 0;
  background: rgba(244, 243, 238, 0.96);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}
```

### Don't block typing
While the overlay is up, the underlying trial state is preserved. When the overlay closes, the participant can keep typing where they left off. **Do not** clear or reset state on resize events.

---

## 7 · Fullscreen mode

### Request
On the welcome screen, immediately after the participant clicks "Begin study":

```js
async function requestFullscreen() {
  try {
    await document.documentElement.requestFullscreen();
  } catch (err) {
    // Some browsers/users block fullscreen — that's OK, log it and proceed
    logEvent("fullscreen_denied", { error: err.message });
  }
}
```

### Detect exit
Listen for `fullscreenchange`. If `!document.fullscreenElement` and the study is past the welcome screen, show a soft non-blocking banner:

> You exited fullscreen. **[Return to fullscreen]** for the best experience.

Clicking the link re-requests fullscreen. Don't force it — just nudge. Log `fullscreen_exit` and `fullscreen_resumed` events.

### Don't request on welcome screen itself
The Turnstile widget can fail to render inside a freshly-requested fullscreen container. Only request fullscreen on `onBeginClick`, AFTER Turnstile has succeeded.

---

## 8 · Idle warning (per trial)

### Behavior
- Start a 30-second timer when each trial mounts. Reset on any keystroke in either textarea.
- After 30s of no input, show a non-blocking toast at the bottom: "Still there? Your progress is saved."
- After 2 minutes total inactivity, save state to localStorage and show a "Welcome back" prompt on the next interaction.

### Toast UI

```html
<div class="fm-toast">
  <span class="fm-toast-dot" />
  Still there? Your progress is saved.
  <button class="fm-toast-dismiss">×</button>
</div>
```

```css
.fm-toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(22, 27, 46, 0.94);
  color: #F4F3EE;
  font-family: var(--c-sans);
  font-size: 13px;
  padding: 12px 18px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0,0,0,.24);
  animation: fmToastIn 280ms cubic-bezier(.2,.8,.2,1);
}
.fm-toast-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--c-secondary);
}
@keyframes fmToastIn {
  from { opacity: 0; transform: translate(-50%, 12px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}
```

Auto-dismiss after 6 seconds, or on first new keystroke.

---

## 9 · Tab visibility logging

```js
document.addEventListener("visibilitychange", () => {
  const kind = document.hidden ? "tab_hidden" : "tab_visible";
  logEvent(kind);
});
```

Append to `participantRecord.events` (see `DATA-SCHEMA.md` → EventRecord). **Don't block** on tab switches — just record. Long tab-hidden durations can be flagged downstream for data quality.

---

## 10 · Halfway save

### Trigger
Right after the participant clicks "Continue" on trial 15. Fire-and-forget upload.

### Payload
The full participant record so far, plus:
```js
{ ...participantRecord, partial: true, savedAtTrial: 15 }
```

### LocalStorage backup
**Also** write the full payload to localStorage under the key:
```
whyask_main.halfway.<participantID>
```

So if the network upload fails AND the participant abandons, we can recover from another session.

### Don't show UI for it
The halfway save is invisible to the participant. Just `logEvent("halfway_save", { trialsCompleted: 15 })`.

---

## 11 · LocalStorage persistence + resume

### Keys
```
whyask_main.participantID        // UUID generated at study start
whyask_main.state                // serialized state for resume
whyask_main.halfwaySaved         // boolean
whyask_main.completionSent       // boolean — final upload succeeded
whyask_main.failed_upload_<ts>   // queued failed uploads (see § 3)
```

### State shape
```json
{
  "screenIdx": 5,
  "trialIdx": 12,
  "trialAnswers": [ { "itemID": "035", "interp": "...", "resp": "..." }, ... ],
  "orderCondition": "AW",
  "stimuliShown": ["035","042", ...],
  "comprehensionPassed": true,
  "demographics": null,
  "reflection": null,
  "events": [ ... ],
  "savedAt": 1717000000000
}
```

Update on every screen transition + every trial submit. Throttle to once per 2 seconds during heavy typing.

### Resume flow
On page load:
1. Check for `whyask_main.participantID` in localStorage.
2. If exists AND `completionSent` is not true:
   - Show a "Welcome back" splash:
     > You started this study earlier. **[Resume where you left off]** · [Start over]
   - "Resume" → load state, jump to the saved screen.
   - "Start over" → clear localStorage, generate new participantID, start fresh.
3. If no participantID → fresh session.

### Cleanup
On final upload success: clear ALL `whyask_main.*` keys from localStorage.

---

## 12 · Comprehension check gating

### Behavior
- Participant must select the correct answer to proceed.
- Wrong answer shows red warning copy; correct shows green confirmation.
- **No limit on attempts.** Don't block forever — but log attempts for data quality.

### Data
`participantRecord.comprehension = { attempts, wrongPicks, timeToCorrectMs }` (see `DATA-SCHEMA.md`).

---

## 13 · Completion code generation

```js
function generateCompletionCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";  // ambiguous chars removed
  const block = () => Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]).join("");
  return `CY-${block()}-${block()}`;
}
```

Generate **once** at study start. Store in `participantRecord.completionCode`. Display on the completion screen. Pass via URL param on the Prolific redirect.

---

## 14 · Error handling

### Top-level error boundary
Wrap the React app in an error boundary that catches uncaught errors:

```jsx
class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    logEvent("fatal_error", { message: error.message, stack: info.componentStack });
    try {
      localStorage.setItem(
        `whyask_main.fatal_${Date.now()}`,
        JSON.stringify({ error: error.message, stack: info.componentStack, state: this.props.state })
      );
    } catch {}
  }
  render() {
    if (this.state.error) {
      return (
        <div className="fm-card" style={{ margin: "80px auto" }}>
          <p className="fm-eyebrow">— something went wrong —</p>
          <h1 className="fm-title small">We hit an unexpected error</h1>
          <p className="fm-body">
            Please refresh the page. If the issue persists, contact the researcher
            at <a href="mailto:<researcher email>"><researcher email></a> with this ID:
          </p>
          <div className="fm-code">{getParticipantID()}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### Network errors
See § 3 above — 3× retry with exponential backoff, then queue in localStorage.

### Turnstile errors
See § 2 above — show a refresh prompt.

---

## 15 · Event logging contract

Define one helper, used everywhere:

```js
function logEvent(kind, extra = {}) {
  participantRecord.events.push({ t: Date.now(), kind, ...extra });
}
```

**Events to log** (see `DATA-SCHEMA.md` → EventRecord for the canonical list):

- `tab_hidden`, `tab_visible`
- `idle_warning_shown`, `idle_warning_dismissed`
- `fullscreen_denied`, `fullscreen_exit`, `fullscreen_resumed`
- `viewport_lock`, `viewport_unlock`
- `halfway_save`, `halfway_save_failed`
- `back_button` (when participant clicks Back) — include `{ from, to }`
- `comprehension_wrong` (each wrong pick) — include `{ pickedIdx }`
- `comprehension_passed`
- `turnstile_passed`, `turnstile_error`
- `fatal_error`
- `resume_session` (when participant resumes from localStorage)

---

## 16 · Analytics / pageviews

**None.** No Google Analytics, no PostHog, no Mixpanel. Privacy-first. The DataPipe payload IS the analytics.

---

## 17 · Pre-launch checklist

Before pushing to Prolific:

- [ ] DataPipe experiment created; ID pasted into source
- [ ] Roundtable endpoint created; integrated
- [ ] Turnstile site key in source matches `norming_study/config/turnstile.md`
- [ ] Stimuli file copied from norming; sampling tested
- [ ] AW/WA counterbalancing tested with two prolific IDs
- [ ] Full end-to-end pilot session completes; DataPipe blob inspected
- [ ] Mobile UA shows mobile block
- [ ] Resume flow works after refresh at trial 10
- [ ] Halfway save fires at trial 15 (inspect DataPipe)
- [ ] Turnstile fail mode tested (refresh page during widget render)
- [ ] Network failure mode tested (offline mid-submission)
- [ ] Tab switch logging present in data
- [ ] Fullscreen exit logged
- [ ] Sidebar resize lock works
- [ ] Idle toast appears after 30s inactivity
- [ ] Completion code shown + included in Prolific redirect URL
- [ ] Pre-registration on OSF written + posted
- [ ] Researcher email substituted into error messages
- [ ] Pay rate matches Prolific listing ($3.00)
- [ ] Prolific listing set to single-submission-per-participant

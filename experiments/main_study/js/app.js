// app.js — whyask_main study
// React 18 + Babel, no build step

const { useState, useEffect, useRef, useCallback } = React;

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const DATAPIPE_EXPERIMENT_ID = 'th9b0p1MhAHk';
const DATAPIPE_URL = 'https://pipe.jspsych.org/api/data/';
const RESEARCHER_EMAIL = 'mokeeffe@stanford.edu';
const PROLIFIC_COMPLETION_CODE = 'CEPHL0CF'; // fixed Prolific redirect code for this study
const TOTAL_TRIALS = 30;
const LS_PREFIX = 'whyask_main.';

// ─────────────────────────────────────────────────────────────
// Progress bar config (same as prototype)
// ─────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'welcome',  name: 'welcome',      weight: 1 },
  { id: 'intro',    name: 'how it works', weight: 2 },
  { id: 'practice', name: 'practice',     weight: 1 },
  { id: 'trials',   name: 'scenarios',    weight: 12 },
  { id: 'wrap',     name: 'wrap-up',      weight: 2 },
  { id: 'done',     name: 'complete',     weight: 0.5 },
];

const SCREEN_TO_SECTION = [0, 1, 1, 2, 2, 3, 4, 4, 5];

const SCREEN_SECTION_SHARE = [
  [0, 1],
  [0, 0.5],
  [0.5, 1],
  [0, 0.5],
  [0.5, 1],
  [0, 1],
  [0, 0.5],
  [0.5, 1],
  [0, 1],
];

function progressInfo(screenIdx, trialIdx, trialTotal) {
  const sectionIdx = SCREEN_TO_SECTION[screenIdx];
  const [shareStart, shareEnd] = SCREEN_SECTION_SHARE[screenIdx];
  const total = SECTIONS.reduce((a, s) => a + s.weight, 0);
  let cumStart = 0;
  for (let i = 0; i < sectionIdx; i++) cumStart += SECTIONS[i].weight;
  const sectionWeight = SECTIONS[sectionIdx].weight;
  const screenStart = shareStart * sectionWeight;
  const screenEnd = shareEnd * sectionWeight;
  let withinScreen;
  if (trialIdx != null && trialTotal != null) {
    withinScreen = (trialIdx / trialTotal) * (screenEnd - screenStart);
  } else {
    withinScreen = screenEnd - screenStart;
  }
  const fillPct = ((cumStart + screenStart + withinScreen) / total) * 100;
  const sectionStarts = [];
  let cum = 0;
  for (const s of SECTIONS) { sectionStarts.push((cum / total) * 100); cum += s.weight; }
  return { fillPct, sectionStarts, sectionIdx };
}

// ─────────────────────────────────────────────────────────────
// Stimuli helpers — seeded RNG from participantID
// ─────────────────────────────────────────────────────────────
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleStimuli(participantID, n = 30) {
  const seed = hashStr(participantID);
  const rng = mulberry32(seed);
  // stimuli_full_study.js uses .stimuli not .items
  const src = (STIMULI_DATA.items || STIMULI_DATA.stimuli || []);
  const all = src.slice();
  for (let i = all.length - 1; i > all.length - 1 - n; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(-n).reverse();
}

function assignCondition(participantID) {
  return (hashStr(participantID) % 2 === 0) ? 'AW' : 'WA';
}

// rebuild _stimuli cache from a saved stimuliShown itemID list
function reconstructStimuliFromShown(stimuliShown) {
  const src = (STIMULI_DATA.items || STIMULI_DATA.stimuli || []);
  const byId = {};
  src.forEach(s => { byId[String(s.itemID)] = s; });
  return (stimuliShown || []).map(id => byId[id]).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// Completion code + UUID
// ─────────────────────────────────────────────────────────────
function generateCompletionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = () => Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]).join('');
  return `CY-${block()}-${block()}`;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─────────────────────────────────────────────────────────────
// URL params
// ─────────────────────────────────────────────────────────────
function getURLParams() {
  const p = new URLSearchParams(window.location.search);
  const prolificID = p.get('PROLIFIC_PID') || p.get('prolific_pid') || '';
  const sessionID = p.get('SESSION_ID') || p.get('session_id') || '';
  const studyID = p.get('STUDY_ID') || p.get('study_id') || '';
  const testSession = !prolificID && !sessionID;
  return { prolificID, sessionID, studyID, testSession };
}

// ─────────────────────────────────────────────────────────────
// Browser / device entry check
// ─────────────────────────────────────────────────────────────
function checkEntry() {
  const ua = navigator.userAgent;
  const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  if (mobile) return { ok: false, reason: 'mobile' };
  if (window.innerWidth < 1024 || window.innerHeight < 600) return { ok: false, reason: 'viewport_small' };
  const browserOK = (
    /Chrome\//.test(ua) ||
    /Safari\//.test(ua) ||
    /Firefox\//.test(ua) ||
    /Edg\//.test(ua)
  );
  if (!browserOK) return { ok: false, reason: 'browser' };
  try {
    localStorage.setItem('__t', '1');
    localStorage.removeItem('__t');
  } catch {
    return { ok: false, reason: 'storage' };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// DataPipe upload w/ 3-retry exponential backoff
// ─────────────────────────────────────────────────────────────
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === max - 1) {
        localStorage.setItem(
          `${LS_PREFIX}failed_upload_${Date.now()}`,
          JSON.stringify({ filename, payload, error: err.message })
        );
        throw err;
      }
      await new Promise(r => setTimeout(r, 800 * Math.pow(2, attempt)));
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Module-level participant record (persists across re-renders)
// ─────────────────────────────────────────────────────────────
let participantRecord = null;

function initParticipantRecord(prolificID, sessionID, studyID, testSession) {
  const urlParams = getURLParams();
  const pid = prolificID || (testSession ? `test_${generateUUID()}` : generateUUID());
  const condition = assignCondition(pid);
  const stimuli = sampleStimuli(pid, TOTAL_TRIALS);
  const completionCode = generateCompletionCode();

  participantRecord = {
    experimentName: 'whyask_main',
    version: '1.0.0',
    participantID: generateUUID(),
    prolificID: pid,
    prolificSessionID: sessionID || '',
    prolificStudyID: studyID || '',
    testSession: testSession || false,
    completionCode,
    orderCondition: condition,
    stimuliShown: stimuli.map(s => String(s.itemID)),
    rngSeed: hashStr(pid),
    timestamps: {
      studyStart: Date.now(),
      consentGiven: null,
      instructionsDone: null,
      walkthroughDone: null,
      practiceDone: null,
      comprehensionPassed: null,
      trialsStart: null,
      trialsDone: null,
      reflectionDone: null,
      demographicsDone: null,
      studyComplete: null,
    },
    browser: {
      userAgent: navigator.userAgent,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      languages: Array.from(navigator.languages || [navigator.language]),
      platform: navigator.platform || '',
    },
    comprehension: { attempts: 0, wrongPicks: [], timeToCorrectMs: null },
    trials: [],
    reflection: null,
    demographics: null,
    events: [],
    turnstileToken: null,
    rtSessionId: null,
    // sampled stimuli stored for trial rendering
    _stimuli: stimuli,
  };

  // Roundtable user ID
  if (window.setRoundtableUserId) {
    try { window.setRoundtableUserId(pid); } catch (e) {}
  }

  // capture Roundtable session ID
  try {
    participantRecord.rtSessionId = sessionStorage.getItem('rtSessionId') || null;
  } catch (e) {}

  return participantRecord;
}

function logEvent(kind, extra = {}) {
  if (!participantRecord) return;
  participantRecord.events.push({ t: Date.now(), kind, ...extra });
}

// ─────────────────────────────────────────────────────────────
// localStorage persistence
// ─────────────────────────────────────────────────────────────
function saveState(screenIdx, trialIdx) {
  if (!participantRecord) return;
  try {
    const state = {
      screenIdx,
      trialIdx,
      participantID: participantRecord.participantID,
      prolificID: participantRecord.prolificID,
      completionCode: participantRecord.completionCode,
      orderCondition: participantRecord.orderCondition,
      stimuliShown: participantRecord.stimuliShown,
      trials: participantRecord.trials,
      comprehensionPassed: participantRecord.comprehension.timeToCorrectMs !== null,
      comprehension: participantRecord.comprehension,
      reflection: participantRecord.reflection,
      demographics: participantRecord.demographics,
      events: participantRecord.events,
      timestamps: participantRecord.timestamps,
      savedAt: Date.now(),
    };
    localStorage.setItem(`${LS_PREFIX}state`, JSON.stringify(state));
    localStorage.setItem(`${LS_PREFIX}participantID`, participantRecord.participantID);
  } catch (e) {}
}

function loadSavedState() {
  try {
    const pid = localStorage.getItem(`${LS_PREFIX}participantID`);
    const raw = localStorage.getItem(`${LS_PREFIX}state`);
    const completed = localStorage.getItem(`${LS_PREFIX}completionSent`);
    if (!pid || !raw || completed === 'true') return null;
    return { participantID: pid, ...JSON.parse(raw) };
  } catch (e) {
    return null;
  }
}

function clearLocalStorage() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

// ─────────────────────────────────────────────────────────────
// Error Boundary
// ─────────────────────────────────────────────────────────────
class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    logEvent('fatal_error', { message: error.message, stack: info ? info.componentStack : '' });
    try {
      localStorage.setItem(
        `${LS_PREFIX}fatal_${Date.now()}`,
        JSON.stringify({ error: error.message, stack: info ? info.componentStack : '' })
      );
    } catch {}
  }
  render() {
    if (this.state.error) {
      const pid = participantRecord ? participantRecord.participantID : 'unknown';
      return (
        <div className="fm-block-screen">
          <div className="fm-card" style={{ maxWidth: 600, textAlign: 'left' }}>
            <p className="fm-eyebrow">— something went wrong —</p>
            <h1 className="fm-title small">We hit an unexpected error</h1>
            <p className="fm-body">
              Please refresh the page. If the issue persists, contact the researcher
              at <a href={`mailto:${RESEARCHER_EMAIL}`}>{RESEARCHER_EMAIL}</a> with this ID:
            </p>
            <div className="fm-code">{pid}</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────
// Block screens
// ─────────────────────────────────────────────────────────────
function BlockScreen({ reason }) {
  const messages = {
    mobile: {
      title: 'This study requires a computer',
      body: 'This study requires typing on a computer keyboard. Please open this link on a laptop or desktop computer.',
    },
    viewport_small: {
      title: 'Your browser window is too small',
      body: 'Please make your window at least 1024 × 600 pixels and refresh.',
    },
    browser: {
      title: 'Please use a supported browser',
      body: 'Please open this link in Chrome, Safari, Firefox, or Edge.',
    },
    storage: {
      title: 'Please enable browser storage',
      body: 'Please enable cookies and local storage in your browser settings.',
    },
  };
  const msg = messages[reason] || { title: 'Unsupported', body: 'Please use a supported device and browser.' };
  return (
    <div className="fm-block-screen">
      <div className="fm-card" style={{ maxWidth: 560, textAlign: 'center' }}>
        <p className="fm-eyebrow">— unable to continue —</p>
        <h1 className="fm-title small">{msg.title}</h1>
        <p className="fm-body">{msg.body}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shell — brand strip + progress bar wrapper
// ─────────────────────────────────────────────────────────────
function Shell({ screenIdx, trialIdx, trialTotal, posLabel, children }) {
  const { fillPct, sectionStarts, sectionIdx } = progressInfo(screenIdx, trialIdx, trialTotal);
  const sect = SECTIONS[sectionIdx];
  const trialLbl = (trialIdx != null && trialTotal != null)
    ? `trial ${String(trialIdx).padStart(2, '0')} / ${trialTotal}`
    : (posLabel || '');
  return (
    <div className="fm">
      <div className="fm-brand">
        <span className="fm-brand-lab">Social Interaction Lab</span>
        <span className="fm-brand-sep">·</span>
        <span className="fm-brand-uni">Stanford University</span>
      </div>
      <header className="fm-top">
        <div className="fm-top-row">
          <span className="fm-top-section">
            section <b>{String(sectionIdx + 1).padStart(2, '0')}</b> / {SECTIONS.length} · <b>{sect.name}</b>
          </span>
          {trialLbl && <span className="fm-top-trial">{trialLbl}</span>}
        </div>
        <div className="fm-top-bar">
          <div className="fm-top-fill" style={{ width: fillPct + '%' }} />
          {sectionStarts.slice(1).map((s, i) => (
            <div key={i} className="fm-top-tick" style={{ left: s + '%' }} />
          ))}
        </div>
      </header>
      <main className="fm-stage">{children}</main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Consent modal
// ─────────────────────────────────────────────────────────────
function ConsentModal({ onClose }) {
  return (
    <div className="fm-modal-overlay" onClick={onClose}>
      <div className="fm-modal" onClick={e => e.stopPropagation()}>
        <button className="fm-modal-close" onClick={onClose}>×</button>
        <p style={{ fontFamily: 'var(--c-mono)', fontSize: 10, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--c-accent)', fontWeight: 700, margin: '0 0 14px' }}>
          — informed consent —
        </p>
        <h2 style={{ fontFamily: 'var(--c-serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-.5px', margin: '0 0 18px', color: 'var(--c-ink)' }}>
          Everyday Questions
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--c-muted)', margin: '0 0 14px' }}>
          <strong style={{ color: 'var(--c-ink)' }}>Stanford University · Social Interaction Lab</strong>
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--c-muted)', margin: '0 0 14px' }}>
          Thank you for your interest in our study. You are invited to take part in a research study
          about how people interpret everyday questions and situations. The study takes about
          <strong style={{ color: 'var(--c-ink)' }}> ~X minutes</strong> and you will receive
          <strong style={{ color: 'var(--c-ink)' }}> $X via Prolific</strong> for your participation.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--c-muted)', margin: '0 0 14px' }}>
          <strong style={{ color: 'var(--c-ink)' }}>Voluntary participation.</strong> Your participation
          is completely voluntary. You may withdraw at any time without penalty or loss of compensation
          for the portion of the study completed.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--c-muted)', margin: '0 0 14px' }}>
          <strong style={{ color: 'var(--c-ink)' }}>Eligibility.</strong> You must be at least 18 years
          old to participate and a native English speaker.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--c-muted)', margin: '0 0 14px' }}>
          <strong style={{ color: 'var(--c-ink)' }}>Risks and benefits.</strong> There are no known risks
          associated with this research beyond those of everyday internet use. You will not directly
          benefit from participation, but your responses will contribute to scientific understanding
          of how people interpret everyday language.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--c-muted)', margin: '0 0 14px' }}>
          <strong style={{ color: 'var(--c-ink)' }}>Confidentiality.</strong> Your responses will be
          kept anonymous. No personally identifying information will be collected or linked to your data.
          Data will be stored securely and used only for research purposes.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--c-muted)', margin: '0 0 14px' }}>
          <strong style={{ color: 'var(--c-ink)' }}>Contact.</strong> If you have questions about this
          study, please contact us at{' '}
          <a href={`mailto:${RESEARCHER_EMAIL}`} style={{ color: 'var(--c-accent)' }}>{RESEARCHER_EMAIL}</a>.
          For questions about your rights as a research participant, please contact the Stanford
          University Institutional Review Board (IRB) at (650) 723-2480 or{' '}
          <a href="mailto:irbnonmed@stanford.edu" style={{ color: 'var(--c-accent)' }}>irbnonmed@stanford.edu</a>.
        </p>
        <hr style={{ border: 'none', borderTop: '1px solid var(--c-hairline)', margin: '20px 0' }} />
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--c-muted)', margin: '0 0 20px', fontStyle: 'italic' }}>
          By continuing, I confirm that I am 18 or older, have read and understood the information
          above, and agree to participate voluntarily.
        </p>
        <button className="fm-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 01 · Welcome / Consent
// ─────────────────────────────────────────────────────────────
function PWelcome({ onNext }) {
  const [consented, setConsented] = useState(false);
  const [turnstilePassed, setTurnstilePassed] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [turnstileError, setTurnstileError] = useState(false);
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);

  // render Turnstile widget — poll until api.js is ready, then render w/ direct function refs
  useEffect(() => {
    let pollTimer = null;
    function tryRender() {
      if (widgetIdRef.current) return; // already rendered
      if (typeof window.turnstile !== 'undefined' && turnstileRef.current) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: '0x4AAAAAADGmnrY--98hEDoP',
          callback: (token) => {
            if (participantRecord) participantRecord.turnstileToken = token;
            logEvent('turnstile_passed');
            setTurnstilePassed(true);
          },
          'error-callback': () => {
            logEvent('turnstile_error');
            setTurnstileError(true);
          },
        });
      } else {
        pollTimer = setTimeout(tryRender, 100);
      }
    }
    tryRender();
    return () => { if (pollTimer) clearTimeout(pollTimer); };
  }, []);

  const canBegin = consented && turnstilePassed;

  function handleBegin() {
    if (!canBegin) return;
    if (participantRecord) participantRecord.timestamps.consentGiven = Date.now();
    logEvent('consent_given');
    // request fullscreen after Turnstile succeeded
    (async () => {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        logEvent('fullscreen_denied', { error: err.message });
      }
    })();
    onNext();
  }

  return (
    <Shell screenIdx={0} posLabel="consent">
      {showConsent && <ConsentModal onClose={() => setShowConsent(false)} />}
      <div className="fm-card">
        <p className="fm-eyebrow">— a short research study —</p>
        <h1 className="fm-title">Everyday Questions</h1>
        <p className="fm-body">
          You'll read short, everyday scenarios in which one person asks another a
          question like <em>"Can you give me a quick trim?"</em>. After each scenario,
          we'll ask what you think the speaker meant and how you'd respond.
        </p>
        <p className="fm-body">
          We're studying how people interpret these questions in everyday situations.
          There are no right or wrong answers — we just want your natural read.
        </p>
        <div className="fm-meta">
          <div className="fm-meta-block">
            <div className="fm-meta-k">Time</div>
            <div className="fm-meta-v">About ~X min</div>
          </div>
          <div className="fm-meta-block">
            <div className="fm-meta-k">Payment</div>
            <div className="fm-meta-v">$X via Prolific</div>
          </div>
          <div className="fm-meta-block">
            <div className="fm-meta-k">Scenarios</div>
            <div className="fm-meta-v">~X short items</div>
          </div>
        </div>
        {/* Turnstile widget */}
        <div ref={turnstileRef} style={{ marginBottom: 16 }} />
        {turnstileError && (
          <p style={{ fontSize: 13, color: 'var(--c-warn)', marginBottom: 12 }}>
            Verification failed. Please refresh the page and try again.
          </p>
        )}
        <div
          className="fm-consent"
          onClick={() => setConsented(!consented)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <div className={"fm-consent-cb" + (consented ? " on" : "")} />
          <div className="fm-consent-text">
            I am 18 or older, have read the consent form, and agree to participate.
            I understand my responses will be stored anonymously and used for research purposes.
          </div>
        </div>
        <div className="fm-foot">
          <button className="fm-btn ghost" onClick={() => setShowConsent(true)}>
            View full consent form
          </button>
          <button className="fm-btn" disabled={!canBegin} onClick={handleBegin}>
            Begin study →
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 02 · Instructions
// ─────────────────────────────────────────────────────────────
function PInstructions({ onNext, onBack }) {
  function handleBack() {
    logEvent('back_button', { from: 'instructions', to: 'welcome' });
    onBack();
  }
  return (
    <Shell screenIdx={1} posLabel="how this works">
      <div className="fm-card">
        <p className="fm-eyebrow">— about this task —</p>
        <h1 className="fm-title small">What "Can you…?" can mean</h1>
        <p className="fm-body">
          When someone asks <em>"Can you pass the salt?"</em>, they usually want
          the salt. But <em>"Can you swim?"</em> might really be asking about your ability.
          People mean different things by these questions depending on context.
        </p>
        <p className="fm-section-label">— for each scenario, you'll —</p>
        <ul className="fm-list">
          <li>Tell us what you took the question to mean</li>
          <li>Tell us how you would respond to it</li>
        </ul>
        <p className="fm-body">
          Answer in your own words — a sentence or two each. There's no right answer.
        </p>
        <div className="fm-foot">
          <button className="fm-btn ghost" onClick={handleBack}>← Back</button>
          <button className="fm-btn" onClick={() => {
            if (participantRecord) participantRecord.timestamps.instructionsDone = Date.now();
            onNext();
          }}>Continue →</button>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 03 · Walkthrough — animated typing demo
// ─────────────────────────────────────────────────────────────
const DEMO_ANS_1 = "they want me to actually cut their hair";
const DEMO_ANS_2 = "yeah of course, come by tonight";

function PWalkthrough({ onNext, onBack }) {
  const [phase, setPhase] = useState(0); // 0=typing ans1, 1=typing ans2, 2=done
  const [ans1, setAns1] = useState('');
  const [ans2, setAns2] = useState('');

  useEffect(() => {
    let timer;
    if (phase === 0) {
      if (ans1.length < DEMO_ANS_1.length) {
        timer = setTimeout(() => setAns1(DEMO_ANS_1.slice(0, ans1.length + 1)), 35);
      } else {
        timer = setTimeout(() => setPhase(1), 600);
      }
    } else if (phase === 1) {
      if (ans2.length < DEMO_ANS_2.length) {
        timer = setTimeout(() => setAns2(DEMO_ANS_2.slice(0, ans2.length + 1)), 35);
      } else {
        timer = setTimeout(() => setPhase(2), 400);
      }
    }
    return () => clearTimeout(timer);
  }, [phase, ans1, ans2]);

  function handleBack() {
    logEvent('back_button', { from: 'walkthrough', to: 'instructions' });
    onBack();
  }

  return (
    <Shell screenIdx={2} posLabel="quick demo">
      <div className="fm-card">
        <p className="fm-eyebrow">— quick walkthrough —</p>
        <h1 className="fm-title small">Here's what a trial looks like</h1>
        <div className="fm-demo">
          <p className="fm-demo-scenario">
            A close friend desperately needs a haircut and can't get an
            appointment in time. Not knowing who else to ask, they call you and say:
          </p>
          <p className="fm-demo-utt">Can you give me a quick trim?</p>
          <p className="fm-demo-q"><span className="num">01</span> what they meant by asking</p>
          <div className={"fm-demo-ans" + (phase === 0 ? " typing" : "") + (!ans1 ? " empty" : "")}>
            {ans1 || '…'}
          </div>
          <p className="fm-demo-q"><span className="num">02</span> how you'd respond</p>
          <div className={"fm-demo-ans" + (phase === 1 ? " typing" : "") + (!ans2 ? " empty" : "")}>
            {ans2 || '…'}
          </div>
        </div>
        <div className="fm-foot">
          <button className="fm-btn ghost" onClick={handleBack}>← Back</button>
          <button className="fm-btn" disabled={phase < 2} onClick={() => {
            if (participantRecord) participantRecord.timestamps.walkthroughDone = Date.now();
            onNext();
          }}>
            Try a practice trial →
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// Reusable TrialForm — box-02 slide-in, timing, keystroke counts
// ─────────────────────────────────────────────────────────────
function TrialForm({
  scenario, utterance, onSubmit,
  submitLabel = 'Continue →', footHint, isPractice = false,
  condition = 'AW', // AW: interp=box01, resp=box02; WA: resp=box01, interp=box02
  onIdleReset,      // call this on any keystroke so parent can reset idle timer
}) {
  const [box1Val, setBox1Val] = useState('');
  const [box2Val, setBox2Val] = useState('');
  const [box2Visible, setBox2Visible] = useState(false);

  // timing refs
  const shownAtMs = useRef(Date.now());
  const box1FirstKeystroke = useRef(null);
  const box2FirstKeystroke = useRef(null);
  const box1Keystrokes = useRef(0);
  const box2Keystrokes = useRef(0);
  const box2RevealedAt = useRef(null);

  const isAW = condition === 'AW';
  const box1Prompt = isAW ? 'what they meant by asking' : 'how you\'d respond';
  const box2Prompt = isAW ? 'how you\'d respond' : 'what they meant by asking';
  const box1Placeholder = isAW ? 'A sentence or two…' : 'What you\'d say, or do…';
  const box2Placeholder = isAW ? 'What you\'d say, or do…' : 'A sentence or two…';

  const ready = box1Val.trim().length > 0 && box2Val.trim().length > 0;

  // slide in box 02 after 700ms pause in box 01
  useEffect(() => {
    if (box2Visible) return;
    if (box1Val.trim().length < 3) return;
    const t = setTimeout(() => {
      setBox2Visible(true);
      box2RevealedAt.current = Date.now();
    }, 700);
    return () => clearTimeout(t);
  }, [box1Val, box2Visible]);

  function handleBox1Change(e) {
    const val = e.target.value;
    setBox1Val(val);
    if (!box1FirstKeystroke.current && val.length > 0) {
      box1FirstKeystroke.current = Date.now();
    }
    box1Keystrokes.current++;
    if (onIdleReset) onIdleReset();
  }

  function handleBox2Change(e) {
    const val = e.target.value;
    setBox2Val(val);
    if (!box2FirstKeystroke.current && val.length > 0) {
      box2FirstKeystroke.current = Date.now();
    }
    box2Keystrokes.current++;
    if (onIdleReset) onIdleReset();
  }

  function handleSubmit() {
    const submittedAtMs = Date.now();
    const interpVal = isAW ? box1Val : box2Val;
    const respVal = isAW ? box2Val : box1Val;
    const interpFirstKeystroke = isAW ? box1FirstKeystroke.current : box2FirstKeystroke.current;
    const respFirstKeystroke = isAW ? box2FirstKeystroke.current : box1FirstKeystroke.current;
    const interpKs = isAW ? box1Keystrokes.current : box2Keystrokes.current;
    const respKs = isAW ? box2Keystrokes.current : box1Keystrokes.current;

    onSubmit({
      interp: interpVal,
      resp: respVal,
      shownAtMs: shownAtMs.current,
      submittedAtMs,
      totalTimeMs: submittedAtMs - shownAtMs.current,
      timeToFirstInterpKeystrokeMs: interpFirstKeystroke ? interpFirstKeystroke - shownAtMs.current : null,
      timeToFirstRespKeystrokeMs: respFirstKeystroke ? respFirstKeystroke - shownAtMs.current : null,
      interpKeystrokes: interpKs,
      respKeystrokes: respKs,
      box2RevealedAtMs: box2RevealedAt.current,
      characters: { interp: interpVal.length, resp: respVal.length },
    });
  }

  const hint = footHint || (ready ? 'auto-saved' : 'both responses required to continue');

  return (
    <div className="fm-card">
      {isPractice && <span className="fm-practice-tag">practice — not recorded</span>}
      <p className="fm-scenario">{scenario}</p>
      <p className="fm-utt">{utterance}</p>

      <div className="fm-q">
        <p className="fm-q-prompt"><span className="fm-q-num">01</span> {box1Prompt}</p>
        <textarea
          className={"fm-ta" + (box1Val ? " filled" : "")}
          placeholder={box1Placeholder}
          value={box1Val}
          onChange={handleBox1Change}
          autoFocus
        />
      </div>

      <div className={"fm-q fm-q-reveal" + (box2Visible ? " in" : "")}>
        <p className="fm-q-prompt"><span className="fm-q-num">02</span> {box2Prompt}</p>
        <textarea
          className={"fm-ta" + (box2Val ? " filled" : "")}
          placeholder={box2Placeholder}
          value={box2Val}
          onChange={handleBox2Change}
        />
      </div>

      <div className="fm-foot">
        <span className="fm-foot-hint">{hint}</span>
        <button
          className="fm-btn"
          disabled={!ready}
          onClick={handleSubmit}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 04 · Practice trial
// ─────────────────────────────────────────────────────────────
function PPractice({ onNext, onBack }) {
  const condition = participantRecord ? participantRecord.orderCondition : 'AW';
  function handleBack() {
    logEvent('back_button', { from: 'practice', to: 'walkthrough' });
    onBack();
  }
  return (
    <Shell screenIdx={3} posLabel="practice">
      <TrialForm
        isPractice
        scenario="You're at a friend's apartment helping them pack. The boxes are stacked near the door. They turn to you and say:"
        utterance="Can you grab the tape?"
        condition={condition}
        onSubmit={() => {
          if (participantRecord) participantRecord.timestamps.practiceDone = Date.now();
          onNext();
        }}
        footHint={null}
      />
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 05 · Comprehension check
// ─────────────────────────────────────────────────────────────
function PComprehension({ onNext, onBack }) {
  const [pick, setPick] = useState(null);
  const startTimeRef = useRef(Date.now());
  const correct = pick === 0;

  function handlePick(i) {
    setPick(i);
    if (participantRecord) {
      participantRecord.comprehension.attempts++;
      if (i !== 0) {
        participantRecord.comprehension.wrongPicks.push(i);
        logEvent('comprehension_wrong', { pickedIdx: i });
      }
    }
  }

  function handleNext() {
    if (!correct) return;
    if (participantRecord) {
      participantRecord.comprehension.timeToCorrectMs = Date.now() - startTimeRef.current;
      participantRecord.timestamps.comprehensionPassed = Date.now();
    }
    logEvent('comprehension_passed');
    onNext();
  }

  function handleBack() {
    logEvent('back_button', { from: 'comprehension', to: 'practice' });
    onBack();
  }

  return (
    <Shell screenIdx={4} posLabel="quick check">
      <div className="fm-card">
        <p className="fm-eyebrow">— quick check —</p>
        <h1 className="fm-title small">Just to make sure</h1>
        <p className="fm-body">
          When someone asks <em>"Can you give me a quick trim?"</em> —
          which response goes in the <strong>first</strong> box?
        </p>
        <div className="fm-radio-group">
          {[
            { i: 0, text: 'what they meant by asking the question' },
            { i: 1, text: 'what I would say or do in response' },
          ].map((opt) => {
            const sel = pick === opt.i;
            const state = sel ? (opt.i === 0 ? 'correct' : 'wrong') : '';
            return (
              <div
                key={opt.i}
                className={"fm-radio" + (sel ? ' selected ' + state : '')}
                onClick={() => handlePick(opt.i)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <div className="fm-radio-dot" />
                <div className="fm-radio-text">{opt.text}</div>
              </div>
            );
          })}
        </div>
        {pick === 1 && (
          <p className="fm-body fine" style={{ color: 'var(--c-warn)', fontStyle: 'italic' }}>
            Not quite — the first box is for your interpretation of what they meant.
            The second is for how you'd respond. Pick the other option.
          </p>
        )}
        {pick === 0 && (
          <p className="fm-body fine" style={{ color: 'var(--c-success)', fontStyle: 'italic' }}>
            Right — what they meant by asking goes in the first box, how you'd respond goes in the second.
          </p>
        )}
        <div className="fm-foot">
          <span className="fm-foot-hint">{correct ? '' : (pick !== null ? 'answer correctly to continue' : '')}</span>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="fm-btn ghost" onClick={handleBack}>← Back</button>
            <button className="fm-btn" disabled={!correct} onClick={handleNext}>
              Begin the {TOTAL_TRIALS} scenarios →
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// Idle toast
// ─────────────────────────────────────────────────────────────
function IdleToast({ onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="fm-toast">
      <span className="fm-toast-dot" />
      Still there? Your progress is saved.
      <button className="fm-toast-dismiss" onClick={onDismiss}>×</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 06 · Main trials
// ─────────────────────────────────────────────────────────────
function PTrial({ trialIdx, onNext, onHalfwaySave }) {
  const [showIdleToast, setShowIdleToast] = useState(false);
  const idleTimerRef = useRef(null);

  const stimuli = participantRecord ? participantRecord._stimuli : [];
  const condition = participantRecord ? participantRecord.orderCondition : 'AW';
  const t = stimuli[trialIdx - 1] || {};
  // stimuli file uses vignette + actionPhrase
  const scenario = t.vignette || t.scenario || '';
  const utterance = t.actionPhrase
    ? `Can you ${t.actionPhrase}?`
    : (t.utterance || '');

  // idle 30s timer — reset on any keystroke via onIdleReset
  function resetIdleTimer() {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (showIdleToast) {
      setShowIdleToast(false);
      logEvent('idle_warning_dismissed');
    }
    idleTimerRef.current = setTimeout(() => {
      setShowIdleToast(true);
      logEvent('idle_warning_shown', { afterMs: 30000 });
      // 2 min total inactivity → save to localStorage
      setTimeout(() => {
        try {
          localStorage.setItem(
            `${LS_PREFIX}idle_save`,
            JSON.stringify({ ...participantRecord, savedAt: Date.now() })
          );
        } catch (e) {}
      }, 90000); // 90s more after 30s = 2min total
    }, 30000);
  }

  useEffect(() => {
    resetIdleTimer();
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [trialIdx]);

  function handleSubmit(timingData) {
    if (!participantRecord) return;
    const trialRecord = {
      itemID: String(t.itemID),
      trialIdx,
      scenario,
      utterance,
      interpretation: timingData.interp,
      response: timingData.resp,
      order: condition,
      shownAtMs: timingData.shownAtMs,
      submittedAtMs: timingData.submittedAtMs,
      totalTimeMs: timingData.totalTimeMs,
      timeToFirstInterpKeystrokeMs: timingData.timeToFirstInterpKeystrokeMs,
      timeToFirstRespKeystrokeMs: timingData.timeToFirstRespKeystrokeMs,
      interpKeystrokes: timingData.interpKeystrokes,
      respKeystrokes: timingData.respKeystrokes,
      interpRevisions: 0,
      respRevisions: 0,
      box2RevealedAtMs: timingData.box2RevealedAtMs,
      characters: timingData.characters,
    };
    participantRecord.trials.push(trialRecord);

    if (trialIdx === 15) {
      onHalfwaySave();
    }

    if (trialIdx === TOTAL_TRIALS) {
      participantRecord.timestamps.trialsDone = Date.now();
    }

    onNext();
  }

  return (
    <Shell screenIdx={5} trialIdx={trialIdx} trialTotal={TOTAL_TRIALS}>
      <TrialForm
        key={trialIdx}
        scenario={scenario}
        utterance={utterance}
        condition={condition}
        onSubmit={handleSubmit}
        submitLabel={trialIdx === TOTAL_TRIALS ? 'Finish trials →' : 'Continue →'}
        onIdleReset={resetIdleTimer}
      />
      {showIdleToast && <IdleToast onDismiss={() => {
        setShowIdleToast(false);
        logEvent('idle_warning_dismissed');
      }} />}
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 07 · Reflection
// ─────────────────────────────────────────────────────────────
function PStrategy({ onNext }) {
  const [a1, setA1] = useState('');
  const [a2, setA2] = useState('');
  const ready = a1.trim().length > 0 && a2.trim().length > 0;
  return (
    <Shell screenIdx={6} posLabel="reflection">
      <div className="fm-card">
        <p className="fm-eyebrow">— almost done —</p>
        <h1 className="fm-title small">Two quick reflections</h1>
        <div className="fm-q">
          <p className="fm-q-prompt"><span className="fm-q-num">01</span> how did you decide what people meant by their questions?</p>
          <textarea
            className={"fm-ta" + (a1 ? " filled" : "")}
            value={a1} onChange={e => setA1(e.target.value)}
            placeholder="Tell us about your approach…"
          />
        </div>
        <div className="fm-q">
          <p className="fm-q-prompt"><span className="fm-q-num">02</span> how did you tell apart questions about ability vs. requests for action?</p>
          <textarea
            className={"fm-ta" + (a2 ? " filled" : "")}
            value={a2} onChange={e => setA2(e.target.value)}
            placeholder="What helped you distinguish them…"
          />
        </div>
        <div className="fm-foot">
          <span className="fm-foot-hint">{ready ? 'auto-saved' : 'both required'}</span>
          <button className="fm-btn" disabled={!ready} onClick={() => {
            if (participantRecord) {
              participantRecord.reflection = { approach: a1, distinguishing: a2 };
              participantRecord.timestamps.reflectionDone = Date.now();
            }
            onNext();
          }}>Continue →</button>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 08 · Demographics
// ─────────────────────────────────────────────────────────────
function PDemographics({ onNext }) {
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [lang, setLang] = useState('');
  const [edu, setEdu] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);

  const ready = age.trim() && lang.trim() && edu.trim();

  async function handleSubmit() {
    if (!ready || saving) return;
    if (participantRecord) {
      participantRecord.demographics = {
        age: age.trim(),
        gender: gender.trim(),
        nativeLanguage: lang.trim(),
        education: edu.trim(),
      };
      participantRecord.timestamps.demographicsDone = Date.now();
      participantRecord.timestamps.studyComplete = Date.now();
    }
    setSaving(true);
    try {
      await uploadToDataPipe(participantRecord, { partial: false });
      localStorage.setItem(`${LS_PREFIX}completionSent`, 'true');
      clearLocalStorage();
      // remove beforeunload warning on success
      window.onbeforeunload = null;
      onNext();
    } catch (err) {
      setSaving(false);
      setUploadFailed(true);
    }
  }

  if (uploadFailed) {
    const pid = participantRecord ? participantRecord.participantID : 'unknown';
    return (
      <Shell screenIdx={7} posLabel="about you">
        <div className="fm-card">
          <p className="fm-eyebrow">— almost there —</p>
          <h1 className="fm-title small">Your data is saved locally</h1>
          <p className="fm-body">
            Your responses were collected but couldn't be sent to our server right now.
            Please email <a href={`mailto:${RESEARCHER_EMAIL}`}>{RESEARCHER_EMAIL}</a> with
            the ID below — your data is preserved and we'll process it manually.
          </p>
          <div className="fm-code">{pid}</div>
          <div className="fm-foot">
            <span className="fm-foot-hint" />
            <button className="fm-btn" onClick={handleSubmit}>Retry →</button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell screenIdx={7} posLabel="about you">
      <div className="fm-card">
        <p className="fm-eyebrow">— one more thing —</p>
        <h1 className="fm-title small">A bit about you</h1>
        <p className="fm-body fine" style={{ marginBottom: 22 }}>
          Optional, but helpful for analyzing the data. All responses remain anonymous.
        </p>
        <div className="fm-field">
          <label className="fm-field-lbl">Age</label>
          <input
            className={"fm-input" + (age ? " filled" : "")}
            value={age} onChange={e => setAge(e.target.value)}
            placeholder="e.g. 27"
          />
        </div>
        <div className="fm-field">
          <label className="fm-field-lbl">Gender (self-describe, optional)</label>
          <input
            className={"fm-input" + (gender ? " filled" : "")}
            value={gender} onChange={e => setGender(e.target.value)}
            placeholder="how you'd describe your gender"
          />
        </div>
        <div className="fm-field">
          <label className="fm-field-lbl">Native language</label>
          <input
            className={"fm-input" + (lang ? " filled" : "")}
            value={lang} onChange={e => setLang(e.target.value)}
            placeholder="e.g. English"
          />
        </div>
        <div className="fm-field">
          <label className="fm-field-lbl">Highest level of education</label>
          <input
            className={"fm-input" + (edu ? " filled" : "")}
            value={edu} onChange={e => setEdu(e.target.value)}
            placeholder="e.g. bachelor's degree"
          />
        </div>
        <div className="fm-foot">
          <span className="fm-foot-hint">{ready ? 'ready to submit' : 'required fields needed'}</span>
          <button className="fm-btn" disabled={!ready || saving} onClick={handleSubmit}>
            {saving ? 'Saving…' : 'Submit →'}
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 09 · Completion
// ─────────────────────────────────────────────────────────────
function PCompletion() {
  const [countdown, setCountdown] = useState(3);
  const code = participantRecord ? participantRecord.completionCode : 'CY-XXXX-XXXX';
  const prolificURL = `https://app.prolific.com/submissions/complete?cc=${PROLIFIC_COMPLETION_CODE}`;

  useEffect(() => {
    if (countdown <= 0) {
      window.location.href = prolificURL;
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <Shell screenIdx={8} posLabel="complete">
      <div className="fm-card">
        <div className="fm-success-badge" />
        <p className="fm-eyebrow">— study complete —</p>
        <h1 className="fm-title">Thank you</h1>
        <p className="fm-body">
          Your responses have been recorded. The data you provided will help
          us understand how people interpret everyday requests.
        </p>
        <p className="fm-section-label">— your completion code —</p>
        <div className="fm-code">{code}</div>
        <p className="fm-body fine">
          Copy this code into Prolific to receive your payment. If you have
          any issues, contact the researcher via your Prolific dashboard.
        </p>
        <div className="fm-foot">
          <span className="fm-foot-hint">
            {countdown > 0 ? `redirecting in ${countdown}s…` : 'redirecting…'}
          </span>
          <button className="fm-btn" onClick={() => { window.location.href = prolificURL; }}>
            Return to Prolific ↗
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// Resume splash
// ─────────────────────────────────────────────────────────────
function ResumeSplash({ onResume, onStartOver }) {
  return (
    <div className="fm-resume-overlay">
      <div className="fm-card" style={{ maxWidth: 560, textAlign: 'center' }}>
        <p className="fm-eyebrow">— welcome back —</p>
        <h1 className="fm-title small">Continue where you left off?</h1>
        <p className="fm-body">You started this study earlier. We saved your progress.</p>
        <div className="fm-foot" style={{ justifyContent: 'center', gap: 16 }}>
          <button className="fm-btn ghost" onClick={onStartOver}>Start over</button>
          <button className="fm-btn" onClick={onResume}>Resume →</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Viewport lock overlay (mid-study)
// ─────────────────────────────────────────────────────────────
function ViewportLockOverlay() {
  return (
    <div className="fm-block-overlay">
      <div className="fm-card" style={{ maxWidth: 480, textAlign: 'center' }}>
        <p className="fm-eyebrow">— please resize your window —</p>
        <h1 className="fm-title small">Your browser is too small</h1>
        <p className="fm-body">
          Please make your window at least 1024 × 600 pixels.
          The study will resume automatically.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Fullscreen banner
// ─────────────────────────────────────────────────────────────
function FullscreenBanner({ onReenter }) {
  return (
    <div className="fm-fullscreen-banner">
      You exited fullscreen.{' '}
      <a onClick={onReenter}>Return to fullscreen</a>{' '}
      for the best experience.
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// App — main state machine
// ─────────────────────────────────────────────────────────────
function App() {
  const [screenIdx, setScreenIdx] = useState(null); // null = initializing
  const [trialIdx, setTrialIdx] = useState(1);
  const [showResume, setShowResume] = useState(false);
  const [blockReason, setBlockReason] = useState(null);
  const [viewportLocked, setViewportLocked] = useState(false);
  const [showFullscreenBanner, setShowFullscreenBanner] = useState(false);

  // ── init on mount ──
  useEffect(() => {
    // entry check
    const check = checkEntry();
    if (!check.ok) {
      setBlockReason(check.reason);
      setScreenIdx(-1);
      return;
    }

    // check for saved session
    const saved = loadSavedState();
    if (saved) {
      setShowResume(true);
      // init participantRecord with a placeholder; will be filled on resume/startover
      const urlP = getURLParams();
      initParticipantRecord(urlP.prolificID, urlP.sessionID, urlP.studyID, urlP.testSession);
      setScreenIdx(0); // won't show until resume splash dismissed
      return;
    }

    // fresh session
    const urlP = getURLParams();
    initParticipantRecord(urlP.prolificID, urlP.sessionID, urlP.studyID, urlP.testSession);
    setScreenIdx(0);
  }, []);

  // ── tab visibility ──
  useEffect(() => {
    function handleVisibility() {
      logEvent(document.hidden ? 'tab_hidden' : 'tab_visible');
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ── viewport resize listener ──
  useEffect(() => {
    function handleResize() {
      const locked = window.innerWidth < 1024 || window.innerHeight < 600;
      setViewportLocked(prev => {
        if (locked && !prev) {
          logEvent('viewport_lock', { w: window.innerWidth, h: window.innerHeight });
        } else if (!locked && prev) {
          logEvent('viewport_unlock', { w: window.innerWidth, h: window.innerHeight });
        }
        return locked;
      });
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── fullscreen change listener ──
  useEffect(() => {
    function handleFSChange() {
      if (!document.fullscreenElement && screenIdx > 0 && screenIdx < 8) {
        logEvent('fullscreen_exit');
        setShowFullscreenBanner(true);
      } else if (document.fullscreenElement) {
        setShowFullscreenBanner(false);
      }
    }
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, [screenIdx]);

  // ── beforeunload warning (active during study) ──
  useEffect(() => {
    if (screenIdx > 0 && screenIdx < 8) {
      window.onbeforeunload = () => 'Your progress will be lost if you leave. Are you sure?';
    } else {
      window.onbeforeunload = null;
    }
    return () => { window.onbeforeunload = null; };
  }, [screenIdx]);

  // ── save state on screen transitions ──
  useEffect(() => {
    if (screenIdx !== null && screenIdx >= 0 && participantRecord) {
      saveState(screenIdx, trialIdx);
    }
  }, [screenIdx, trialIdx]);

  // ── resume / start over ──
  function handleResume() {
    const saved = loadSavedState();
    if (!saved || !participantRecord) { setShowResume(false); return; }
    // patch saved values into already-initialized participantRecord
    // — do NOT call initParticipantRecord again (would generate new IDs + wrong stimuli)
    if (saved.participantID) participantRecord.participantID = saved.participantID;
    if (saved.prolificID) participantRecord.prolificID = saved.prolificID;
    if (saved.completionCode) participantRecord.completionCode = saved.completionCode;
    participantRecord.orderCondition = saved.orderCondition || participantRecord.orderCondition;
    participantRecord.stimuliShown = saved.stimuliShown || participantRecord.stimuliShown;
    participantRecord._stimuli = reconstructStimuliFromShown(saved.stimuliShown);
    participantRecord.trials = saved.trials || [];
    participantRecord.events = saved.events || [];
    participantRecord.reflection = saved.reflection || null;
    participantRecord.demographics = saved.demographics || null;
    if (saved.comprehension) participantRecord.comprehension = saved.comprehension;
    if (saved.timestamps) participantRecord.timestamps = { ...participantRecord.timestamps, ...saved.timestamps };
    logEvent('resume_session');
    setTrialIdx(saved.trialIdx || 1);
    setScreenIdx(saved.screenIdx || 0);
    setShowResume(false);
  }

  function handleStartOver() {
    clearLocalStorage();
    const urlP = getURLParams();
    initParticipantRecord(urlP.prolificID, urlP.sessionID, urlP.studyID, urlP.testSession);
    setTrialIdx(1);
    setScreenIdx(0);
    setShowResume(false);
  }

  // ── navigation helpers ──
  function next() {
    if (screenIdx === 5 && trialIdx < TOTAL_TRIALS) {
      setTrialIdx(t => t + 1);
    } else {
      setScreenIdx(s => Math.min(s + 1, 8));
    }
    if (screenIdx === 4) {
      // just passed comprehension → mark trials start
      if (participantRecord) participantRecord.timestamps.trialsStart = Date.now();
    }
  }

  function back() {
    if (screenIdx === 5 && trialIdx > 1) {
      setTrialIdx(t => t - 1);
    } else if (screenIdx > 0) {
      setScreenIdx(s => s - 1);
    }
  }

  // ── halfway save ──
  async function halfwaySave() {
    if (!participantRecord) return;
    const payload = { ...participantRecord, partial: true, savedAtTrial: 15 };
    delete payload._stimuli; // don't upload internal cache
    try {
      localStorage.setItem(
        `${LS_PREFIX}halfway.${participantRecord.participantID}`,
        JSON.stringify(payload)
      );
      localStorage.setItem(`${LS_PREFIX}halfwaySaved`, 'true');
      await uploadToDataPipe(payload, { partial: true });
      logEvent('halfway_save', { trialsCompleted: 15 });
    } catch (e) {
      logEvent('halfway_save_failed', { error: e.message });
    }
  }

  // ── fullscreen re-enter ──
  function reenterFullscreen() {
    (async () => {
      try {
        await document.documentElement.requestFullscreen();
        logEvent('fullscreen_resumed');
        setShowFullscreenBanner(false);
      } catch (e) {}
    })();
  }

  // ── render ──
  if (screenIdx === null) {
    // loading
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)' }}>
        <span style={{ fontFamily: 'var(--c-mono)', fontSize: 12, color: 'var(--c-faint)', letterSpacing: '1px' }}>loading…</span>
      </div>
    );
  }

  if (screenIdx === -1 && blockReason) {
    return <BlockScreen reason={blockReason} />;
  }

  if (showResume) {
    return <ResumeSplash onResume={handleResume} onStartOver={handleStartOver} />;
  }

  return (
    <>
      {viewportLocked && screenIdx > 0 && <ViewportLockOverlay />}
      {showFullscreenBanner && screenIdx > 0 && screenIdx < 8 && (
        <FullscreenBanner onReenter={reenterFullscreen} />
      )}
      {renderScreen(screenIdx, trialIdx, next, back, halfwaySave)}
    </>
  );
}

function renderScreen(screenIdx, trialIdx, next, back, halfwaySave) {
  switch (screenIdx) {
    case 0: return <PWelcome onNext={next} />;
    case 1: return <PInstructions onNext={next} onBack={back} />;
    case 2: return <PWalkthrough onNext={next} onBack={back} />;
    case 3: return <PPractice onNext={next} onBack={back} />;
    case 4: return <PComprehension onNext={next} onBack={back} />;
    case 5: return <PTrial trialIdx={trialIdx} onNext={next} onHalfwaySave={halfwaySave} />;
    case 6: return <PStrategy onNext={next} />;
    case 7: return <PDemographics onNext={next} />;
    case 8: return <PCompletion />;
    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(
  <Boundary>
    <App />
  </Boundary>
);

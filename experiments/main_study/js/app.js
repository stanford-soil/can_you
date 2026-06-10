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
  // prefer condition from URL (set by index.html gateway via DataPipe)
  const urlCond = new URLSearchParams(window.location.search).get('condition');
  if (urlCond === 'GR' || urlCond === 'RG') return urlCond;
  // fallback: hash-based (for dev/test sessions without gateway)
  return (hashStr(participantID) % 2 === 0) ? 'GR' : 'RG';
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
  const assignmentIdx = p.get('assignment_idx') || '';
  const captchaOk = p.get('captcha_ok') || '';
  const testSession = !prolificID && !sessionID;
  return { prolificID, sessionID, studyID, assignmentIdx, captchaOk, testSession };
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
// CSV helpers
// ─────────────────────────────────────────────────────────────
function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const header = cols.map(csvEscape).join(',');
  const lines = rows.map(row => cols.map(c => csvEscape(row[c])).join(','));
  return [header, ...lines].join('\n');
}

// ─────────────────────────────────────────────────────────────
// Build CSV data from participant record
// ─────────────────────────────────────────────────────────────
function buildTrialsCSV(record) {
  const meta = {
    trial_type: 'trial',
    participantID: record.participantID,
    prolificID: record.prolificID,
    prolificSessionID: record.prolificSessionID,
    prolificStudyID: record.prolificStudyID,
    assignmentIdx: record.assignmentIdx || '',
    orderCondition: record.orderCondition,
    testSession: record.testSession,
    experimentName: record.experimentName,
    version: record.version,
  };
  return record.trials.map(t => ({
    ...meta,
    itemID: t.itemID,
    trialIdx: t.trialIdx,
    scenario: t.scenario,
    utterance: t.utterance,
    interpretation: t.interpretation,
    response: t.response,
    order: t.order,
    shownAtMs: t.shownAtMs,
    submittedAtMs: t.submittedAtMs,
    totalTimeMs: t.totalTimeMs,
    timeToFirstInterpKeystrokeMs: t.timeToFirstInterpKeystrokeMs,
    timeToFirstRespKeystrokeMs: t.timeToFirstRespKeystrokeMs,
    interpKeystrokes: t.interpKeystrokes,
    respKeystrokes: t.respKeystrokes,
    interpRevisions: t.interpRevisions,
    respRevisions: t.respRevisions,
    box2RevealedAtMs: t.box2RevealedAtMs,
    interpChars: t.characters ? t.characters.interp : '',
    respChars: t.characters ? t.characters.resp : '',
  }));
}

function buildDemographicsCSV(record) {
  const row = {
    trial_type: 'demographics',
    participantID: record.participantID,
    prolificID: record.prolificID,
    prolificSessionID: record.prolificSessionID,
    prolificStudyID: record.prolificStudyID,
    assignmentIdx: record.assignmentIdx || '',
    orderCondition: record.orderCondition,
    testSession: record.testSession,
    experimentName: record.experimentName,
    version: record.version,
    completionCode: record.completionCode,
    age: record.demographics ? record.demographics.age : '',
    gender: record.demographics ? record.demographics.gender : '',
    nativeLanguage: record.demographics ? record.demographics.nativeLanguage : '',
    education: record.demographics ? record.demographics.education : '',
    reflectionApproach: record.reflection ? record.reflection.approach : '',
    reflectionDistinguishing: record.reflection ? record.reflection.distinguishing : '',
    comprehensionAttempts: record.comprehension ? record.comprehension.attempts : '',
    comprehensionFirstPick: record.comprehension ? record.comprehension.firstPick : '',
    comprehensionTimeMs: record.comprehension ? record.comprehension.timeToCorrectMs : '',
    studyStartMs: record.timestamps.studyStart,
    consentGivenMs: record.timestamps.consentGiven,
    trialsStartMs: record.timestamps.trialsStart,
    trialsDoneMs: record.timestamps.trialsDone,
    studyCompleteMs: record.timestamps.studyComplete,
    userAgent: record.browser ? record.browser.userAgent : '',
    viewportWidth: record.browser ? record.browser.viewportWidth : '',
    viewportHeight: record.browser ? record.browser.viewportHeight : '',
  };
  return [row];
}

// ─────────────────────────────────────────────────────────────
// DataPipe upload w/ 3-retry exponential backoff
// ─────────────────────────────────────────────────────────────
async function sendCSVToDataPipe(filename, csvString) {
  const body = {
    experimentID: DATAPIPE_EXPERIMENT_ID,
    filename,
    data: csvString,
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
      if (attempt === max - 1) throw err;
      await new Promise(r => setTimeout(r, 800 * Math.pow(2, attempt)));
    }
  }
}

async function uploadToDataPipe(record, { partial = false } = {}) {
  const pid = record.participantID;
  const suffix = partial ? '_partial' : '';

  const trialsCSV = toCSV(buildTrialsCSV(record));
  const demoCSV = toCSV(buildDemographicsCSV(record));

  const errors = [];

  // upload trials CSV
  try {
    await sendCSVToDataPipe(`${pid}${suffix}_trials.csv`, trialsCSV);
  } catch (err) {
    errors.push({ file: 'trials', error: err.message });
  }

  // upload demographics CSV
  try {
    await sendCSVToDataPipe(`${pid}${suffix}_demographics.csv`, demoCSV);
  } catch (err) {
    errors.push({ file: 'demographics', error: err.message });
  }

  if (errors.length > 0) {
    // save locally as fallback
    localStorage.setItem(
      `${LS_PREFIX}failed_upload_${Date.now()}`,
      JSON.stringify({ pid, errors, trialsCSV, demoCSV })
    );
    if (errors.length === 2) throw new Error('Both uploads failed');
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
    assignmentIdx: urlParams.assignmentIdx || null,
    captchaOk: urlParams.captchaOk || null,
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
    comprehension: { attempts: 0, firstPick: null, wrongPicks: [], timeToCorrectMs: null },
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
            <p className="fm-eyebrow">something went wrong</p>
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
        <p className="fm-eyebrow">unable to continue</p>
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
    : '';
  return (
    <div className="fm">
      {/* brand strip removed — lab name now on consent eyebrow */}
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
          informed consent
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
          <strong style={{ color: 'var(--c-ink)' }}> ~10 minutes</strong> and you will receive
          <strong style={{ color: 'var(--c-ink)' }}> $2.50 via Prolific</strong> for your participation.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--c-muted)', margin: '0 0 14px' }}>
          <strong style={{ color: 'var(--c-ink)' }}>Voluntary participation.</strong> Your participation
          is completely voluntary. You may withdraw at any time without penalty or loss of compensation
          for the portion of the study completed.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--c-muted)', margin: '0 0 14px' }}>
          <strong style={{ color: 'var(--c-ink)' }}>Eligibility.</strong> You must be at least 18 years
          old to participate and a fluent English speaker.
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
  const [showConsent, setShowConsent] = useState(false);

  // captcha already verified by gateway index.html
  const canBegin = consented;

  function handleBegin() {
    if (!canBegin) return;
    if (participantRecord) participantRecord.timestamps.consentGiven = Date.now();
    logEvent('consent_given');
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
    <Shell screenIdx={0}>
      {showConsent && <ConsentModal onClose={() => setShowConsent(false)} />}
      <div className="fm-card">
        <p className="fm-eyebrow">Social Interaction Lab · Stanford University</p>
        <h1 className="fm-title">Everyday Questions</h1>
        <p className="fm-body">
          You'll read short, everyday scenarios in which one person asks another a
          question like <em>"Can you pass the salt?"</em>. After each scenario,
          we'll ask what you think the speaker meant and how you'd respond.
        </p>
        <p className="fm-body">
          We're studying how people interpret these questions in everyday situations.
          There are no right or wrong answers; we just want your natural read.
        </p>
        <div className="fm-meta">
          <div className="fm-meta-block">
            <div className="fm-meta-k">Time</div>
            <div className="fm-meta-v">About 10 min</div>
          </div>
          <div className="fm-meta-block">
            <div className="fm-meta-k">Payment</div>
            <div className="fm-meta-v">$2.50 via Prolific</div>
          </div>
          <div className="fm-meta-block">
            <div className="fm-meta-k">Scenarios</div>
            <div className="fm-meta-v">30 short items</div>
          </div>
        </div>
        <div
          className="fm-consent"
          onClick={() => setConsented(!consented)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <div className={"fm-consent-cb" + (consented ? " on" : "")} />
          <div className="fm-consent-text">
            I am 18 years or older, have read the consent form, and agree to participate.
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
    <Shell screenIdx={1}>
      <div className="fm-card fm-card--centered">
        <p className="fm-eyebrow">about this task</p>
        <h1 className="fm-title small">What "Can you…?" can mean</h1>
        <p className="fm-body" style={{ animation: 'fadeUp 600ms cubic-bezier(.2,.8,.2,1) 300ms both' }}>
          Sometimes people ask "can you..." questions because they want you to do something;
          Other times, they may just be interested in whether you <em>can</em> do it.
        </p>
        <p className="fm-body" style={{ animation: 'fadeUp 600ms cubic-bezier(.2,.8,.2,1) 650ms both' }}>
          We're going to show you a bunch of everyday scenarios with these kinds of questions and just ask
          you to imagine which type of question you think they are.
        </p>
        <p className="fm-body" style={{ animation: 'fadeUp 600ms cubic-bezier(.2,.8,.2,1) 1000ms both' }}>
          For each one, you can tell us what you think they meant and what you would say or do.
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

// scripted typing actions: 'type' adds a char, 'del' removes one, 'pause' waits
function buildTypingScript(text) {
  return text.split('').map(ch => ({ action: 'type', ch }));
}

// GR answer scripts (goal first, then response)
const DEMO_SCRIPT_GOAL = [
  ...buildTypingScript("she wants me"),
  { action: 'pause', ms: 800 },
  ...buildTypingScript(" to"),
  { action: 'pause', ms: 1400 },
  { action: 'del' }, { action: 'del' }, { action: 'del' }, { action: 'del' },
  { action: 'del' }, { action: 'del' }, { action: 'del' }, { action: 'del' },
  { action: 'del' }, { action: 'del' }, { action: 'del' }, { action: 'del' },
  { action: 'del' }, { action: 'del' }, { action: 'del' },
  { action: 'pause', ms: 600 },
  ...buildTypingScript("i think she literally just wants me to hand her the salt"),
];

const DEMO_SCRIPT_RESP = [
  { action: 'pause', ms: 500 },
  ...buildTypingScript("sure"),
  { action: 'pause', ms: 700 },
  ...buildTypingScript(", here you go"),
];

function PWalkthrough({ onNext, onBack }) {
  const condition = participantRecord ? participantRecord.orderCondition : 'GR';
  const isGR = condition === 'GR';
  const script1 = isGR ? DEMO_SCRIPT_GOAL : DEMO_SCRIPT_RESP;
  const script2 = isGR ? DEMO_SCRIPT_RESP : DEMO_SCRIPT_GOAL;
  const box1Label = isGR ? 'what they meant by asking' : 'how you\'d respond';
  const box2Label = isGR ? 'how you\'d respond' : 'what they meant by asking';

  // phase: 0=waiting, 1=typing box1, 2=typing box2, 3=done
  const [phase, setPhase] = useState(0);
  const [ans1, setAns1] = useState('');
  const [ans2, setAns2] = useState('');
  const stepRef = useRef(0);

  // initial 6s delay before typing starts
  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 6000);
    return () => clearTimeout(t);
  }, []);

  // script runner for box 1
  useEffect(() => {
    if (phase !== 1) return;
    let cancelled = false;
    function tick() {
      if (cancelled) return;
      const idx = stepRef.current;
      if (idx >= script1.length) {
        // done w/ box 1 — pause then reveal box 2
        setTimeout(() => { if (!cancelled) { stepRef.current = 0; setPhase(2); } }, 1200);
        return;
      }
      const step = script1[idx];
      stepRef.current = idx + 1;
      if (step.action === 'pause') {
        setTimeout(tick, step.ms);
      } else if (step.action === 'type') {
        setAns1(prev => prev + step.ch);
        setTimeout(tick, 180 + Math.random() * 180);
      } else if (step.action === 'del') {
        setAns1(prev => prev.slice(0, -1));
        setTimeout(tick, 100 + Math.random() * 80);
      }
    }
    tick();
    return () => { cancelled = true; };
  }, [phase]);

  // script runner for box 2
  useEffect(() => {
    if (phase !== 2) return;
    let cancelled = false;
    function tick() {
      if (cancelled) return;
      const idx = stepRef.current;
      if (idx >= script2.length) {
        setTimeout(() => { if (!cancelled) setPhase(3); }, 600);
        return;
      }
      const step = script2[idx];
      stepRef.current = idx + 1;
      if (step.action === 'pause') {
        setTimeout(tick, step.ms);
      } else if (step.action === 'type') {
        setAns2(prev => prev + step.ch);
        setTimeout(tick, 180 + Math.random() * 180);
      } else if (step.action === 'del') {
        setAns2(prev => prev.slice(0, -1));
        setTimeout(tick, 100 + Math.random() * 80);
      }
    }
    tick();
    return () => { cancelled = true; };
  }, [phase]);

  function handleBack() {
    logEvent('back_button', { from: 'walkthrough', to: 'instructions' });
    onBack();
  }

  return (
    <Shell screenIdx={2}>
      <div className="fm-card fm-card--centered">
        <p className="fm-eyebrow">quick walkthrough</p>
        <h1 className="fm-title small">Here's what a trial looks like</h1>
        <div className="fm-demo">
          <p className="fm-demo-scenario">
            You're sitting at the dinner table with your family.
            Your mom looks over at you and asks:
          </p>
          <p className="fm-demo-utt">"Can you pass the salt?"</p>
          <p className="fm-demo-q"><span className="num">01</span> {box1Label}</p>
          <div className={"fm-demo-ans" + (phase === 1 ? " typing" : "") + (phase < 1 ? " empty" : "")}>
            {ans1 || '…'}
          </div>
          {phase >= 2 && (
            <>
              <p className="fm-demo-q"><span className="num">02</span> {box2Label}</p>
              <div className={"fm-demo-ans" + (phase === 2 ? " typing" : "") + (!ans2 ? " empty" : "")}>
                {ans2 || '…'}
              </div>
            </>
          )}
        </div>
        <div className="fm-foot">
          <button className="fm-btn ghost" onClick={handleBack}>← Back</button>
          <button className="fm-btn" disabled={phase < 3} onClick={() => {
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
const MIN_WORDS = 4;
function countWords(s) { return s.trim().split(/\s+/).filter(Boolean).length; }

function TrialForm({
  scenario, utterance, onSubmit,
  submitLabel = 'Continue →', footHint, isPractice = false,
  condition = 'GR', // GR: goal(interp)=box01, respond=box02; RG: respond=box01, goal(interp)=box02
  onIdleReset,      // call this on any keystroke so parent can reset idle timer
}) {
  const [box1Val, setBox1Val] = useState('');
  const [box2Val, setBox2Val] = useState('');
  const [box2Visible, setBox2Visible] = useState(false);
  const [box1Hint, setBox1Hint] = useState(false);
  const [box2Hint, setBox2Hint] = useState(false);

  // timing refs
  const shownAtMs = useRef(Date.now());
  const box1FirstKeystroke = useRef(null);
  const box2FirstKeystroke = useRef(null);
  const box1Keystrokes = useRef(0);
  const box2Keystrokes = useRef(0);
  const box2RevealedAt = useRef(null);

  const isGR = condition === 'GR';
  const box1Prompt = isGR ? 'what they meant by asking' : 'how you\'d respond';
  const box2Prompt = isGR ? 'how you\'d respond' : 'what they meant by asking';
  const box1Placeholder = isGR ? 'A sentence or two…' : 'What you\'d say or do…';
  const box2Placeholder = isGR ? 'What you\'d say or do…' : 'A sentence or two…';

  const box1Words = countWords(box1Val);
  const box2Words = countWords(box2Val);
  const box1Met = box1Words >= MIN_WORDS;
  const box2Met = box2Words >= MIN_WORDS;
  const ready = box1Met && box2Met;

  // slide in box 02 after 700ms pause once box 01 meets min words
  useEffect(() => {
    if (box2Visible) return;
    if (!box1Met) return;
    const t = setTimeout(() => {
      setBox2Visible(true);
      box2RevealedAt.current = Date.now();
    }, 700);
    return () => clearTimeout(t);
  }, [box1Val, box2Visible, box1Met]);

  // box 1 word-count hint: show after 2s idle if they typed but under threshold
  useEffect(() => {
    if (box1Met || box1Words === 0) { setBox1Hint(false); return; }
    const t = setTimeout(() => setBox1Hint(true), 2000);
    return () => clearTimeout(t);
  }, [box1Val, box1Met, box1Words]);

  // box 2 word-count hint: show after 2s idle if they typed but under threshold
  useEffect(() => {
    if (box2Met || box2Words === 0) { setBox2Hint(false); return; }
    const t = setTimeout(() => setBox2Hint(true), 2000);
    return () => clearTimeout(t);
  }, [box2Val, box2Met, box2Words]);

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
    const interpVal = isGR ? box1Val : box2Val;
    const respVal = isGR ? box2Val : box1Val;
    const interpFirstKeystroke = isGR ? box1FirstKeystroke.current : box2FirstKeystroke.current;
    const respFirstKeystroke = isGR ? box2FirstKeystroke.current : box1FirstKeystroke.current;
    const interpKs = isGR ? box1Keystrokes.current : box2Keystrokes.current;
    const respKs = isGR ? box2Keystrokes.current : box1Keystrokes.current;

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
      {isPractice && <span className="fm-practice-tag">practice · not recorded</span>}
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
        {box1Hint && (
          <p className="fm-word-hint">
            {box1Words} / {MIN_WORDS} words — write a little more to continue
          </p>
        )}
      </div>

      <div className={"fm-q fm-q-reveal" + (box2Visible ? " in" : "")}>
        <p className="fm-q-prompt"><span className="fm-q-num">02</span> {box2Prompt}</p>
        <textarea
          className={"fm-ta" + (box2Val ? " filled" : "")}
          placeholder={box2Placeholder}
          value={box2Val}
          onChange={handleBox2Change}
        />
        {box2Hint && (
          <p className="fm-word-hint">
            {box2Words} / {MIN_WORDS} words — write a little more to continue
          </p>
        )}
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
  const condition = participantRecord ? participantRecord.orderCondition : 'GR';
  function handleBack() {
    logEvent('back_button', { from: 'practice', to: 'walkthrough' });
    onBack();
  }
  return (
    <Shell screenIdx={3}>
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
  const condition = participantRecord ? participantRecord.orderCondition : 'GR';
  const isGR = condition === 'GR';
  // correct answer depends on condition: GR → first box is goal/interpretation (idx 0), RG → first box is response (idx 1)
  const correctIdx = isGR ? 0 : 1;
  const correct = pick === correctIdx;

  const options = isGR
    ? [
        { i: 0, text: 'what they meant by asking the question' },
        { i: 1, text: 'what I would say or do in response' },
      ]
    : [
        { i: 0, text: 'what they meant by asking the question' },
        { i: 1, text: 'what I would say or do in response' },
      ];

  function handlePick(i) {
    setPick(i);
    if (participantRecord) {
      participantRecord.comprehension.attempts++;
      if (participantRecord.comprehension.firstPick === null) {
        participantRecord.comprehension.firstPick = i;
        logEvent('comprehension_first_pick', { pickedIdx: i, correct: i === correctIdx, condition });
      }
      if (i !== correctIdx) {
        participantRecord.comprehension.wrongPicks.push(i);
        logEvent('comprehension_wrong', { pickedIdx: i, condition });
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
    <Shell screenIdx={4}>
      <div className="fm-card">
        <p className="fm-eyebrow">quick check</p>
        <h1 className="fm-title small">Just to make sure</h1>
        <p className="fm-body">
          In the scenarios you'll see, which response goes in the <strong>first</strong> box?
        </p>
        <div className="fm-radio-group">
          {options.map((opt) => {
            const sel = pick === opt.i;
            const state = sel ? (opt.i === correctIdx ? 'correct' : 'wrong') : '';
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
        {pick !== null && !correct && (
          <p className="fm-body fine" style={{ color: 'var(--c-warn)', fontStyle: 'italic' }}>
            Not quite — try the other option.
          </p>
        )}
        {correct && (
          <p className="fm-body fine" style={{ color: 'var(--c-success)', fontStyle: 'italic' }}>
            Correct!
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
  const condition = participantRecord ? participantRecord.orderCondition : 'GR';
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
    <Shell screenIdx={6}>
      <div className="fm-card">
        <p className="fm-eyebrow">almost done</p>
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
          <p className="fm-q-prompt"><span className="fm-q-num">02</span> how did you tell apart questions about whether someone can do something vs. wanting them to do it?</p>
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
      <Shell screenIdx={7} >
        <div className="fm-card">
          <p className="fm-eyebrow">almost there</p>
          <h1 className="fm-title small">Your data is saved locally</h1>
          <p className="fm-body">
            Your responses were collected but couldn't be sent to our server right now.
            Please email <a href={`mailto:${RESEARCHER_EMAIL}`}>{RESEARCHER_EMAIL}</a> with
            the ID below. Your data is preserved and we'll process it manually.
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
    <Shell screenIdx={7} >
      <div className="fm-card">
        <p className="fm-eyebrow">one more thing</p>
        <h1 className="fm-title small">A bit about you</h1>
        <p className="fm-body fine" style={{ marginBottom: 22 }}>
          Helpful for analyzing the data. All responses remain anonymous.
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
    <Shell screenIdx={8}>
      <div className="fm-card">
        <div className="fm-success-badge" />
        <p className="fm-eyebrow">study complete</p>
        <h1 className="fm-title">Thank you</h1>
        <p className="fm-body">
          Your responses have been recorded. The data you provided will help
          us understand how people interpret everyday requests.
        </p>
        <p className="fm-section-label">your completion code</p>
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
        <p className="fm-eyebrow">welcome back</p>
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
        <p className="fm-eyebrow">please resize your window</p>
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
// Fullscreen overlay (blocks interaction until they re-enter)
// ─────────────────────────────────────────────────────────────
function FullscreenOverlay({ onReenter }) {
  return (
    <div className="fm-block-overlay">
      <div className="fm-card" style={{ maxWidth: 480, textAlign: 'center' }}>
        <p className="fm-eyebrow">fullscreen required</p>
        <h1 className="fm-title small">Please return to fullscreen</h1>
        <p className="fm-body">
          The study needs to run in fullscreen mode. Click below to continue.
        </p>
        <button className="fm-btn" onClick={onReenter} style={{ marginTop: 8 }}>
          Return to fullscreen
        </button>
      </div>
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
        <FullscreenOverlay onReenter={reenterFullscreen} />
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

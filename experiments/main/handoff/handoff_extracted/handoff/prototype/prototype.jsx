// prototype.jsx — clickable full-study walkthrough
// Step through each screen with working state, validation, and navigation.

const { useState, useMemo, useRef, useEffect } = React;

// Six top-level sections — instructions + walkthrough collapsed into "how it works";
// practice trial + comprehension into "practice"; reflection + demographics into "wrap-up".
const SECTIONS = [
  { id: 'welcome',  name: 'welcome',     weight: 1 },
  { id: 'intro',    name: 'how it works', weight: 2 },
  { id: 'practice', name: 'practice',    weight: 1 },
  { id: 'trials',   name: 'scenarios',   weight: 12 },
  { id: 'wrap',     name: 'wrap-up',     weight: 2 },
  { id: 'done',     name: 'complete',    weight: 0.5 },
];

// Internal screen index → top-level section index (so the progress bar
// stays coarse but the actual flow keeps its sub-steps).
const SCREEN_TO_SECTION = [
  0, // 0 welcome
  1, // 1 instructions  → "how it works"
  1, // 2 walkthrough   → "how it works"
  2, // 3 practice trial → "practice"
  2, // 4 comprehension → "practice"
  3, // 5 main trials   → "scenarios"
  4, // 6 reflection    → "wrap-up"
  4, // 7 demographics  → "wrap-up"
  5, // 8 completion    → "complete"
];

// For each screen, what fraction of its section it covers (for finer-grained progress).
const SCREEN_SECTION_SHARE = [
  [0, 1],     // welcome — full
  [0,   0.5], // instructions — first half of "how it works"
  [0.5, 1],   // walkthrough — second half
  [0,   0.5], // practice trial — first half of "practice"
  [0.5, 1],   // comprehension — second half
  [0,   1],   // main trials — full
  [0,   0.5], // reflection — first half of "wrap-up"
  [0.5, 1],   // demographics — second half
  [0,   1],   // completion — full
];

// 5 sample scenarios — varied so participants experience both ability and request readings.
const SAMPLE_TRIALS = [
  {
    id: '035',
    scenario: "A close friend desperately needs a haircut and can't get an appointment in time. Not knowing who else to ask, they call you and say:",
    utterance: "Can you give me a quick trim?",
  },
  {
    id: '042',
    scenario: "You're about to head out on a small boat with a friend you've never been on the water with. They turn to you and ask:",
    utterance: "Can you swim?",
  },
  {
    id: '011',
    scenario: "You're at your usual coffee shop. The barista, who you've gotten to know over the months, leans across the counter and says quietly:",
    utterance: "Can you spare a moment?",
  },
  {
    id: '028',
    scenario: "A neighbor is hosting an open mic at their place. They know you grew up playing piano. As they're setting up, they ask:",
    utterance: "Can you read music?",
  },
  {
    id: '019',
    scenario: "You're at the airport waiting for your flight. Your phone is at 3%. A stranger across from you looks up from their kindle and says:",
    utterance: "Can you watch my bag for a second?",
  },
];

const TOTAL_TRIALS = SAMPLE_TRIALS.length;

// ─────────────────────────────────────────────────────────────
// Top progress bar shell
// ─────────────────────────────────────────────────────────────
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

function Shell({ screenIdx, trialIdx, trialTotal, posLabel, children, onRestart }) {
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

      <div
        style={{
          position: 'fixed', right: 18, bottom: 18, zIndex: 50,
          background: 'rgba(22,27,46,.85)', color: '#F4F3EE',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: 1.4,
          textTransform: 'uppercase', fontWeight: 600,
          padding: '7px 12px', borderRadius: 4, display: 'flex',
          alignItems: 'center', gap: 10, cursor: 'pointer',
        }}
        onClick={onRestart}
        title="restart the demo"
      >
        <span>demo · restart ↺</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 01 · Welcome / Consent
// ─────────────────────────────────────────────────────────────
function PWelcome({ onNext, onRestart }) {
  const [consented, setConsented] = useState(false);
  return (
    <Shell screenIdx={0} posLabel="consent" onRestart={onRestart}>
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
            <div className="fm-meta-v">About 22 min</div>
          </div>
          <div className="fm-meta-block">
            <div className="fm-meta-k">Payment</div>
            <div className="fm-meta-v">$3.00 via Prolific</div>
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
            I am 18 or older, have read the consent form, and agree to participate.
            I understand my responses will be stored anonymously and used for research purposes.
          </div>
        </div>
        <div className="fm-foot">
          <button className="fm-btn ghost">View full consent form</button>
          <button className="fm-btn" disabled={!consented} onClick={onNext}>Begin study →</button>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 02 · Instructions
// ─────────────────────────────────────────────────────────────
function PInstructions({ onNext, onBack, onRestart }) {
  return (
    <Shell screenIdx={1} posLabel="how this works" onRestart={onRestart}>
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
          <button className="fm-btn ghost" onClick={onBack}>← Back</button>
          <button className="fm-btn" onClick={onNext}>Continue →</button>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 03 · Walkthrough — animated demo
// ─────────────────────────────────────────────────────────────
const DEMO_ANS_1 = "they want me to actually cut their hair";
const DEMO_ANS_2 = "yeah of course, come by tonight";

function PWalkthrough({ onNext, onBack, onRestart }) {
  // Type the demo answers in sequence, then enable continue.
  const [phase, setPhase] = useState(0); // 0 = typing ans1, 1 = typing ans2, 2 = done
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

  return (
    <Shell screenIdx={2} posLabel="quick demo" onRestart={onRestart}>
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
          <button className="fm-btn ghost" onClick={onBack}>← Back</button>
          <button className="fm-btn" disabled={phase < 2} onClick={onNext}>
            Try a practice trial →
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// Reusable trial form (used by Practice and main Trial)
// ─────────────────────────────────────────────────────────────
function TrialForm({ scenario, utterance, onSubmit, submitLabel = 'Continue →', footHint, isPractice = false }) {
  const [interp, setInterp] = useState('');
  const [resp, setResp] = useState('');
  const [box2Visible, setBox2Visible] = useState(false);
  const ready = interp.trim().length > 0 && resp.trim().length > 0;

  // Reveal box 2 once the participant has typed something in box 1 AND
  // paused for ~700ms (interpreted as "done with first answer").
  useEffect(() => {
    if (box2Visible) return;
    if (interp.trim().length < 3) return;
    const t = setTimeout(() => setBox2Visible(true), 700);
    return () => clearTimeout(t);
  }, [interp, box2Visible]);

  return (
    <div className="fm-card">
      {isPractice && <span className="fm-practice-tag">practice — not recorded</span>}
      <p className="fm-scenario">{scenario}</p>
      <p className="fm-utt">{utterance}</p>

      <div className="fm-q">
        <p className="fm-q-prompt"><span className="fm-q-num">01</span> what they meant by asking</p>
        <textarea
          className={"fm-ta" + (interp ? " filled" : "")}
          placeholder="A sentence or two…"
          value={interp}
          onChange={(e) => setInterp(e.target.value)}
          autoFocus
        />
      </div>

      <div className={"fm-q fm-q-reveal" + (box2Visible ? " in" : "")}>
        <p className="fm-q-prompt"><span className="fm-q-num">02</span> how you'd respond</p>
        <textarea
          className={"fm-ta" + (resp ? " filled" : "")}
          placeholder="What you'd say, or do…"
          value={resp}
          onChange={(e) => setResp(e.target.value)}
        />
      </div>

      <div className="fm-foot">
        <span className="fm-foot-hint">{footHint || (ready ? 'auto-saved' : 'both responses required')}</span>
        <button
          className="fm-btn"
          disabled={!ready}
          onClick={() => onSubmit({ interp, resp })}
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
function PPractice({ onNext, onBack, onRestart }) {
  return (
    <Shell screenIdx={3} posLabel="practice" onRestart={onRestart}>
      <TrialForm
        isPractice
        scenario="You're at a friend's apartment helping them pack. The boxes are stacked near the door. They turn to you and say:"
        utterance="Can you grab the tape?"
        onSubmit={onNext}
      />
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 05 · Comprehension check
// ─────────────────────────────────────────────────────────────
function PComprehension({ onNext, onBack, onRestart }) {
  // option 0 is correct (interpretation), option 1 is wrong (response)
  const [pick, setPick] = useState(null);
  const correct = pick === 0;
  return (
    <Shell screenIdx={4} posLabel="quick check" onRestart={onRestart}>
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
                onClick={() => setPick(opt.i)}
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
          <button className="fm-btn ghost" onClick={onBack}>← Back</button>
          <button className="fm-btn" disabled={!correct} onClick={onNext}>
            Begin the 30 scenarios →
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 06 · Main trial — cycles through SAMPLE_TRIALS
// ─────────────────────────────────────────────────────────────
function PTrial({ trialIdx, onNext, onBack, onRestart }) {
  const t = SAMPLE_TRIALS[trialIdx - 1];
  return (
    <Shell screenIdx={5} trialIdx={trialIdx} trialTotal={TOTAL_TRIALS} onRestart={onRestart}>
      <TrialForm
        key={trialIdx} // remount + reset on trial change
        scenario={t.scenario}
        utterance={t.utterance}
        onSubmit={onNext}
        submitLabel={trialIdx === TOTAL_TRIALS ? 'Finish trials →' : 'Continue →'}
      />
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 07 · Reflection
// ─────────────────────────────────────────────────────────────
function PStrategy({ onNext, onBack, onRestart }) {
  const [a1, setA1] = useState('');
  const [a2, setA2] = useState('');
  const ready = a1.trim().length > 0 && a2.trim().length > 0;
  return (
    <Shell screenIdx={6} posLabel="reflection" onRestart={onRestart}>
      <div className="fm-card">
        <p className="fm-eyebrow">— almost done —</p>
        <h1 className="fm-title small">Two quick reflections</h1>
        <div className="fm-q">
          <p className="fm-q-prompt"><span className="fm-q-num">01</span> how did you decide what people meant by their questions?</p>
          <textarea
            className={"fm-ta" + (a1 ? " filled" : "")}
            value={a1} onChange={(e) => setA1(e.target.value)}
            placeholder="Tell us about your approach…"
          />
        </div>
        <div className="fm-q">
          <p className="fm-q-prompt"><span className="fm-q-num">02</span> how did you tell apart questions about ability vs. requests for action?</p>
          <textarea
            className={"fm-ta" + (a2 ? " filled" : "")}
            value={a2} onChange={(e) => setA2(e.target.value)}
            placeholder="What helped you distinguish them…"
          />
        </div>
        <div className="fm-foot">
          <span className="fm-foot-hint">{ready ? 'auto-saved' : 'both required'}</span>
          <button className="fm-btn" disabled={!ready} onClick={onNext}>Continue →</button>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 08 · Demographics
// ─────────────────────────────────────────────────────────────
function PDemographics({ onNext, onBack, onRestart }) {
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [lang, setLang] = useState('');
  const [edu, setEdu] = useState('');
  const ready = age && lang && edu; // gender optional
  return (
    <Shell screenIdx={7} posLabel="about you" onRestart={onRestart}>
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
            value={age} onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 27"
          />
        </div>
        <div className="fm-field">
          <label className="fm-field-lbl">Gender (self-describe, optional)</label>
          <input
            className={"fm-input" + (gender ? " filled" : "")}
            value={gender} onChange={(e) => setGender(e.target.value)}
            placeholder="how you'd describe your gender"
          />
        </div>
        <div className="fm-field">
          <label className="fm-field-lbl">Native language</label>
          <input
            className={"fm-input" + (lang ? " filled" : "")}
            value={lang} onChange={(e) => setLang(e.target.value)}
            placeholder="e.g. English"
          />
        </div>
        <div className="fm-field">
          <label className="fm-field-lbl">Highest level of education</label>
          <input
            className={"fm-input" + (edu ? " filled" : "")}
            value={edu} onChange={(e) => setEdu(e.target.value)}
            placeholder="e.g. bachelor's degree"
          />
        </div>
        <div className="fm-foot">
          <span className="fm-foot-hint">{ready ? 'ready to submit' : 'required fields needed'}</span>
          <button className="fm-btn" disabled={!ready} onClick={onNext}>Submit →</button>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 09 · Completion
// ─────────────────────────────────────────────────────────────
function PCompletion({ onRestart }) {
  return (
    <Shell screenIdx={8} posLabel="complete" onRestart={onRestart}>
      <div className="fm-card">
        <div className="fm-success-badge" />
        <p className="fm-eyebrow">— study complete —</p>
        <h1 className="fm-title">Thank you</h1>
        <p className="fm-body">
          Your responses have been recorded. The data you provided will help
          us understand how people interpret everyday requests.
        </p>
        <p className="fm-section-label">— your completion code —</p>
        <div className="fm-code">CY-A7F3-2K9D</div>
        <p className="fm-body fine">
          Copy this code into Prolific to receive your payment. If you have
          any issues, contact the researcher via your Prolific dashboard.
        </p>
        <div className="fm-foot">
          <button className="fm-btn ghost" onClick={onRestart}>↺ Restart the demo</button>
          <button className="fm-btn">Return to Prolific ↗</button>
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// App — state machine threading screens together
// ─────────────────────────────────────────────────────────────
function App() {
  const [screenIdx, setScreenIdx] = useState(0);
  const [trialIdx, setTrialIdx] = useState(1);

  const restart = () => { setScreenIdx(0); setTrialIdx(1); };

  const next = () => {
    if (screenIdx === 5 && trialIdx < TOTAL_TRIALS) {
      setTrialIdx(trialIdx + 1);
    } else {
      setScreenIdx(Math.min(screenIdx + 1, SCREEN_TO_SECTION.length - 1));
    }
  };
  const back = () => {
    if (screenIdx === 5 && trialIdx > 1) {
      setTrialIdx(trialIdx - 1);
    } else if (screenIdx > 0) {
      setScreenIdx(screenIdx - 1);
    }
  };

  const common = { onNext: next, onBack: back, onRestart: restart };

  switch (screenIdx) {
    case 0: return <PWelcome {...common} />;
    case 1: return <PInstructions {...common} />;
    case 2: return <PWalkthrough {...common} />;
    case 3: return <PPractice {...common} />;
    case 4: return <PComprehension {...common} />;
    case 5: return <PTrial trialIdx={trialIdx} {...common} />;
    case 6: return <PStrategy {...common} />;
    case 7: return <PDemographics {...common} />;
    case 8: return <PCompletion onRestart={restart} />;
    default: return null;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

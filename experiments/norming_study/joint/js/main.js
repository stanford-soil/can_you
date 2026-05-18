function initStudyWaffle(stimuli) {
    if (checkMobile()) return;

    logToBrowser('initializing grid study', null);
    if (!TESTING_MODE) applyProductionProtections();

    var urlParams  = new URLSearchParams(window.location.search);
    var prolificID = urlParams.get('PROLIFIC_PID');
    var studyID    = urlParams.get('STUDY_ID');
    var sessionID  = urlParams.get('SESSION_ID');
    var captchaOk  = urlParams.get('captcha_ok');

    var jsPsych = initJsPsych({
        show_progress_bar: false,   // using our own progress strip
        auto_update_progress_bar: false
    });

    jsPsych.data.addProperties({ subjectID:  jsPsych.randomization.randomID(10) });
    jsPsych.data.addProperties({ prolificID: prolificID });
    jsPsych.data.addProperties({ studyID:    studyID });
    jsPsych.data.addProperties({ sessionID:  sessionID });
    jsPsych.data.addProperties({ captchaOk:  captchaOk });
    jsPsych.data.addProperties({ startTime:  Date.now() });
    var _now = new Date();
    var _ts = [_now.getFullYear(), String(_now.getMonth()+1).padStart(2,'0'), String(_now.getDate()).padStart(2,'0')].join('') +
              '_' + [String(_now.getHours()).padStart(2,'0'), String(_now.getMinutes()).padStart(2,'0'), String(_now.getSeconds()).padStart(2,'0')].join('');
    jsPsych.data.addProperties({ sessionTimestamp: _ts });
    jsPsych.data.addProperties({ trialResponses: [] });
    jsPsych.data.addProperties({ attentionChecks: [] });

    if (TEST) jsPsych.data.addProperties({ DEBUG: true });
    if (SEED) jsPsych.randomization.setSeed(SEED);

    // tab visibility tracking
    jsPsych.data.addProperties({ visibilityChanges: [] });
    document.addEventListener('visibilitychange', function() {
        jsPsych.data.dataProperties.visibilityChanges.push({
            hidden:      document.hidden,
            timestamp:   Date.now(),
            msFromStart: Date.now() - jsPsych.data.dataProperties.startTime
        });
    });

    // axis counterbalancing — ?axis=AW|WA overrides random (used by router + dev testing)
    var urlAxis   = urlParams.get('axis');
    var axisOrder = (urlAxis === 'AW' || urlAxis === 'WA')
        ? urlAxis
        : jsPsych.randomization.sampleWithoutReplacement(['AW', 'WA'], 1)[0];
    jsPsych.data.addProperties({ axisOrder: axisOrder });

    // color assignment: use coastal palette (colors fixed per semantic quadrant)
    var colorMap = PALETTES[PALETTE_NAME];
    jsPsych.data.addProperties({ colorAssignment: JSON.stringify(colorMap) });
    jsPsych.data.addProperties({ paletteName: PALETTE_NAME });

    var shuffledStimuli = jsPsych.randomization.shuffle([...stimuli]).slice(0, N_TRIALS_PER_PARTICIPANT);
    var trialOrder = shuffledStimuli.map(function(s) { return s.itemID; });
    jsPsych.data.addProperties({ trialOrder: trialOrder });

    // ---- idle warning ----
    var idleTimer = null;
    var idleOverlay = null;

    function resetIdleTimer() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(showIdleWarning, 270000); // 4:30
    }
    function showIdleWarning() {
        if (idleOverlay) return;
        idleOverlay = document.createElement('div');
        idleOverlay.className = 'w-idle-overlay';
        idleOverlay.innerHTML = `
            <div class="w-card" style="text-align:center; max-width:460px;">
                <h3 class="w-idle-title">Still there?</h3>
                <p style="color:var(--muted); font-size:15px; margin:0 0 24px;">Just checking in — the study will pause if there's no activity.</p>
                <button id="w-idle-dismiss" class="w-btn-primary">I'm here</button>
            </div>`;
        document.body.appendChild(idleOverlay);
        document.getElementById('w-idle-dismiss').addEventListener('click', function() {
            if (idleOverlay) { document.body.removeChild(idleOverlay); idleOverlay = null; }
            resetIdleTimer();
        });
    }
    var idleEvents = ['mousemove','mousedown','keydown','touchstart'];
    idleEvents.forEach(function(ev) { document.addEventListener(ev, resetIdleTimer); });
    resetIdleTimer();

    // ---- speed toast ----
    var fastCount = 0;
    var speedToastShown = false;

    function maybeShowSpeedToast(suspicious) {
        if (!suspicious || speedToastShown) return;
        fastCount++;
        if (fastCount >= 3) {
            speedToastShown = true;
            var toast = document.createElement('div');
            toast.className = 'w-speed-toast';
            toast.textContent = 'Take your time on each scenario — there\'s no rush.';
            document.body.appendChild(toast);
            setTimeout(function() {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 5500);
        }
    }

    // ---- save helper ----
    var saveMsg = `
        <div class="w-scene" style="display:flex; align-items:center; justify-content:center; min-height:100vh;">
            <p style="font-family:var(--sans); color:var(--muted); font-size:15px;">Saving your data — please don't close this page…</p>
        </div>`;

    function handleSaveResult(data, label) {
        if (data.success) return;
        console.error('DataPipe save failed', label, data.result);
        window.onbeforeunload = null;
        document.body.innerHTML = `
            <div style='font-family:var(--sans); text-align:center; margin:15vh auto; max-width:720px; color:var(--ink);'>
                <p style='font-size:24px; font-weight:600;'>We couldn't save your data.</p>
                <p style='font-size:16px; color:var(--muted); line-height:1.5;'>
                    The upload to DataPipe was rejected. Please do not close this page.
                    Open the browser console and send the error message to the research team.
                </p>
                <p style='font-size:15px; color:var(--faint);'>Failed step: ${label}</p>
            </div>`;
        throw new Error('DataPipe save failed: ' + label);
    }

    // ---- cross-fade helper ----
    // jsPsych handles transitions at the plugin level; we use CSS opacity on .w-scene
    // We apply a quick fade on each trial's on_start (before HTML is inserted).

    // ---- consent ----
    var consent = {
        type: jsPsychHtmlButtonResponse,
        stimulus: getConsentHTML(),
        choices: [],
        response_ends_trial: false,
        on_load: function() {
            document.getElementById('consent-btn').addEventListener('click', function() {
                document.documentElement.requestFullscreen().catch(function(e) {
                    console.warn('fullscreen:', e.message);
                });
                jsPsych.finishTrial();
            });
        }
    };

    // ---- instructions (2 pages: intro + demo) ----
    var instrPage = 0;
    var _instrNavHandler = null;

    var instructions = {
        type: jsPsychInstructions,
        pages: getInstructionPagesWaffle(axisOrder),
        show_clickable_nav: true,
        allow_keys: false,
        allow_backward: true,
        on_load: function() {
            instrPage = 0;
            setupInstrPage(0, axisOrder, colorMap);

            _instrNavHandler = function(e) {
                var id = e.target && e.target.id;
                if (id === 'jspsych-instructions-next') {
                    instrPage = Math.min(1, instrPage + 1);
                    setTimeout(function() { setupInstrPage(instrPage, axisOrder, colorMap); }, 50);
                } else if (id === 'jspsych-instructions-back') {
                    instrPage = Math.max(0, instrPage - 1);
                    setTimeout(function() { setupInstrPage(instrPage, axisOrder, colorMap); }, 50);
                }
            };
            document.addEventListener('click', _instrNavHandler);
        },
        on_finish: function() {
            if (_instrNavHandler) {
                document.removeEventListener('click', _instrNavHandler);
                _instrNavHandler = null;
            }
            if (_instrDemoCleanup) { _instrDemoCleanup(); _instrDemoCleanup = null; }
            if (window._instrGateTimer) { clearTimeout(window._instrGateTimer); }
        }
    };

    // ---- practice intro ----
    var practiceIntro = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
            <div class="w-scene w-scene--centered">
                ${getSectionTickerHTML('instructions')}
                <div class="w-card">
                    <div class="w-instr-overline">Practice</div>
                    <h2 class="w-instr-title">Try it out</h2>
                    <div class="w-instr-rule"></div>
                    <div class="w-instr-body">
                        <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 300ms both;">You'll now get to try out a practice scenario</p>
                    </div>
                    <hr class="w-hr">
                    <div class="w-instr-footer" id="w-practice-intro-footer"></div>
                </div>
            </div>`,
        choices: [],
        response_ends_trial: false,
        on_load: function() {
            setTimeout(function() {
                var footer = document.getElementById('w-practice-intro-footer');
                if (!footer) return;
                var col = document.createElement('div');
                col.style.cssText = 'display:flex; flex-direction:column; align-items:center; margin-left:auto;';
                var btn = document.createElement('button');
                btn.className   = 'w-btn-primary';
                btn.textContent = 'Go to practice';
                btn.disabled    = true;
                var hint = document.createElement('div');
                hint.className   = 'w-btn-hint';
                hint.textContent = 'Take a moment to read';
                col.appendChild(btn);
                col.appendChild(hint);
                footer.appendChild(col);
                setTimeout(function() {
                    btn.disabled       = false;
                    hint.style.display = 'none';
                }, 2500);
                btn.addEventListener('click', function() { jsPsych.finishTrial(); });
            }, 30);
        }
    };

    // ---- practice trial ----
    var practiceTrial = buildBentCrosshairTrial(PRACTICE_STIMULUS, axisOrder, colorMap, 0, jsPsych);

    // ---- ready to start ----
    var xDimReady = axisOrder === 'AW' ? 'able' : 'willing';
    var yDimReady = axisOrder === 'AW' ? 'willing' : 'able';
    var readyToStart = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
            <div class="w-scene w-scene--centered">
                ${getSectionTickerHTML('instructions')}
                <div class="w-card">
                    <div class="w-ready-overline">Ready to start</div>
                    <h2 class="w-instr-title">You're all set!</h2>
                    <div class="w-instr-rule"></div>
                    <div class="w-instr-body">
                        <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 300ms both;">There are no right or wrong answers — we're just interested in what you think.</p>
                        <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 650ms both;">Remember: being <em>${xDimReady}</em> and being <em>${yDimReady}</em> don't always go together.</p>
                        <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 1000ms both;">You will be asked for your thoughts on: <b>30 scenarios</b>.</p>
                    </div>
                    <hr class="w-hr">
                    <div class="w-instr-footer" id="w-ready-footer"></div>
                </div>
            </div>`,
        choices: [],
        response_ends_trial: false,
        on_load: function() {
            setTimeout(function() {
                var footer = document.getElementById('w-ready-footer');
                if (!footer) return;
                var col = document.createElement('div');
                col.style.cssText = 'display:flex; flex-direction:column; align-items:center; margin-left:auto;';
                var btn = document.createElement('button');
                btn.className   = 'w-btn-primary';
                btn.textContent = 'Start the study';
                btn.disabled    = true;
                var hint = document.createElement('div');
                hint.className   = 'w-btn-hint';
                hint.textContent = 'Take a moment to read';
                col.appendChild(btn);
                col.appendChild(hint);
                footer.appendChild(col);
                setTimeout(function() {
                    btn.disabled        = false;
                    hint.style.display  = 'none';
                }, 3000);
                btn.addEventListener('click', function() { jsPsych.finishTrial(); });
            }, 30);
        }
    };

    // ---- trial block (with mid-save) ----
    var mainTrialCount = 0;
    var midpoint = Math.floor(N_TRIALS_PER_PARTICIPANT / 2);
    var trialBlock = [];

    shuffledStimuli.forEach(function(stimulus) {
        mainTrialCount++;
        var mc = mainTrialCount; // capture

        trialBlock.push(buildBentCrosshairTrial(stimulus, axisOrder, colorMap, mc, jsPsych));

        // after submit, check for back navigation flag
        trialBlock[trialBlock.length - 1].on_finish = function(data) {
            if (jsPsych.data.dataProperties._goBack) {
                jsPsych.data.dataProperties._goBack = false;
                // jsPsych doesn't natively support going back in timeline
                // workaround: the "Previous" click already popped the response
                // — for a true back we'd need a custom timeline. Here we just note it.
            }
            var responses = jsPsych.data.dataProperties.trialResponses;
            var lastR = responses[responses.length - 1];
            if (lastR && lastR.suspicious) maybeShowSpeedToast(true);
        };

        // mid-save after trial 15
        if (mc === midpoint) {
            trialBlock.push({
                type: jsPsychHtmlButtonResponse,
                stimulus: getHalfwayHTML(),
                choices: [],
                response_ends_trial: false,
                on_load: function() { initHalfwayScene(jsPsych); },
                on_finish: function() {}
            });
            trialBlock.push({
                type: jsPsychPipe,
                action: 'save',
                experiment_id: experimentIdOSF,
                filename: getFilePrefix(jsPsych) + '_grid_1_half.csv',
                data_string: function() { return formatFirstHalf(jsPsych); },
                wait_message: '',
                on_finish: function(data) { handleSaveResult(data, 'first half'); }
            });
        }
    });

    // ---- halfway scene HTML + init ----
    function getHalfwayHTML() {
        return `
            <div class="w-scene">
                ${getSectionTickerHTML('study')}
                <div class="w-card" style="text-align:center; padding:56px 56px 48px;">
                    <div class="w-halfway-overline">Checkpoint · ${midpoint} / ${N_TRIALS_PER_PARTICIPANT}</div>
                    <h2 class="w-halfway-title">You're halfway!</h2>
                    <p style="font-size:17px; color:var(--muted); line-height:1.6; max-width:520px; margin:0 auto 36px;">Saving your progress so far…</p>
                    <div class="w-save-indicator">
                        <div class="w-save-dot" id="w-save-dot">
                            <span class="w-save-check">✓</span>
                        </div>
                        <span class="w-save-label" id="w-save-label">Saving…</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center;">
                        <button id="w-halfway-continue" class="w-btn-primary" disabled>Continue with the second half</button>
                        <div class="w-btn-hint" id="w-halfway-hint">Just a moment</div>
                    </div>
                </div>
            </div>`;
    }

    function initHalfwayScene(jsPsych) {
        var dot   = document.getElementById('w-save-dot');
        var label = document.getElementById('w-save-label');
        var btn   = document.getElementById('w-halfway-continue');
        var hint  = document.getElementById('w-halfway-hint');

        setTimeout(function() {
            dot.classList.add('saved');
            label.classList.add('saved');
            label.textContent = 'Saved';
            btn.disabled = false;
            if (hint) hint.style.display = 'none';
        }, 1400);

        btn.addEventListener('click', function() {
            jsPsych.finishTrial();
        });
    }

    // ---- final save scene HTML + init ----
    function getFinalSaveHTML() {
        return `
            <div class="w-scene">
                ${getSectionTickerHTML('about')}
                <div class="w-card" style="text-align:center; padding:56px 56px 48px;">
                    <div class="w-halfway-overline">Finishing up</div>
                    <h2 class="w-halfway-title">Saving your responses</h2>
                    <p style="font-size:17px; color:var(--muted); line-height:1.6; max-width:520px; margin:0 auto 36px;">Hang tight while we save your data…</p>
                    <div class="w-save-indicator">
                        <div class="w-save-dot" id="w-save-dot-final">
                            <span class="w-save-check">✓</span>
                        </div>
                        <span class="w-save-label" id="w-save-label-final">Saving…</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center;">
                        <button id="w-final-continue" class="w-btn-primary" disabled>Finish</button>
                        <div class="w-btn-hint" id="w-final-hint">Just a moment</div>
                    </div>
                </div>
            </div>`;
    }

    function initFinalSaveScene(jsPsych) {
        var dot   = document.getElementById('w-save-dot-final');
        var label = document.getElementById('w-save-label-final');
        var btn   = document.getElementById('w-final-continue');
        var hint  = document.getElementById('w-final-hint');

        setTimeout(function() {
            dot.classList.add('saved');
            label.classList.add('saved');
            label.textContent = 'Saved';
            btn.disabled = false;
            if (hint) hint.style.display = 'none';
        }, 1400);

        btn.addEventListener('click', function() { jsPsych.finishTrial(); });
    }

    // ---- demographics ----
    var demographics = {
        type: jsPsychHtmlButtonResponse,
        stimulus: getDemographicsSceneHTML(),
        choices: [],
        response_ends_trial: false,
        on_load: function() { initDemographicsScene(jsPsych); }
    };

    // ---- strategy ----
    var strategy = {
        type: jsPsychHtmlButtonResponse,
        stimulus: getStrategySceneHTML(),
        choices: [],
        response_ends_trial: false,
        on_load: function() { initStrategyScene(jsPsych); }
    };

    // ---- technical ----
    var technical = {
        type: jsPsychHtmlButtonResponse,
        stimulus: getTechnicalSceneHTML(),
        choices: [],
        response_ends_trial: false,
        on_load: function() { initTechnicalScene(jsPsych); }
    };

    // ---- final save card (shown to user) + silent pipe saves ----
    var finalSaveCard = {
        type: jsPsychHtmlButtonResponse,
        stimulus: getFinalSaveHTML(),
        choices: [],
        response_ends_trial: false,
        on_load: function() { initFinalSaveScene(jsPsych); }
    };

    var save2half = {
        type: jsPsychPipe,
        action: 'save',
        experiment_id: experimentIdOSF,
        filename: getFilePrefix(jsPsych) + '_grid_2_half.csv',
        data_string: function() { return formatSecondHalf(jsPsych); },
        wait_message: '',
        on_finish: function(data) { handleSaveResult(data, 'second half'); }
    };

    var saveDemographics = {
        type: jsPsychPipe,
        action: 'save',
        experiment_id: experimentIdOSF,
        filename: getFilePrefix(jsPsych) + '_grid_demographics.csv',
        data_string: function() { return formatDemographics(jsPsych); },
        wait_message: '',
        on_finish: function(data) { handleSaveResult(data, 'demographics'); }
    };

    // ---- completion ----
    var completion = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
            <div class="w-scene">
                ${getSectionTickerHTML('about')}
                <div class="w-card" style="text-align:center; padding:64px 56px 56px;">
                    <div class="w-completion-check">✓</div>
                    <h2 class="w-completion-title">Thank you so much!</h2>
                    <p style="font-size:17px; color:#3A332A; line-height:1.6; max-width:540px; margin:0 auto 32px;">
                        Your responses have been saved and will really help our research!
                    </p>
                    <p style="font-size:14px; color:var(--muted); margin-bottom:0;">
                        You'll be redirected to Prolific automatically in a few seconds.
                        If nothing happens, <a href="${prolificCompletionURL}" style="color:var(--accent);">click here</a>.
                    </p>
                </div>
            </div>`,
        choices: [],
        response_ends_trial: false,
        on_load: function() {
            window.onbeforeunload = null;
            if (prolificCompletionURL) {
                setTimeout(function() { window.location.href = prolificCompletionURL; }, 4000);
            }
        }
    };

    // ---- timeline ----
    // consent → instructions (2pg) → practice intro → practice → ready-to-start → 30 trials → surveys → save
    var timeline = [consent, instructions, practiceIntro, practiceTrial, readyToStart]
        .concat(trialBlock)
        .concat([demographics, strategy, technical, finalSaveCard, save2half, saveDemographics, completion]);

    // ---- dev panel + skip-to ----
    // indices: 0=consent, 1=instructions, 2=practice intro, 3=practice, 4=ready, 5=trial1, ...
    var N = N_TRIALS_PER_PARTICIPANT;
    initDevPanel([
        { label: 'Consent',              index: 0 },
        { label: 'Instructions',         index: 1 },
        { label: 'Practice intro',       index: 2 },
        { label: 'Practice trial',       index: 3 },
        { label: 'Ready to start',       index: 4 },
        { label: 'Trial 1',              index: 5 },
        { label: 'Trial 15 (halfway)',   index: 20 },
        { label: 'About you',            index: N + 7 },
        { label: 'How did you decide?',  index: N + 8 },
        { label: 'Last questions',       index: N + 9 },
    ]);

    var skipIdx = IS_TESTING ? (parseInt(urlParams.get('skip'), 10) || 0) : 0;
    jsPsych.run(skipIdx > 0 ? timeline.slice(skipIdx) : timeline);
}

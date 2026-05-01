function initStudyLinear(stimuli) {
    if (checkMobile()) return;

    logToBrowser('initializing linear study', null);
    if (!TESTING_MODE) applyProductionProtections();

    var urlParams  = new URLSearchParams(window.location.search);
    var prolificID = urlParams.get('PROLIFIC_PID');
    var studyID    = urlParams.get('STUDY_ID');
    var sessionID  = urlParams.get('SESSION_ID');
    var captchaOk  = urlParams.get('captcha_ok');

    var jsPsych = initJsPsych({
        show_progress_bar: false,
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
    function saveToDataPipe(filename, dataStr) {
        if (IS_TESTING) {
            console.log('[TEST] skipping DataPipe save:', filename, '\n', dataStr.slice(0, 200));
            return Promise.resolve({ success: true });
        }
        return fetch('https://pipe.jspsych.org/api/data/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: '*/*' },
            body: JSON.stringify({ experimentID: experimentIdOSF, filename: filename, data: dataStr })
        }).then(function(r) {
            return r.json().then(function(data) {
                // DataPipe returns either { success: true } or { message: "Success", ... }
                data.success = data.success === true || data.message === 'Success';
                if (!data.success) console.error('DataPipe rejected:', filename, data);
                return data;
            });
        });
    }

    function showSaveError(label, apiMsg) {
        console.error('DataPipe save failed:', label, apiMsg || '');
        window.onbeforeunload = null;
        document.body.innerHTML = `
            <div style='font-family:var(--sans); text-align:center; margin:15vh auto; max-width:720px; color:var(--ink);'>
                <p style='font-size:24px; font-weight:600;'>We couldn't save your data.</p>
                <p style='font-size:16px; color:var(--muted); line-height:1.5;'>
                    The upload to DataPipe was rejected. Please do not close this page.
                    Open the browser console and send the error message to the research team.
                </p>
                <p style='font-size:15px; color:var(--faint);'>Failed step: ${label}${apiMsg ? ' — ' + apiMsg : ''}</p>
            </div>`;
    }

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

    // ---- instructions ----
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
                    instrPage = Math.min(2, instrPage + 1);
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

    // ---- trial block (with mid-save) ----
    var mainTrialCount = 0;
    var midpoint = Math.floor(N_TRIALS_PER_PARTICIPANT / 2);
    var trialBlock = [];

    shuffledStimuli.forEach(function(stimulus) {
        mainTrialCount++;
        var mc = mainTrialCount;

        trialBlock.push(buildLinearTrial(stimulus, axisOrder, colorMap, mc, jsPsych));

        trialBlock[trialBlock.length - 1].on_finish = function(data) {
            if (jsPsych.data.dataProperties._goBack) {
                jsPsych.data.dataProperties._goBack = false;
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

        saveToDataPipe(getFilePrefix(jsPsych) + '_linear_1_half.csv', formatFirstHalf(jsPsych))
            .then(function(data) {
                if (!data.success) { showSaveError('first half', data.message); return; }
                dot.classList.add('saved');
                label.classList.add('saved');
                label.textContent = 'Saved';
                btn.disabled = false;
                if (hint) hint.style.display = 'none';
            })
            .catch(function(e) { showSaveError('first half', e && e.message); });

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

        var prefix = getFilePrefix(jsPsych);
        Promise.all([
            saveToDataPipe(prefix + '_linear_2_half.csv',    formatSecondHalf(jsPsych)),
            saveToDataPipe(prefix + '_linear_demographics.csv', formatDemographics(jsPsych))
        ]).then(function(results) {
            if (!results[0].success) { showSaveError('second half', results[0].message); return; }
            if (!results[1].success) { showSaveError('demographics', results[1].message); return; }
            dot.classList.add('saved');
            label.classList.add('saved');
            label.textContent = 'Saved';
            btn.disabled = false;
            if (hint) hint.style.display = 'none';
        }).catch(function(e) { showSaveError('final save', e && e.message); });

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

    // ---- final save card ----
    var finalSaveCard = {
        type: jsPsychHtmlButtonResponse,
        stimulus: getFinalSaveHTML(),
        choices: [],
        response_ends_trial: false,
        on_load: function() { initFinalSaveScene(jsPsych); }
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
    var timeline = [consent, instructions]
        .concat(trialBlock)
        .concat([demographics, strategy, technical, finalSaveCard, completion]);

    // ---- dev panel + skip-to ----
    var N = N_TRIALS_PER_PARTICIPANT, m = midpoint;
    initDevPanel([
        { label: 'Consent',              index: 0 },
        { label: 'Instructions',         index: 1 },
        { label: 'Trial 1',              index: 2 },
        { label: 'Trial 20',             index: 23 },
        { label: 'About you',            index: N + 4 },
        { label: 'How did you decide?',  index: N + 5 },
        { label: 'Last questions',       index: N + 6 },
    ]);

    var skipIdx = IS_TESTING ? (parseInt(urlParams.get('skip'), 10) || 0) : 0;
    jsPsych.run(skipIdx > 0 ? timeline.slice(skipIdx) : timeline);
}

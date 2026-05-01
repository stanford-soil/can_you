// ---- debug logging ----
function logToBrowser(ctx, variable) {
    if (VERBOSE) {
        if (variable) {
            console.log('\t', ctx, ': ', variable);
        } else {
            console.log(ctx);
        }
    }
}

// ---- data pipe helpers ----
// prolificID when available, else subjectID
function getFilePrefix(jsPsych) {
    var d = jsPsych.data.dataProperties;
    var id = d.prolificID || d.subjectID;
    return (TEST ? 'DEBUG_' : '') + d.sessionTimestamp + '_' + id;
}

// convert array of flat objects to CSV string
function toCSV(rows) {
    if (!rows || rows.length === 0) return '';
    var headers = Object.keys(rows[0]);
    var lines = [headers.join(',')];
    rows.forEach(function(row) {
        var vals = headers.map(function(h) {
            var v = row[h];
            if (v === null || v === undefined) return '';
            var s = String(v);
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        });
        lines.push(vals.join(','));
    });
    return lines.join('\n');
}

// ---- mobile check ----
function checkMobile() {
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.innerWidth < 768;
    if (isMobile) {
        document.body.style.fontFamily = 'Helvetica Neue, Arial, sans-serif';
        document.body.innerHTML = `
            <div style='max-width:500px; margin:15vh auto; text-align:center; padding:32px; background:white;
                        border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,0.1);'>
                <p style='font-size:20px; font-weight:600; color:#333;'>Desktop required</p>
                <p style='font-size:16px; color:#666;'>This study must be completed on a desktop or laptop computer.
                Please return this study on Prolific and complete it on a desktop device.</p>
            </div>`;
        window.onbeforeunload = null;
        return true;
    }
    return false;
}

// ---- production protections ----
function applyProductionProtections() {
    document.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('keydown', function(e) {
        if (e.key === 'F12') { e.preventDefault(); return; }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && 'ijcIJC'.includes(e.key)) { e.preventDefault(); return; }
        if ((e.ctrlKey || e.metaKey) && 'uU'.includes(e.key)) { e.preventDefault(); return; }
    });

    ['copy', 'cut', 'paste'].forEach(evt =>
        document.addEventListener(evt, e => e.preventDefault())
    );

    var overlay = document.createElement('div');
    overlay.id = 'fullscreen-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
        <div class='fullscreen-overlay-box'>
            <h2>Please return to fullscreen</h2>
            <p id="fs-overlay-msg"></p>
            <button class='w-btn-primary' id="fs-overlay-btn">Return to Fullscreen</button>
        </div>`;
    document.body.appendChild(overlay);

    function dimOk() {
        return window.outerWidth  - window.innerWidth  <= 160
            && window.outerHeight - window.innerHeight <= 160;
    }
    function refreshOverlay() {
        var inFS = !!document.fullscreenElement;
        if (inFS && dimOk()) { overlay.style.display = 'none'; return; }
        overlay.style.display = 'flex';
        var msg = document.getElementById('fs-overlay-msg');
        if (msg) msg.textContent = inFS
            ? 'Please close any sidebars or extra panels (e.g. browser console), then click below to continue.'
            : 'The study needs to run in fullscreen mode. Click below to continue.';
    }
    document.addEventListener('fullscreenchange', refreshOverlay);
    setInterval(refreshOverlay, 1000);
    document.getElementById('fs-overlay-btn').onclick = function() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(function() {});
        } else {
            refreshOverlay(); // already fullscreen — just re-check dims and hide if ok
        }
    };

    var lastActivity = Date.now();
    ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'].forEach(evt =>
        document.addEventListener(evt, function() { lastActivity = Date.now(); }, { passive: true })
    );
    setInterval(function() {
        if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
            window.onbeforeunload = null;
            document.body.innerHTML = `
                <div style='font-family:Helvetica Neue,Arial,sans-serif; text-align:center; margin-top:15vh; color:#333;'>
                    <p style='font-size:22px; font-weight:600;'>Your session has timed out.</p>
                    <p style='font-size:16px; color:#666;'>You were inactive for more than 5 minutes.<br>
                    Please return this study on Prolific.</p>
                </div>`;
        }
    }, 30000);
}

// ---- save formatters ----
function getBaseSaveFields(d) {
    return {
        trial_type:      'whyask-grid-trial',
        subjectID:       d.subjectID,
        prolificID:      d.prolificID,
        studyID:         d.studyID,
        sessionID:       d.sessionID,
        DEBUG:           TEST ? 1 : 0,
        axisOrder:       d.axisOrder,
        colorAssignment: d.colorAssignment,
        vizMode:         VIZ_MODE,
    };
}

function formatFirstHalf(jsPsych) {
    var d = jsPsych.data.dataProperties;
    var trials = d.trialResponses.slice(0, Math.floor(N_TRIALS_PER_PARTICIPANT / 2));
    return toCSV(trials.map(function(t) {
        return Object.assign(getBaseSaveFields(d), { half: 1 }, t);
    }));
}

function formatSecondHalf(jsPsych) {
    var d = jsPsych.data.dataProperties;
    var trials = d.trialResponses.slice(Math.floor(N_TRIALS_PER_PARTICIPANT / 2));
    return toCSV(trials.map(function(t) {
        return Object.assign(getBaseSaveFields(d), { half: 2 }, t);
    }));
}

function formatDemographics(jsPsych) {
    var d = jsPsych.data.dataProperties;
    var demo = d.demographics || {};
    var row = Object.assign(getBaseSaveFields(d), {
        half:              'demographics',
        trialIndex:        '',
        itemID:            '',
        actionPhrase:      '',
        trialRT:           '',
        suspicious:        '',
        age:               demo.age || '',
        gender:            demo.gender || '',
        race:              (demo.race || []).join(';'),
        education:         demo.education || '',
        strategy:          d.strategy || '',
        technicalIssues:   d.technicalIssues || '',
        feedback:          d.feedback || '',
        visibilityChanges: (d.visibilityChanges || []).length,
        totalDurationMs:   Date.now() - d.startTime,
    });
    return toCSV([row]);
}

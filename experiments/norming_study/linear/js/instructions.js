// linear (1D slider) instruction pages — 3 pages, page 2 has interactive demo
function getInstructionPagesWaffle(axisOrder) {
    var dim1 = axisOrder === 'AW' ? 'able'    : 'willing';
    var dim2 = axisOrder === 'AW' ? 'willing' : 'able';

    var page1 = `
        <div class="w-scene w-scene--centered">
            ${getSectionTickerHTML('instructions')}
            <div class="w-card">
                <div class="w-instr-overline">Instructions · 1 / 3</div>
                <h2 class="w-instr-title">What you'll do</h2>
                <div class="w-instr-rule"></div>
                <div class="w-instr-body">
                    <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 300ms both;">In this study, you'll see a series of everyday scenarios.</p>
                    <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 650ms both;">For each scenario, imagine <b>100 random people</b> are all in that situation.</p>
                    <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 1000ms both;">You'll estimate how many of them would be <em>${dim1}</em> and <em>${dim2}</em> to do the thing being asked.</p>
                </div>
                <hr class="w-hr">
                <div class="w-instr-footer"></div>
            </div>
        </div>`;

    var page2 = `
        <div class="w-scene w-scene--centered">
            ${getSectionTickerHTML('instructions')}
            <div class="w-card">
                <div class="w-instr-overline">Instructions · 2 / 3</div>
                <h2 class="w-instr-title">How it works</h2>
                <div class="w-instr-rule"></div>
                <div class="w-demo-outer" id="w-demo-outer">
                    <div id="w-demo-grid-container" style="position:relative;"></div>
                    <div class="w-demo-caption" id="w-demo-caption"></div>
                    <div class="w-demo-progress" id="w-demo-progress">
                        <div class="w-demo-dots" id="w-demo-dots"></div>
                    </div>
                </div>
                <hr class="w-hr">
                <div class="w-instr-footer"></div>
            </div>
        </div>`;

    var page3 = `
        <div class="w-scene w-scene--centered">
            ${getSectionTickerHTML('instructions')}
            <div class="w-card">
                <div class="w-instr-overline">Instructions · 3 / 3</div>
                <h2 class="w-instr-title">Ready to start!</h2>
                <div class="w-instr-rule"></div>
                <div class="w-instr-body">
                    <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 300ms both;">Remember: there are no right or wrong answers — we're just interested in what you think.</p>
                    <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 650ms both;">Also: being <em>${dim1}</em> and being <em>${dim2}</em> don't always go together.</p>
                    <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 1000ms both;">You will be asked for your thoughts on: <b>30 scenarios</b>.</p>
                </div>
                <hr class="w-hr">
                <div class="w-instr-footer"></div>
            </div>
        </div>`;

    return [page1, page2, page3];
}


// ---- per-page gate times (ms) ----
// page 1 (demo): timer is a minimum read floor; interaction is what actually unlocks
var INSTR_GATES = [2500, 6000, 3000];
var _instrDemoCleanup = null;

// called from main.js on_load + nav handler
function setupInstrPage(page, axisOrder, colorMap) {
    setTimeout(function() {
        var nextBtn = document.getElementById('jspsych-instructions-next');
        var backBtn = document.getElementById('jspsych-instructions-back');
        var footer  = document.querySelector('.w-instr-footer');

        if (footer && nextBtn) {
            footer.innerHTML = '';
            var leftSlot = document.createElement('div');
            if (backBtn) { leftSlot.appendChild(backBtn); }

            var rightCol = document.createElement('div');
            rightCol.style.cssText = 'display:flex; flex-direction:column; align-items:center;';

            var hint = document.createElement('div');
            hint.id = 'w-instr-hint';
            hint.className = 'w-btn-hint';
            hint.textContent = 'Take a moment to read';

            rightCol.appendChild(nextBtn);
            rightCol.appendChild(hint);

            footer.appendChild(leftSlot);
            footer.appendChild(rightCol);
        }

        if (nextBtn) {
            nextBtn.className   = 'w-btn-primary';
            nextBtn.textContent = page === 2 ? 'Start the study' : 'Continue';
            nextBtn.disabled    = true;
        }
        if (backBtn) {
            backBtn.className = 'w-btn-ghost';
        }

        var navBar = document.getElementById('jspsych-instructions-nav');
        if (navBar) navBar.style.display = 'none';

        if (window._instrGateTimer) clearTimeout(window._instrGateTimer);
        var gateMs = INSTR_GATES[page] || 2500;

        if (page === 1) {
            // demo page: both timer floor AND interaction required
            window._instrTimerDone  = false;
            window._instrInteracted = false;
            window._instrTryUnlock  = function() {
                if (!window._instrTimerDone || !window._instrInteracted) {
                    if (window._instrTimerDone && !window._instrInteracted) {
                        var h = document.getElementById('w-instr-hint');
                        if (h) { h.textContent = 'Try dragging the slider above'; h.style.display = ''; }
                    }
                    return;
                }
                var nb = document.getElementById('jspsych-instructions-next');
                if (nb) nb.disabled = false;
                var h = document.getElementById('w-instr-hint');
                if (h) h.style.display = 'none';
            };
            window._instrGateTimer = setTimeout(function() {
                window._instrTimerDone = true;
                window._instrTryUnlock();
            }, gateMs);
            if (_instrDemoCleanup) { _instrDemoCleanup(); _instrDemoCleanup = null; }
            _instrDemoCleanup = initInstrDemoGrid(axisOrder, colorMap);
        } else {
            if (_instrDemoCleanup) { _instrDemoCleanup(); _instrDemoCleanup = null; }
            window._instrGateTimer = setTimeout(function() {
                var nb = document.getElementById('jspsych-instructions-next');
                if (nb) nb.disabled = false;
                var h = document.getElementById('w-instr-hint');
                if (h) h.style.display = 'none';
            }, gateMs);
        }
    }, 30);
}


// ---- slider demo choreography ----
function initInstrDemoGrid(axisOrder, colorMap) {
    var container = document.getElementById('w-demo-grid-container');
    var captionEl = document.getElementById('w-demo-caption');
    var dotsEl    = document.getElementById('w-demo-dots');
    if (!container || !captionEl) return function() {};

    var SIZE    = W_LINEAR_DEMO_SIZE;
    var palette = colorMap || PALETTES[PALETTE_NAME];

    var demoColor  = axisOrder === 'AW' ? palette.AW  : palette.NAW;
    var demoDim    = axisOrder === 'AW' ? 'able and willing' : 'willing and able';
    var noColor    = palette.NANW;

    var grid = buildSliderGrid(container, SIZE, SIZE, demoColor, noColor, {});
    grid.setSliderVisible(false);  // hidden until step 1

    var hasInteracted = false;
    var demoCount     = 0;
    var timers        = [];

    function schedule(delay, fn) {
        var t = setTimeout(fn, delay);
        timers.push(t);
        return t;
    }

    function setCaption(html) {
        captionEl.style.opacity    = '0';
        captionEl.style.transition = 'opacity 250ms ease';
        setTimeout(function() {
            captionEl.innerHTML     = html;
            captionEl.style.opacity = '1';
        }, 250);
    }

    // smooth drift between count values
    function driftToCount(target, durMs, afterFn) {
        var startCount = demoCount;
        var steps      = Math.ceil(durMs / 40);
        var curStep    = 0;
        function tick() {
            if (hasInteracted) { if (afterFn) afterFn(); return; }
            curStep++;
            var t    = Math.min(1, curStep / steps);
            var ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
            var n    = Math.round(startCount + (target - startCount) * ease);
            if (n !== demoCount) { demoCount = n; grid.setValue(n); }
            if (t < 1) { var tid = setTimeout(tick, 40); timers.push(tid); }
            else { demoCount = target; grid.setValue(target); if (afterFn) afterFn(); }
        }
        var t1 = setTimeout(tick, 0); timers.push(t1);
    }

    // progress dots
    function updateDots(currentStep) {
        if (!dotsEl) return;
        dotsEl.innerHTML = '';
        [2, 3, 4, 5, 6].forEach(function(s) {
            var d = document.createElement('div');
            d.className = 'w-demo-dot';
            d.style.width      = currentStep >= s ? '18px' : '6px';
            d.style.background = currentStep >= s ? 'var(--accent)' : 'var(--hairline)';
            dotsEl.appendChild(d);
        });
    }

    function showReplayBtn() {
        var prog = document.getElementById('w-demo-progress');
        if (!prog) return;
        if (prog.querySelector('.w-demo-replay')) return;
        var btn = document.createElement('button');
        btn.className   = 'w-demo-replay';
        btn.textContent = '↻ See it again';
        btn.addEventListener('click', function() {
            cleanup();
            _instrDemoCleanup = initInstrDemoGrid(axisOrder, colorMap);
        });
        prog.appendChild(btn);
    }

    // steps:
    // 0 — all grey, no slider, "100 random people"
    // 1 — slider fades in, "you'll use a slider like this"
    // 2 — "drag to show how many are [dim1]"
    // 3 — animate to ~65
    // 4 — pull back to ~28
    // 5 — drift to 40, invite + pulse

    function goStep(s) {
        if (hasInteracted && s <= 5) return;
        updateDots(s);

        switch (s) {
            case 0:
                setCaption('<div style="animation:fadeIn 500ms ease both;">Imagine there are <b>100 random people</b>.</div>');
                break;

            case 1:
                grid.setSliderVisible(true);
                grid.setInteractable(false);  // locked until invite at step 5
                setCaption('<div style="animation:fadeIn 500ms ease both;">You\'ll use a slider like this one to give your answer</div>');
                break;

            case 2:
                setCaption('<div style="animation:fadeIn 500ms ease both;">Drag it to show how many people are <em>' + demoDim + '</em> to do something.</div>');
                break;

            case 3:
                setCaption('<div style="animation:fadeIn 500ms ease both;">Drag right for more people…</div>');
                grid.forceInteract();
                driftToCount(65, 2200, null);
                break;

            case 4:
                setCaption('<div style="animation:fadeIn 500ms ease both;">…drag left for fewer</div>');
                driftToCount(28, 1800, null);
                break;

            case 5:
                setCaption('');
                driftToCount(40, 1200, function() {
                    if (!hasInteracted) {
                        grid.setInviteActive(true);
                        setCaption('<div style="animation:fadeIn 400ms ease both; font-size:15px; color:var(--muted);">Now try dragging the slider yourself!</div>');
                        showReplayBtn();
                        // forceInteract() ran at step 3 so onInteract won't fire again;
                        // use onChange to catch the first user drag after the invite
                        grid.onChange = function() {
                            if (hasInteracted) return;
                            hasInteracted = true;
                            grid.setInviteActive(false);
                            setCaption('<div style="animation:fadeIn 400ms ease both; font-size:15px; color:var(--muted);">Drag the slider anywhere you like</div>');
                            updateDots(6);
                            window._instrInteracted = true;
                            if (window._instrTryUnlock) window._instrTryUnlock();
                        };
                    }
                });
                break;
        }
    }

    // user takes over
    grid.onInteract = function() {
        if (hasInteracted) return;
        hasInteracted = true;
        timers.forEach(clearTimeout);
        timers = [];
        grid.setInviteActive(false);
        setCaption('<div style="animation:fadeIn 400ms ease both; font-size:15px; color:var(--muted);">Drag the slider anywhere you like</div>');
        updateDots(6);
        showReplayBtn();
        window._instrInteracted = true;
        if (window._instrTryUnlock) window._instrTryUnlock();
    };

    goStep(0);
    schedule(3000,  function() { goStep(1); });
    schedule(6000,  function() { goStep(2); });
    schedule(8500,  function() { goStep(3); });
    schedule(12000, function() { goStep(4); });
    schedule(15500, function() { goStep(5); });

    function cleanup() {
        timers.forEach(clearTimeout);
        timers = [];
        grid.destroy();
    }

    return cleanup;
}

// ---- instruction pages (2 pages; ready-to-start is shown after practice) ----
function getInstructionPagesWaffle(axisOrder) {
    var xDim = axisOrder === 'AW' ? 'able'    : 'willing';
    var yDim = axisOrder === 'AW' ? 'willing' : 'able';

    var page1 = `
        <div class="w-scene w-scene--centered">
            ${getSectionTickerHTML('instructions')}
            <div class="w-card">
                <div class="w-instr-overline">Instructions · 1 / 2</div>
                <h2 class="w-instr-title">What you'll do</h2>
                <div class="w-instr-rule"></div>
                <div class="w-instr-body">
                    <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 300ms both;">In this study, you'll see a series of everyday scenarios.</p>
                    <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 650ms both;">For each scenario, imagine <b>100 random people</b> are all in that situation.</p>
                    <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 1000ms both;">You'll estimate how many of them would be <em>${xDim}</em> and <em>${yDim}</em> to do the thing being asked.</p>
                </div>
                <hr class="w-hr">
                <div class="w-instr-footer"></div>
            </div>
        </div>`;

    var page2 = `
        <div class="w-scene w-scene--centered">
            ${getSectionTickerHTML('instructions')}
            <div class="w-card" style="max-width:1100px;">
                <div class="w-instr-overline">Instructions · 2 / 2</div>
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

    return [page1, page2];
}


// ---- per-page gate times (ms) ----
// page 0: timer only; page 1: timer floor + grid interaction required (interaction is what unlocks)
var INSTR_GATES = [2500, 8000];
var _instrDemoCleanup = null;

function setupInstrPage(page, axisOrder, colorMap) {
    setTimeout(function() {
        var nextBtn = document.getElementById('jspsych-instructions-next');
        var backBtn = document.getElementById('jspsych-instructions-back');
        var footer  = document.querySelector('.w-instr-footer');

        if (footer && nextBtn) {
            footer.innerHTML = '';
            var leftSlot = document.createElement('div');
            if (backBtn) leftSlot.appendChild(backBtn);

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
            nextBtn.textContent = page === 1 ? 'Continue to practice' : 'Continue';
            nextBtn.disabled    = true;
        }
        if (backBtn) backBtn.className = 'w-btn-ghost';

        var navBar = document.getElementById('jspsych-instructions-nav');
        if (navBar) navBar.style.display = 'none';

        if (window._instrGateTimer) clearTimeout(window._instrGateTimer);
        var gateMs = INSTR_GATES[page] || 2500;

        if (page === 1) {
            // demo page: both timer AND interaction needed
            window._instrTimerDone  = false;
            window._instrInteracted = false;
            window._instrTryUnlock  = function() {
                if (!window._instrTimerDone || !window._instrInteracted) {
                    if (window._instrTimerDone && !window._instrInteracted) {
                        var h = document.getElementById('w-instr-hint');
                        if (h) { h.textContent = 'Try moving one of the lines above'; h.style.display = ''; }
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


// ---- demo grid choreography — bent crosshair ----
function initInstrDemoGrid(axisOrder, colorMap) {
    var container = document.getElementById('w-demo-grid-container');
    var captionEl = document.getElementById('w-demo-caption');
    var dotsEl    = document.getElementById('w-demo-dots');
    if (!container || !captionEl) return function() {};

    var SIZE    = W_DEMO_SIZE;
    var palette = colorMap || BC_PAL;
    var cfg     = getBCConfig(axisOrder, palette);

    // labels for caption
    var dim1 = axisOrder === 'AW' ? 'able'    : 'willing';
    var dim2 = axisOrder === 'AW' ? 'willing' : 'able';
    var not1 = axisOrder === 'AW' ? 'not able'    : 'not willing';

    // build grid — hide side panels (caption handles narration)
    var grid = buildBentCrosshairGrid(container, SIZE, axisOrder, palette, {
        panelWidth:     150,
        figuresRaining: true,
    });

    grid.setPointerEvents(false);

    var step         = 0;
    var hasInteracted = false;
    var timers       = [];
    var inviteTimer  = null;

    function schedule(delay, fn) {
        var t = setTimeout(fn, delay);
        timers.push(t);
        return t;
    }

    function setCaption(html) {
        captionEl.style.opacity    = '0';
        captionEl.style.transition = 'opacity 250ms ease';
        setTimeout(function() {
            captionEl.innerHTML = html;
            captionEl.style.opacity = '1';
        }, 250);
    }

    // 7 dots tracking key demo milestones; 11 = all done
    function updateDots(currentStep) {
        if (!dotsEl) return;
        dotsEl.innerHTML = '';
        [2,3,5,6,8,9,10].forEach(function(s) {
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

    // chain of animateTo calls — each step animates smoothly to target
    function chainAnimate(chain, i) {
        if (hasInteracted || i >= chain.length) return;
        var p = chain[i];
        grid.animateTo(p.sx, p.syL, p.syR, p.dur, function() {
            chainAnimate(chain, i + 1);
        });
    }

    function goStep(s) {
        if (hasInteracted && s < 9) return;
        step = s;
        updateDots(s);

        switch (s) {
            case 0:
                setCaption('Here are <b>100 random people</b>');
                break;

            case 1:
                setCaption('Your task is to sort them for each scenario');
                break;

            case 2:
                // v-line appears
                grid.setPos(5, 5, 5);
                setCaption('<b>Step 1 — vertical line</b>');
                break;

            case 3:
                // drift v-line: 2 → 7 → 4
                setCaption('Drag it left or right to set the split');
                chainAnimate([
                    {sx:2, syL:5, syR:5, dur:2700},
                    {sx:7, syL:5, syR:5, dur:2700},
                    {sx:4, syL:5, syR:5, dur:2000},
                ], 0);
                break;

            case 4:
                // pre-reveal: show left panel question text, highlighted
                grid.showLeftPanel();
                setCaption('');
                break;

            case 5:
                // stage 2 — left H line appears
                grid.advanceToStage(2);
                setCaption('<b>Step 2 — left line</b>');
                break;

            case 6:
                // drift left H: 2 → 8 → 4
                chainAnimate([
                    {sx:4, syL:2, syR:5, dur:2700},
                    {sx:4, syL:8, syR:5, dur:2700},
                    {sx:4, syL:4, syR:5, dur:2000},
                ], 0);
                break;

            case 7:
                // pre-reveal: show right panel question text, highlighted
                grid.showRightPanel();
                setCaption('');
                break;

            case 8:
                // stage 3 — right H line appears
                grid.advanceToStage(3);
                setCaption('<b>Step 3 — right line</b>');
                break;

            case 9:
                // drift right H: 2 → 8 → 4
                chainAnimate([
                    {sx:4, syL:4, syR:2, dur:2700},
                    {sx:4, syL:4, syR:8, dur:2700},
                    {sx:4, syL:4, syR:4, dur:2000},
                ], 0);
                break;

            case 10:
                inviteTimer = setTimeout(function() {
                    grid.setInviteActive(true);
                    grid.setPointerEvents(true);
                    setCaption('Now you can try!');
                    updateDots(11);
                    showReplayBtn();
                }, 400);
                timers.push(inviteTimer);
                break;
        }
    }

    // user interaction cancels scripted animation and unlocks button gate
    grid.onInteract = function() {
        if (hasInteracted) return;
        hasInteracted = true;
        timers.forEach(clearTimeout); timers = [];
        if (inviteTimer) clearTimeout(inviteTimer);
        grid.cancelAnimations();
        grid.setInviteActive(false);
        setCaption('Drag any of the three lines to adjust!');
        updateDots(11);
        showReplayBtn();
        window._instrInteracted = true;
        if (window._instrTryUnlock) window._instrTryUnlock();
    };

    // ---- timing ----
    // v-drift:      starts 16000, 2×2700+2000=7400ms, ends ~23400
    // q2 pre-reveal: 26000; left H: 29500
    // left-drift:   starts 33500, ends ~40900
    // q3 pre-reveal: 43500; right H: 47000
    // right-drift:  starts 51000, ends ~58400
    // invite:        61000
    goStep(0);
    schedule(5000,  function() { goStep(1); });
    schedule(11000, function() { goStep(2); });
    schedule(16000, function() { goStep(3); });
    schedule(26000, function() { goStep(4); });
    schedule(29500, function() { goStep(5); });
    schedule(33500, function() { goStep(6); });
    schedule(43500, function() { goStep(7); });
    schedule(47000, function() { goStep(8); });
    schedule(51000, function() { goStep(9); });
    schedule(61000, function() { goStep(10); });

    function cleanup() {
        timers.forEach(clearTimeout); timers = [];
        if (inviteTimer) clearTimeout(inviteTimer);
        grid.destroy();
    }

    return cleanup;
}

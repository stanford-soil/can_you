// waffle instruction pages — 3 pages, page 2 is the interactive demo grid
function getInstructionPagesWaffle(axisOrder) {
    var xPos = axisOrder === 'AW' ? 'Able'        : 'Willing';
    var yPos = axisOrder === 'AW' ? 'Willing'     : 'Able';
    var xDim = axisOrder === 'AW' ? 'able'        : 'willing';
    var yDim = axisOrder === 'AW' ? 'willing'     : 'able';

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
                    <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 1000ms both;">You'll estimate how many of them would be <em>${xDim}</em> and <em>${yDim}</em> to do the thing being asked.</p>
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
                    <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 300ms both;">There are no right or wrong answers — we're just interested in what you think.</p>
                    <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 650ms both;">Remember: being <em>${xDim}</em> and being <em>${yDim}</em> don't always go together.</p>
                    <p style="animation: fadeUp 600ms cubic-bezier(.2,.8,.2,1) 1000ms both;">You will be asked for your thoughts on: <b>30 scenarios</b>.</p>
                </div>
                <hr class="w-hr">
                <div class="w-instr-footer"></div>
            </div>
        </div>`;

    return [page1, page2, page3];
}


// ---- per-page gate times (ms) ----
var INSTR_GATES = [2500, 35000, 3000];
var _instrDemoCleanup = null;  // holds cleanup fn for demo grid

// called from main_waffle.js on_load + nav handler
function setupInstrPage(page, axisOrder, colorMap) {
    // give the DOM a tick to fully render the new page
    setTimeout(function() {
        var nextBtn = document.getElementById('jspsych-instructions-next');
        var backBtn = document.getElementById('jspsych-instructions-back');
        var footer  = document.querySelector('.w-instr-footer');

        // move buttons into the card footer so they sit inside the card
        if (footer && nextBtn) {
            footer.innerHTML = '';  // clear any previous
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
            nextBtn.className = 'w-btn-primary';
            nextBtn.textContent = page === 2 ? 'Start the study' : 'Continue';
            nextBtn.disabled = true;
        }
        if (backBtn) {
            backBtn.className = 'w-btn-ghost';
        }

        // hide the original jsPsych nav bar (buttons now live in the card)
        var navBar = document.getElementById('jspsych-instructions-nav');
        if (navBar) navBar.style.display = 'none';

        // gate timer
        if (window._instrGateTimer) clearTimeout(window._instrGateTimer);
        var gateMs = INSTR_GATES[page] || 2500;
        window._instrGateTimer = setTimeout(function() {
            var nb = document.getElementById('jspsych-instructions-next');
            if (nb) nb.disabled = false;
            var h = document.getElementById('w-instr-hint');
            if (h) h.style.display = 'none';
        }, gateMs);

        // init demo grid on page 2
        if (page === 1) {
            if (_instrDemoCleanup) { _instrDemoCleanup(); _instrDemoCleanup = null; }
            _instrDemoCleanup = initInstrDemoGrid(axisOrder, colorMap);
        } else {
            if (_instrDemoCleanup) { _instrDemoCleanup(); _instrDemoCleanup = null; }
        }
    }, 30);
}


// ---- demo grid choreography (9-step) ----
function initInstrDemoGrid(axisOrder, colorMap) {
    var container = document.getElementById('w-demo-grid-container');
    var captionEl = document.getElementById('w-demo-caption');
    var dotsEl    = document.getElementById('w-demo-dots');
    if (!container || !captionEl) return function() {};

    // offset caption to center under the grid area (not y-axis col, which is 124+14=138px)
    captionEl.style.paddingLeft = '138px';

    var SIZE = 400;
    var palette = colorMap || PALETTES[PALETTE_NAME];

    // build the WaffleGrid
    var grid = buildWaffleGridVanilla(container, SIZE, axisOrder, palette, {
        snap: true,
        hapticOnSnap: true,
        hideAxes: true,
        hideCrosshair: true,
        showCounts: false,
        hidePills: true,
        figuresRaining: true,
    });

    var step = 0;
    var hasInteracted = false;
    var timers = [];
    var inviteTimer = null;

    function schedule(delay, fn) {
        var t = setTimeout(fn, delay);
        timers.push(t);
        return t;
    }

    function setCaption(html) {
        captionEl.style.opacity = '0';
        captionEl.style.transition = 'opacity 250ms ease';
        setTimeout(function() {
            captionEl.innerHTML = html;
            captionEl.style.opacity = '1';
        }, 250);
    }

    var QUADS = {
        AW:   { label: 'Able and willing to',             color: palette.AW },
        NAW:  { label: 'Not able, but willing to',        color: palette.NAW },
        ANW:  { label: 'Able, but not willing to',        color: palette.ANW },
        NANW: { label: 'Neither able nor willing to',     color: palette.NANW },
    };

    function hexA(hex, a) {
        var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return 'rgba('+r+','+g+','+b+','+a+')';
    }

    function quadCaptionPill(key) {
        var q = QUADS[key];
        return '<div class="w-demo-caption-pill" style="background:' + hexA(q.color,0.10) + '; border:1px solid ' + hexA(q.color,0.28) + ';">'
             + '<div class="w-demo-caption-dot" style="background:' + q.color + ';"></div>'
             + '<span style="font-size:15px; font-weight:600; color:var(--ink);">' + q.label + '</span>'
             + '<span style="font-size:14px; color:var(--muted);">'
             + '</div>';
    }

    // progress dots (steps 3-8)
    function updateDots(currentStep) {
        if (!dotsEl) return;
        dotsEl.innerHTML = '';
        [3,4,5,6,7,8].forEach(function(s) {
            var d = document.createElement('div');
            d.className = 'w-demo-dot';
            d.style.width    = currentStep >= s ? '18px' : '6px';
            d.style.background = currentStep >= s ? 'var(--accent)' : 'var(--hairline)';
            dotsEl.appendChild(d);
        });
    }

    function showReplayBtn() {
        var prog = document.getElementById('w-demo-progress');
        if (!prog) return;
        var existing = prog.querySelector('.w-demo-replay');
        if (existing) return;
        var btn = document.createElement('button');
        btn.className = 'w-demo-replay';
        btn.textContent = '↻ See it again';
        btn.addEventListener('click', function() {
            cleanup();
            _instrDemoCleanup = initInstrDemoGrid(axisOrder, colorMap);
        });
        prog.appendChild(btn);
    }

    // step handler
    function goStep(s) {
        if (hasInteracted && s <= 8) return;
        step = s;
        updateDots(s);

        switch (s) {
            case 0:
                setCaption('<div style="animation:fadeIn 500ms ease both;">Imagine there are <b>100 random people</b>.</div>');
                grid.setHideAxes(true);
                grid.setHideCrosshair(true);
                grid.setPalette({ AW: '#A89E91', NAW: '#A89E91', ANW: '#A89E91', NANW: '#A89E91' });
                break;
            case 1:
                setCaption('<div style="animation:fadeIn 500ms ease both;">For each scenario, you\'ll estimate how many are <b>' + xPos + '</b> and <b>' + yPos + '</b> to do something.</div>');
                break;
            case 2:
                setCaption('<div style="animation:fadeIn 500ms ease both;">This grid splits them by <em>ability</em> and <em>willingness</em>.</div>');
                grid.setHideAxes(false);
                grid.setHideCrosshair(false);
                grid.setPalette(palette);
                grid.setPos(5, 5);
                break;
            case 3:
                setCaption(quadCaptionPill('AW'));
                grid.setHighlight('AW');
                break;
            case 4:
                setCaption(quadCaptionPill('NAW'));
                grid.setHighlight('NAW');
                break;
            case 5:
                setCaption(quadCaptionPill('ANW'));
                grid.setHighlight('ANW');
                break;
            case 6:
                setCaption(quadCaptionPill('NANW'));
                grid.setHighlight('NANW');
                break;
            case 7:
                setCaption('<div style="animation:fadeIn 400ms ease both; font-size:15px; color:var(--muted);">The crosshair controls how the 100 people split.</div>');
                grid.setHighlight(null);
                grid.setHidePills(false);
                grid.setShowCounts(true);
                break;
            case 8:
                setCaption('<div style="animation:fadeIn 400ms ease both; font-size:15px; color:var(--muted);">Watch the numbers update — then try dragging it yourself!</div>');
                // scripted drift
                var driftPath = [
                    { sx: 3, sy: 3, t: 1600 },
                    { sx: 7, sy: 3, t: 1600 },
                    { sx: 7, sy: 7, t: 1600 },
                    { sx: 5, sy: 5, t: 1200 },
                ];
                var di = 0;
                function nextDrift() {
                    if (hasInteracted || di >= driftPath.length) {
                        if (!hasInteracted) {
                            inviteTimer = setTimeout(function() {
                                grid.setInviteActive(true);
                                setCaption('<div style="animation:fadeIn 400ms ease both; font-size:15px; color:var(--muted);">Drag the crosshair anywhere on the grid.</div>');
                                updateDots(9);
                                showReplayBtn();
                            }, 400);
                            timers.push(inviteTimer);
                        }
                        return;
                    }
                    grid.setPos(driftPath[di].sx, driftPath[di].sy);
                    var t = setTimeout(function() { di++; nextDrift(); }, driftPath[di].t);
                    timers.push(t);
                }
                nextDrift();
                break;
        }
    }

    // user interaction cancels auto-animation
    grid.onInteract = function() {
        if (hasInteracted) return;
        hasInteracted = true;
        timers.forEach(clearTimeout);
        timers = [];
        if (inviteTimer) clearTimeout(inviteTimer);
        grid.setInviteActive(false);
        grid.setHighlight(null);
        grid.setHidePills(false);
        grid.setShowCounts(true);
        setCaption('<div style="animation:fadeIn 400ms ease both; font-size:15px; color:var(--muted);">Drag the crosshair anywhere on the grid.</div>');
        updateDots(9);
        showReplayBtn();
    };

    // locked until invite at step 8
    grid.setPointerEvents(false);

    // kick off the sequence
    goStep(0);
    schedule(3000,  function() { goStep(1); });
    schedule(6500,  function() { goStep(2); });
    schedule(9500,  function() { goStep(3); });
    schedule(14500, function() { goStep(4); });
    schedule(19500, function() { goStep(5); });
    schedule(24500, function() { goStep(6); });
    schedule(29500, function() { goStep(7); });
    schedule(33500, function() { goStep(8); });

    function cleanup() {
        timers.forEach(clearTimeout);
        timers = [];
        if (inviteTimer) clearTimeout(inviteTimer);
        grid.destroy();
    }

    return cleanup;
}


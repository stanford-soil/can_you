// ---- geometry ----
var W_LINEAR_W         = 560;  // trial grid width (px)
var W_LINEAR_H         = 420;  // trial grid height (px)
var W_LINEAR_DEMO_SIZE = 360;  // demo grid (square, px)

function hexToRgba(hex, a) {
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
}


// ============================================================
// buildSliderGrid — vanilla JS slider component
// 100-figure grid + horizontal slider (0–100).
//   yesColor  : color for "yes" figures (the one being rated)
//   baseColor : starting color for all figures (noColor or grid1Color)
//   Slider thumb inits at 50 w/ '?', shows number after first interaction.
//   Stochastic fill: fixed random permutation — first n figures get yesColor.
// Returns a controller object.
// ============================================================
function buildSliderGrid(parentEl, gW, gH, yesColor, baseColor, opts) {
    opts = opts || {};

    var hasInteracted = false;
    var hasReleased   = false;
    var destroyed     = false;

    var ctrl = { onInteract: null, onRelease: null, onChange: null };

    // fixed random permutation for stochastic fill
    var fillOrder = [];
    for (var k = 0; k < 100; k++) fillOrder.push(k);
    for (var k = 99; k > 0; k--) {
        var j = Math.floor(Math.random() * (k + 1));
        var tmp = fillOrder[k]; fillOrder[k] = fillOrder[j]; fillOrder[j] = tmp;
    }
    // fillRank[figIdx] = rank in fill order (0 = first to turn yesColor)
    var fillRank = new Array(100);
    fillOrder.forEach(function(figIdx, rank) { fillRank[figIdx] = rank; });

    // ---- build DOM ----
    var wrapper = document.createElement('div');
    wrapper.className = 'wl-wrapper';

    // figure area
    var figArea = document.createElement('div');
    figArea.className = 'wg-figure-area';
    figArea.style.width  = gW + 'px';
    figArea.style.height = gH + 'px';
    figArea.style.cursor = 'default';

    var NS    = 'http://www.w3.org/2000/svg';
    var cellW = gW / 10;
    var cellH = gH / 10;
    var figGs = [];  // array of <g> elements (one per figure)

    for (var i = 0; i < 100; i++) {
        var col = i % 10, row = Math.floor(i / 10);
        var cell = document.createElement('div');
        cell.className   = 'wg-figure-cell';
        cell.style.left  = (col * cellW) + 'px';
        cell.style.top   = (row * cellH) + 'px';
        cell.style.width  = cellW + 'px';
        cell.style.height = cellH + 'px';

        var rainDelay = (row * 10 + col) * 14;
        cell.style.animation = 'figureRain 500ms cubic-bezier(.2,.8,.2,1) ' + rainDelay + 'ms both';

        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 12 14');
        svg.setAttribute('width',   cellW * 0.55);
        svg.setAttribute('height',  cellH * 0.65);

        var g = document.createElementNS(NS, 'g');
        g.style.transition = 'fill 150ms ease';
        g.style.fill = baseColor;

        var head = document.createElementNS(NS, 'circle');
        head.setAttribute('cx', '6'); head.setAttribute('cy', '3.8'); head.setAttribute('r', '3');
        var body = document.createElementNS(NS, 'path');
        body.setAttribute('d', 'M0,14 Q0,8.5 3,7.5 Q4.2,8 6,8 Q7.8,8 9,7.5 Q12,8.5 12,14Z');

        g.appendChild(head);
        g.appendChild(body);
        svg.appendChild(g);
        cell.appendChild(svg);
        figArea.appendChild(cell);
        figGs.push(g);
    }

    wrapper.appendChild(figArea);

    // ---- slider section ----
    var sliderWrap = document.createElement('div');
    sliderWrap.className = 'wl-slider-wrapper';
    sliderWrap.style.width = gW + 'px';

    // count display — above the slider, centered
    var countDisp = document.createElement('div');
    countDisp.className = 'wl-count-display';
    countDisp.innerHTML = '<span class="wl-count-n wl-count-placeholder">?</span>';

    var sliderCont = document.createElement('div');
    sliderCont.className = 'wl-slider-container';

    var sliderEl = document.createElement('input');
    sliderEl.type      = 'range';
    sliderEl.min       = '0';
    sliderEl.max       = '100';
    sliderEl.value     = '0';
    sliderEl.className = 'wl-slider';

    sliderCont.appendChild(sliderEl);

    var edgeLbls = document.createElement('div');
    edgeLbls.className = 'wl-slider-edge-labels';
    var lLeft  = document.createElement('span'); lLeft.textContent  = '0';
    var lRight = document.createElement('span'); lRight.textContent = '100';
    edgeLbls.appendChild(lLeft);
    edgeLbls.appendChild(lRight);

    sliderWrap.appendChild(countDisp);
    sliderWrap.appendChild(sliderCont);
    sliderWrap.appendChild(edgeLbls);
    wrapper.appendChild(sliderWrap);
    parentEl.appendChild(wrapper);

    // ---- render helpers ----
    function updateCountDisplay() {
        var n = parseInt(sliderEl.value);
        if (!hasInteracted) {
            countDisp.innerHTML = '<span class="wl-count-n wl-count-placeholder">?</span>';
        } else {
            countDisp.innerHTML =
                '<span class="wl-count-n" style="color:' + yesColor + ';">' + n + '</span>' +
                '<span class="wl-count-denom"> / 100</span>';
        }
    }

    function updateTrackBg() {
        if (!hasInteracted) {
            sliderEl.style.background = '#E8E2D5';
            return;
        }
        var pct = sliderEl.value + '%';
        sliderEl.style.background =
            'linear-gradient(to right, ' + yesColor + ' ' + pct + ', #E8E2D5 ' + pct + ')';
    }

    function renderFigures() {
        var n = parseInt(sliderEl.value);
        figGs.forEach(function(g, idx) {
            g.style.fill = (fillRank[idx] < n) ? yesColor : baseColor;
        });
    }

    // initial state
    updateCountDisplay();
    updateTrackBg();

    // ---- events ----
    function activate() {
        if (hasInteracted) return;
        hasInteracted = true;
        updateCountDisplay();
        updateTrackBg();
        renderFigures();
        if (ctrl.onInteract) ctrl.onInteract();
    }

    function onInput() {
        activate();
        updateCountDisplay();
        updateTrackBg();
        renderFigures();
        if (ctrl.onChange) ctrl.onChange({ count: parseInt(sliderEl.value) });
    }

    function onDown() {
        // activate immediately on mousedown/touchstart (not waiting for value change)
        activate();
    }

    function onUp() {
        if (!hasInteracted) return;
        if (!hasReleased) {
            hasReleased = true;
            if (ctrl.onRelease) ctrl.onRelease();
        }
    }

    sliderEl.addEventListener('input',      onInput);
    sliderEl.addEventListener('mousedown',  onDown);
    sliderEl.addEventListener('touchstart', onDown, { passive: true });
    sliderEl.addEventListener('mouseup',    onUp);
    sliderEl.addEventListener('touchend',   onUp);

    // ---- controller ----
    ctrl.getValue = function() { return parseInt(sliderEl.value); };

    // setValue: for demo animation — bypasses interaction tracking
    ctrl.setValue = function(n, silent) {
        sliderEl.value = n;
        if (hasInteracted) {
            updateCountDisplay();
            updateTrackBg();
            renderFigures();
        }
        if (!silent && ctrl.onChange) ctrl.onChange({ count: n });
    };

    // forceInteract: for demo — marks as interacted so numbers show
    ctrl.forceInteract = function() {
        if (hasInteracted) return;
        hasInteracted = true;
        updateCountDisplay();
        updateTrackBg();
        renderFigures();
    };

    ctrl.setInteractable = function(enabled) {
        sliderEl.style.pointerEvents = enabled ? '' : 'none';
    };

    ctrl.setInviteActive = function(active) {
        sliderEl.classList.toggle('wl-slider--invite', active);
        if (active) ctrl.setInteractable(true);
    };

    ctrl.setSliderVisible = function(visible) {
        sliderWrap.style.transition  = 'opacity 400ms ease';
        sliderWrap.style.opacity     = visible ? '1' : '0';
        sliderWrap.style.pointerEvents = visible ? '' : 'none';
    };

    ctrl.setPointerEvents = function(enabled) {
        sliderEl.style.pointerEvents = enabled ? '' : 'none';
        sliderEl.style.opacity       = enabled ? '' : '0.55';
    };

    ctrl.destroy = function() {
        destroyed = true;
        sliderEl.removeEventListener('input',      onInput);
        sliderEl.removeEventListener('mousedown',  onDown);
        sliderEl.removeEventListener('touchstart', onDown);
        sliderEl.removeEventListener('mouseup',    onUp);
        sliderEl.removeEventListener('touchend',   onUp);
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    };

    return ctrl;
}


// ============================================================
// Trial builder — two sequential 1D slider grids
// ============================================================
function buildLinearTrial(stimulus, axisOrder, colorMap, trialIndex, jsPsych) {
    var palette = colorMap || PALETTES[PALETTE_NAME];

    var grid1Color = axisOrder === 'AW' ? palette.AW  : palette.NAW;
    var grid2Color = axisOrder === 'AW' ? palette.NAW : palette.AW;
    var noColor    = palette.NANW;

    var dim1 = axisOrder === 'AW' ? 'able'    : 'willing';
    var dim2 = axisOrder === 'AW' ? 'willing' : 'able';

    var grid1Label = 'How many of the 100 people would be <em>' + dim1 + '</em> to do this?';
    var grid2Label = 'If all 100 people were <em>' + dim1 + '</em> to do this, how many would be <em>' + dim2 + '</em> to do it?';

    var isFirstFew     = trialIndex <= 2;
    var vignetteGateMs = isFirstFew ? 3000 : 1800;
    var gridGateMs     = isFirstFew ? 1500 : 600;
    var grid2GateMs    = isFirstFew ? 1200 : 600;
    var totalTrials    = N_TRIALS_PER_PARTICIPANT;

    var pct = Math.round(((trialIndex - 1) / totalTrials) * 100);

    var html = `
        <div class="w-scene">
            ${getSectionTickerHTML('study')}
            <div class="w-progress-strip">
                <div class="w-progress-row">
                    <span class="w-progress-label">Scenario ${trialIndex} of ${totalTrials}</span>
                    <span class="w-progress-pct">${pct}%</span>
                </div>
                <div class="w-progress-track">
                    <div class="w-progress-fill" id="w-prog-fill" style="width:${pct}%;"></div>
                </div>
            </div>
            <div class="w-card" id="w-trial-card">
                <div id="w-stimulus-section" style="${isFirstFew ? 'padding-top:80px;' : ''} transition:${isFirstFew ? 'padding-top 700ms cubic-bezier(.22,.8,.28,1)' : 'none'};">
                    <p class="w-vignette">${stimulus.vignette}</p>
                    <p class="w-question">"Can you ${stimulus.actionPhrase}?"</p>
                </div>
                <div id="w-grids-section" style="opacity:0; transform:translateY(20px); transition:opacity 500ms ease, transform 500ms cubic-bezier(.2,.8,.2,1); pointer-events:none;">
                    <div class="w-grids-row">
                        <div class="w-grid-col" id="w-grid1-col">
                            <p class="w-grid-label">${grid1Label}</p>
                            <div id="w-grid1-container"></div>
                        </div>
                        <div class="w-grid-col" id="w-grid2-col" style="display:none; opacity:0; transform:translateX(40px); transition:opacity 500ms ease, transform 500ms cubic-bezier(.2,.8,.2,1); pointer-events:none;">
                            <p class="w-grid-label">${grid2Label}</p>
                            <div id="w-grid2-container"></div>
                        </div>
                    </div>
                    <div class="w-grid-actions">
                        <div class="w-grid-spacer">
                            ${trialIndex > 1 ? '<button id="w-prev-btn" class="w-btn-ghost">← Previous</button>' : ''}
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <button id="w-submit-btn" class="w-btn-primary" disabled>Submit</button>
                            <div class="w-btn-hint" id="w-submit-hint">Use the slider to answer</div>
                        </div>
                        <div class="w-grid-spacer"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: html,
        choices: [],
        response_ends_trial: false,
        on_load: function() {
            var trialStart        = performance.now();
            var hasInteracted1    = false;
            var hasInteracted2    = false;
            var vignetteGate      = false;
            var gridGate          = false;
            var grid2Revealed     = false;
            var grid2Gate         = false;
            var submitting        = false;
            var firstInterRT      = null;
            var grid2FirstInterRT = null;
            var lastCount1        = 0;
            var lastCount2        = 0;

            var stimSection  = document.getElementById('w-stimulus-section');
            var gridsSection = document.getElementById('w-grids-section');
            var grid2Col     = document.getElementById('w-grid2-col');
            var grid1Cont    = document.getElementById('w-grid1-container');
            var grid2Cont    = document.getElementById('w-grid2-container');
            var submitBtn    = document.getElementById('w-submit-btn');
            var hintEl       = document.getElementById('w-submit-hint');
            var prevBtn      = document.getElementById('w-prev-btn');

            // grid1: figures start grey, turns grid1Color
            // grid2: figures start grid1Color ("given all 100 are dim1"), turns grid2Color
            var grid1 = buildSliderGrid(grid1Cont, W_LINEAR_W, W_LINEAR_H, grid1Color, noColor);
            var grid2 = buildSliderGrid(grid2Cont, W_LINEAR_W, W_LINEAR_H, grid2Color, grid1Color);

            grid1.onChange = function(state) {
                lastCount1 = state.count;
                if (!hasInteracted1) {
                    hasInteracted1 = true;
                    firstInterRT   = Math.round(performance.now() - trialStart);
                }
                updateSubmitState();
            };

            grid1.onRelease = function() {
                if (grid2Revealed) return;
                grid2Revealed = true;
                grid2Col.style.display        = 'flex';
                grid2Col.style.flexDirection  = 'column';
                setTimeout(function() {
                    grid2Col.style.opacity       = '1';
                    grid2Col.style.transform     = 'translateX(0)';
                    grid2Col.style.pointerEvents = 'auto';
                }, 20);
                setTimeout(function() { grid2Gate = true; updateSubmitState(); }, grid2GateMs);
            };

            grid2.onChange = function(state) {
                lastCount2 = state.count;
                if (!hasInteracted2) {
                    hasInteracted2    = true;
                    grid2FirstInterRT = Math.round(performance.now() - trialStart);
                }
                updateSubmitState();
            };

            function updateSubmitState() {
                var canSubmit = hasInteracted1 && hasInteracted2 &&
                                vignetteGate && gridGate && grid2Gate && !submitting;
                submitBtn.disabled = !canSubmit;
                if (submitting) {
                    hintEl.style.display = 'none';
                } else if (!hasInteracted1) {
                    hintEl.textContent   = 'Use the slider to answer';
                    hintEl.style.display = '';
                } else if (!grid2Revealed) {
                    hintEl.textContent   = 'Release to see the second question';
                    hintEl.style.display = '';
                } else if (!hasInteracted2) {
                    hintEl.textContent   = 'Now answer the second question';
                    hintEl.style.display = '';
                } else if (!gridGate || !grid2Gate) {
                    hintEl.textContent   = 'Take a moment to look it over';
                    hintEl.style.display = '';
                } else {
                    hintEl.style.display = 'none';
                }
            }

            // vignette gate + grid1 reveal
            setTimeout(function() {
                vignetteGate = true;
                if (isFirstFew) stimSection.style.paddingTop = '0px';
                gridsSection.style.opacity       = '1';
                gridsSection.style.transform     = 'translateY(0)';
                gridsSection.style.pointerEvents = 'auto';
                grid1Cont.style.animation = 'gridReveal 600ms cubic-bezier(.2,.8,.2,1) both';
                updateSubmitState();
            }, vignetteGateMs);

            // grid gate
            setTimeout(function() {
                gridGate = true;
                updateSubmitState();
            }, vignetteGateMs + gridGateMs);

            function onKey(e) {
                if (e.key === 'Enter' && !submitBtn.disabled && !submitting) doSubmit();
            }
            document.addEventListener('keydown', onKey);

            function doSubmit() {
                if (submitting) return;
                submitting = true;
                var totalRT = Math.round(performance.now() - trialStart);

                submitBtn.classList.add('confirmed');
                submitBtn.innerHTML  = '<span style="font-size:16px;">✓</span> Recorded';
                submitBtn.disabled   = true;
                hintEl.style.display = 'none';
                grid1.setPointerEvents(false);
                grid2.setPointerEvents(false);

                var abilityResp     = axisOrder === 'AW' ? lastCount1 : lastCount2;
                var willingnessResp = axisOrder === 'AW' ? lastCount2 : lastCount1;

                var trialData = {
                    itemID:                  stimulus.itemID,
                    actionPhrase:            stimulus.actionPhrase,
                    vignette:                stimulus.vignette,
                    axisOrder:               axisOrder,
                    grid1Count:              lastCount1,
                    grid2Count:              lastCount2,
                    abilityResponse:         abilityResp,
                    willingnessResponse:     willingnessResp,
                    firstInteractionRT:      firstInterRT,
                    grid2FirstInteractionRT: grid2FirstInterRT,
                    trialRT:                 totalRT,
                    trialIndex:              trialIndex,
                    suspicious:              totalRT < 1500
                };
                jsPsych.data.dataProperties.trialResponses.push(trialData);
                logToBrowser('linear trial', trialData);

                setTimeout(function() {
                    document.removeEventListener('keydown', onKey);
                    jsPsych.finishTrial();
                }, 700);
            }

            submitBtn.addEventListener('click', doSubmit);
            if (prevBtn) {
                prevBtn.addEventListener('click', function() {
                    document.removeEventListener('keydown', onKey);
                    var responses = jsPsych.data.dataProperties.trialResponses;
                    if (responses.length > 0) responses.pop();
                    jsPsych.data.dataProperties._goBack = true;
                    jsPsych.finishTrial();
                });
            }

            updateSubmitState();
        }
    };
}

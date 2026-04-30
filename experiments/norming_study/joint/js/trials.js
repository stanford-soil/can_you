// ---- geometry ----
var W_TRIAL_SIZE = 460;   // trial grid size (px)
var W_DEMO_SIZE  = 400;   // demo grid size (px)

// snap to nearest integer (0..10) — always lands between figures
function wSnapVal(frac) {
    return Math.max(0, Math.min(10, Math.round(frac * 10)));
}

// quadrant key from figure position (col/row = 0..9) and snap position (floats 0..10)
// a figure center is at col+0.5, row+0.5; it's in the "able" half if center < sx
function wQuadKey(col, row, sx, sy, axisOrder) {
    var figX = col + 0.5, figY = row + 0.5;
    var isAble, isWilling;
    if (axisOrder === 'AW') {
        isAble    = figX < sx;
        isWilling = figY < sy;
    } else {
        isWilling = figX < sx;
        isAble    = figY < sy;
    }
    return (isAble ? 'A' : 'NA') + (isWilling ? 'W' : 'NW');
}

// quadrant counts (sum = 100) from snap values
// nAble = Math.floor(sx) since figure centers are at i+0.5 and i+0.5 < sx iff i < floor(sx)
function wCounts(sx, sy, axisOrder) {
    if (axisOrder === 'AW') {
        var na = Math.floor(sx), nw = Math.floor(sy);
        return { AW: na*nw, ANW: na*(10-nw), NAW: (10-na)*nw, NANW: (10-na)*(10-nw) };
    } else {
        var nw2 = Math.floor(sx), na2 = Math.floor(sy);
        return { AW: nw2*na2, ANW: (10-nw2)*na2, NAW: nw2*(10-na2), NANW: (10-nw2)*(10-na2) };
    }
}

function hexToRgba(hex, a) {
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
}


// ============================================================
// WaffleGrid — vanilla JS component
// Returns a controller object.
// ============================================================
function buildWaffleGridVanilla(parentEl, size, axisOrder, palette, opts) {
    opts = opts || {};
    var snap        = opts.snap !== false;
    var hapticOnSnap= opts.hapticOnSnap !== false;
    var accent      = opts.accent || TOKENS.accent;

    var sx = 5, sy = 5;
    var showCounts    = !!opts.showCounts;
    var hidePills     = !!opts.hidePills;
    var hideAxes      = !!opts.hideAxes;
    var hideCrosshair = !!opts.hideCrosshair;
    var inviteActive  = false;
    var lastSnap      = { sx: 5, sy: 5 };
    var dragging      = false;
    var destroyed     = false;
    var curPalette    = palette;
    var highlightKey  = null; // for demo quadrant highlight overlay
    var figGroups     = [];   // SVG <g> elements

    // public interaction callback (set by demo grid)
    var ctrl = { onInteract: null };

    // ---- build DOM ----
    var wrapper = document.createElement('div');
    wrapper.className = 'wg-wrapper';
    wrapper.dataset.invitePulse = 'false';

    // top label row (includes left offset for y-axis column)
    var topRow = document.createElement('div');
    topRow.className = 'wg-top-labels';
    topRow.style.marginLeft = '138px'; // 124px column + 14px gap
    topRow.style.width = size + 'px';

    var xlblL = document.createElement('div');
    xlblL.className = 'wg-xlbl';
    var xlblR = document.createElement('div');
    xlblR.className = 'wg-xlbl';

    topRow.appendChild(xlblL);
    topRow.appendChild(xlblR);
    wrapper.appendChild(topRow);

    // mid row
    var midRow = document.createElement('div');
    midRow.className = 'wg-mid-row';

    // y-axis column
    var yCol = document.createElement('div');
    yCol.className = 'wg-ylbl-col';
    yCol.style.height = size + 'px';

    var ylblT = document.createElement('div');
    ylblT.className = 'wg-ylbl';
    var ylblB = document.createElement('div');
    ylblB.className = 'wg-ylbl';

    yCol.appendChild(ylblT);
    yCol.appendChild(ylblB);
    midRow.appendChild(yCol);

    // figure area
    var figArea = document.createElement('div');
    figArea.className = 'wg-figure-area';
    figArea.dataset.figureArea = 'true';
    figArea.style.width  = size + 'px';
    figArea.style.height = size + 'px';

    // crosshair lines
    var hLine = document.createElement('div');
    hLine.className = 'wg-h-line';
    var vLine = document.createElement('div');
    vLine.className = 'wg-v-line';

    // knob
    var knob = document.createElement('div');
    knob.className = 'wg-knob';
    knob.dataset.crosshair = 'knob';

    figArea.appendChild(hLine);
    figArea.appendChild(vLine);
    figArea.appendChild(knob);

    // 100 person figures
    var NS = 'http://www.w3.org/2000/svg';
    var cellSize = size / 10;
    var figW = cellSize * 0.55;
    var figH = cellSize * 0.65;

    for (var i = 0; i < 100; i++) {
        var col = i % 10, row = Math.floor(i / 10);
        var cell = document.createElement('div');
        cell.className = 'wg-figure-cell';
        cell.style.left   = (col * cellSize) + 'px';
        cell.style.top    = (row * cellSize) + 'px';
        cell.style.width  = cellSize + 'px';
        cell.style.height = cellSize + 'px';

        // figure rain stagger (only plays if figuresRaining is set)
        var rainDelay = (row * 10 + col) * 14;
        cell.style.animation = 'figureRain 500ms cubic-bezier(.2,.8,.2,1) ' + rainDelay + 'ms both';

        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 12 14');
        svg.setAttribute('width', figW);
        svg.setAttribute('height', figH);

        var g = document.createElementNS(NS, 'g');
        g.style.transition = 'fill 800ms cubic-bezier(.2,.8,.2,1)';

        var head = document.createElementNS(NS, 'circle');
        head.setAttribute('cx','6'); head.setAttribute('cy','3.8'); head.setAttribute('r','3');
        var body = document.createElementNS(NS, 'path');
        body.setAttribute('d','M0,14 Q0,8.5 3,7.5 Q4.2,8 6,8 Q7.8,8 9,7.5 Q12,8.5 12,14Z');

        g.appendChild(head);
        g.appendChild(body);
        svg.appendChild(g);
        cell.appendChild(svg);
        figArea.appendChild(cell);
        figGroups.push({ g: g, col: col, row: row });
    }

    // count pills (4)
    var pills = {};
    var quadLabels = getQuadLabels(axisOrder);
    ['AW','NAW','ANW','NANW'].forEach(function(key) {
        var pill = document.createElement('div');
        pill.className = 'wg-pill';
        pill.dataset.quad = key;
        figArea.appendChild(pill);
        pills[key] = pill;
    });

    // highlight overlay (used by demo)
    var highlightOverlay = document.createElement('div');
    highlightOverlay.style.cssText = 'position:absolute; inset:0; pointer-events:none; z-index:8;';
    figArea.appendChild(highlightOverlay);

    midRow.appendChild(figArea);
    wrapper.appendChild(midRow);
    parentEl.appendChild(wrapper);

    // set axis labels
    var lbl = axisOrder === 'AW'
        ? { xL:'Able', xR:'Not able', yT:'Willing', yB:'Not willing' }
        : { xL:'Willing', xR:'Not willing', yT:'Able', yB:'Not able' };
    xlblL.textContent = lbl.xL;
    xlblR.textContent = lbl.xR;
    ylblT.textContent = lbl.yT;
    ylblB.textContent = lbl.yB;

    // apply initial axis/crosshair visibility
    topRow.style.opacity = hideAxes ? '0' : '1';
    yCol.style.opacity   = hideAxes ? '0' : '1';
    hLine.style.opacity  = hideCrosshair ? '0' : '1';
    vLine.style.opacity  = hideCrosshair ? '0' : '1';
    knob.style.opacity   = hideCrosshair ? '0' : '1';

    // ---- render ----
    function render(skipFigureUpdate) {
        var xPx = (sx / 10) * size;
        var yPx = (sy / 10) * size;

        hLine.style.top  = (yPx - 0.5) + 'px';
        vLine.style.left = (xPx - 0.5) + 'px';
        knob.style.left  = xPx + 'px';
        knob.style.top   = yPx + 'px';

        // tracking labels
        xlblL.style.width  = xPx + 'px';
        xlblR.style.width  = (size - xPx) + 'px';
        ylblT.style.height = yPx + 'px';
        ylblB.style.height = (size - yPx) + 'px';

        var counts = wCounts(sx, sy, axisOrder);

        // pills
        ['AW','NAW','ANW','NANW'].forEach(function(key) {
            var pill = pills[key];
            var n = counts[key];
            var c = curPalette[key];

            // position pill over the figures of that semantic quadrant
            // AW:  x=able(left),    y=willing(top)  → top-left always
            // NANW: x=not-able(right), y=not-willing(bot) → bottom-right always
            // NAW / ANW swap corners depending on which axis is x
            //   AW order: x=able → NAW is top-right, ANW is bottom-left
            //   WA order: x=willing → ANW is top-right, NAW is bottom-left
            var pillX, pillY;
            if (key === 'AW') {
                pillX = xPx / 2;          pillY = yPx / 2;
            } else if (key === 'NANW') {
                pillX = (xPx + size) / 2; pillY = (yPx + size) / 2;
            } else if (key === 'NAW') {
                // not-able side × willing side
                // AW: not-able=right, willing=top → top-right
                // WA: not-able=bottom, willing=left → bottom-left
                if (axisOrder === 'AW') {
                    pillX = (xPx + size) / 2; pillY = yPx / 2;
                } else {
                    pillX = xPx / 2;          pillY = (yPx + size) / 2;
                }
            } else { // ANW
                // able side × not-willing side
                // AW: able=left, not-willing=bottom → bottom-left
                // WA: able=top, not-willing=right → top-right
                if (axisOrder === 'AW') {
                    pillX = xPx / 2;          pillY = (yPx + size) / 2;
                } else {
                    pillX = (xPx + size) / 2; pillY = yPx / 2;
                }
            }
            pill.style.left = pillX + 'px';
            pill.style.top  = pillY + 'px';
            pill.style.borderColor = hexToRgba(c, 0.35);

            if (hidePills) {
                pill.style.display = 'none';
            } else if (showCounts && n > 0) {
                pill.innerHTML = '<span class="wg-pill-n" style="color:' + c + ';">' + n + '</span>'
                               + '<span class="wg-pill-lbl">' + quadLabels[key] + '</span>';
                pill.style.display = '';
            } else if (!showCounts) {
                pill.innerHTML = '<span class="wg-pill-n placeholder">?</span>';
                pill.style.display = '';
            } else {
                pill.style.display = 'none'; // n === 0 and showCounts
            }
        });

        // figure colors
        if (!skipFigureUpdate) {
            figGroups.forEach(function(fig) {
                var qk = wQuadKey(fig.col, fig.row, sx, sy, axisOrder);
                fig.g.style.fill = curPalette[qk];
            });
        }

        // highlight overlay for demo
        renderHighlight(xPx, yPx);
    }

    function renderHighlight(xPx, yPx) {
        if (!highlightKey) {
            highlightOverlay.innerHTML = '';
            return;
        }
        var key = highlightKey;
        var c = curPalette[key];
        // rect for each quadrant depends on which axis is x
        // AW: x=able(left), y=willing(top) → NAW=top-right, ANW=bottom-left
        // WA: x=willing(left), y=able(top) → ANW=top-right, NAW=bottom-left
        var rects = axisOrder === 'AW' ? {
            AW:   { x:0,   y:0,   w:xPx,      h:yPx },
            NAW:  { x:xPx, y:0,   w:size-xPx, h:yPx },
            ANW:  { x:0,   y:yPx, w:xPx,      h:size-yPx },
            NANW: { x:xPx, y:yPx, w:size-xPx, h:size-yPx },
        } : {
            AW:   { x:0,   y:0,   w:xPx,      h:yPx },
            ANW:  { x:xPx, y:0,   w:size-xPx, h:yPx },
            NAW:  { x:0,   y:yPx, w:xPx,      h:size-yPx },
            NANW: { x:xPx, y:yPx, w:size-xPx, h:size-yPx },
        };
        // dim non-active quadrants
        var dimHtml = '';
        ['AW','NAW','ANW','NANW'].forEach(function(k) {
            if (k === key) return;
            var r = rects[k];
            dimHtml += '<div style="position:absolute;left:'+r.x+'px;top:'+r.y+'px;width:'+r.w+'px;height:'+r.h+'px;background:rgba(251,250,247,0.78);pointer-events:none;"></div>';
        });
        // ring around active quad
        var ar = rects[key];
        dimHtml += '<div style="position:absolute;left:'+(ar.x-2)+'px;top:'+(ar.y-2)+'px;width:'+(ar.w+4)+'px;height:'+(ar.h+4)+'px;border:2px solid '+c+';border-radius:4px;pointer-events:none;"></div>';
        highlightOverlay.innerHTML = dimHtml;
    }

    // ---- haptic snap pulse ----
    function triggerSnapPulse() {
        knob.style.animation = 'none';
        knob.offsetWidth; // reflow
        knob.style.animation = 'snapPulse 280ms ease-out';
        // after snap pulse done, if invite was active re-apply it
        if (inviteActive) {
            setTimeout(function() {
                if (inviteActive) wrapper.dataset.invitePulse = 'true';
            }, 300);
        }
    }

    // ---- drag interaction ----
    function handleMove(clientX, clientY) {
        var rect = figArea.getBoundingClientRect();
        var cx = clientX - rect.left;
        var cy = clientY - rect.top;
        var newSx = snap ? wSnapVal(cx / size) : Math.max(0, Math.min(10, (cx / size) * 10));
        var newSy = snap ? wSnapVal(cy / size) : Math.max(0, Math.min(10, (cy / size) * 10));

        if (snap && hapticOnSnap && (newSx !== lastSnap.sx || newSy !== lastSnap.sy)) {
            triggerSnapPulse();
            lastSnap.sx = newSx;
            lastSnap.sy = newSy;
        }
        sx = newSx; sy = newSy;
        render();
        if (ctrl.onChange) ctrl.onChange({ sx: sx, sy: sy, counts: wCounts(sx, sy, axisOrder) });
    }

    function onDown(e) {
        if (destroyed) return;
        dragging = true;
        if (ctrl.onInteract) ctrl.onInteract();
        handleMove(e.clientX, e.clientY);
        e.preventDefault();
    }
    function onMove(e) {
        if (!dragging || destroyed) return;
        handleMove(e.clientX, e.clientY);
    }
    function onTouchMove(e) {
        if (!dragging || destroyed) return;
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
    }
    function onUp() { dragging = false; }

    figArea.addEventListener('mousedown',  onDown);
    figArea.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('mouseup',   onUp);
    document.addEventListener('touchend',  onUp);

    // initial render
    render();

    // ---- controller ----
    ctrl.setPos = function(newSx, newSy) {
        sx = newSx; sy = newSy;
        render();
        if (ctrl.onChange) ctrl.onChange({ sx: sx, sy: sy, counts: wCounts(sx, sy, axisOrder) });
    };
    ctrl.setHideAxes = function(hide) {
        hideAxes = hide;
        topRow.style.opacity = hide ? '0' : '1';
        yCol.style.opacity   = hide ? '0' : '1';
    };
    ctrl.setHideCrosshair = function(hide) {
        hideCrosshair = hide;
        hLine.style.opacity = hide ? '0' : '1';
        vLine.style.opacity = hide ? '0' : '1';
        knob.style.opacity  = hide ? '0' : '1';
    };
    ctrl.setShowCounts = function(show) {
        showCounts = show;
        render(true);
    };
    ctrl.setHidePills = function(hide) {
        hidePills = hide;
        render(true);
    };
    ctrl.setPalette = function(p) {
        curPalette = p;
        render();
    };
    ctrl.setHighlight = function(key) {
        highlightKey = key;
        var xPx = (sx / 10) * size;
        var yPx = (sy / 10) * size;
        renderHighlight(xPx, yPx);
    };
    ctrl.setInviteActive = function(active) {
        inviteActive = active;
        wrapper.dataset.invitePulse = active ? 'true' : 'false';
        if (active) {
            knob.style.animation = ''; // clear snapPulse so invitePulse takes over
            figArea.style.pointerEvents = '';  // unlock when it's their turn
        }
    };
    ctrl.setPointerEvents = function(enabled) {
        figArea.style.pointerEvents = enabled ? '' : 'none';
    };
    ctrl.getFigureAreaEl = function() { return figArea; };
    ctrl.destroy = function() {
        destroyed = true;
        figArea.removeEventListener('mousedown', onDown);
        figArea.removeEventListener('touchstart', onDown);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchend', onUp);
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    };

    return ctrl;
}


// ============================================================
// Trial builder
// ============================================================
function buildWaffleTrial(stimulus, axisOrder, colorMap, trialIndex, jsPsych) {
    var palette = colorMap || PALETTES[PALETTE_NAME];

    // pacing tier-down
    var isFirstFew       = trialIndex <= 2;
    var vignetteGateMs   = isFirstFew ? 3000 : 1800;
    var gridRevealDelay  = isFirstFew ? 3000 : 1200;
    var gridGateMs       = isFirstFew ? 1500 : 600;
    var totalTrials      = N_TRIALS_PER_PARTICIPANT;

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
                <div id="w-grid-section" style="opacity:0; transform:translateY(20px); transition:opacity 500ms ease, transform 500ms cubic-bezier(.2,.8,.2,1); pointer-events:none;">
                    <p class="w-grid-instr">Drag the crosshair to split 100 people into the four groups</p>
                    <div class="w-grid-reveal-wrapper">
                        <div class="w-grid-center" id="w-grid-center">
                            <div id="w-grid-container" style="pointer-events:auto;"></div>
                        </div>
                    </div>
                    <div class="w-grid-actions">
                        <div class="w-grid-spacer">
                            ${trialIndex > 1 ? '<button id="w-prev-btn" class="w-btn-ghost">← Previous</button>' : ''}
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <button id="w-submit-btn" class="w-btn-primary" disabled>Submit</button>
                            <div class="w-btn-hint" id="w-submit-hint">Drag the crosshair to continue</div>
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
            var trialStart         = performance.now();
            var hasInteracted      = false;
            var vignetteGate       = false;
            var gridGate           = false;
            var submitting         = false;
            var firstInteractionRT = null;

            var stimSection  = document.getElementById('w-stimulus-section');
            var gridSection  = document.getElementById('w-grid-section');
            var gridCenter   = document.getElementById('w-grid-center');
            var gridCont     = document.getElementById('w-grid-container');
            var submitBtn    = document.getElementById('w-submit-btn');
            var hintEl       = document.getElementById('w-submit-hint');
            var prevBtn      = document.getElementById('w-prev-btn');

            // build waffle grid
            var grid = buildWaffleGridVanilla(gridCont, W_TRIAL_SIZE, axisOrder, palette, {
                snap: true,
                hapticOnSnap: true,
            });

            var lastResponse = { sx: 5, sy: 5 };
            grid.onChange = function(state) {
                lastResponse = state;
                if (!hasInteracted) {
                    hasInteracted = true;
                    firstInteractionRT = Math.round(performance.now() - trialStart);
                    grid.setShowCounts(true);
                }
                updateSubmitState();
            };

            function updateSubmitState() {
                var canSubmit = hasInteracted && vignetteGate && gridGate && !submitting;
                submitBtn.disabled = !canSubmit;
                if (submitting) {
                    hintEl.style.display = 'none';
                } else if (!hasInteracted) {
                    hintEl.textContent = 'Drag the crosshair to continue';
                    hintEl.style.display = '';
                } else if (!gridGate) {
                    hintEl.textContent = 'Take a moment to look it over';
                    hintEl.style.display = '';
                } else {
                    hintEl.style.display = 'none';
                }
            }

            // vignette gate
            setTimeout(function() {
                vignetteGate = true;
                updateSubmitState();
            }, vignetteGateMs);

            // grid reveal
            setTimeout(function() {
                // slide vignette up (first-few only)
                if (isFirstFew) {
                    stimSection.style.paddingTop = '0px';
                }
                // fade grid in
                gridSection.style.opacity       = '1';
                gridSection.style.transform     = 'translateY(0)';
                gridSection.style.pointerEvents = 'auto';
                // clip-path reveal on the center wrapper
                gridCenter.style.animation = 'gridReveal 600ms cubic-bezier(.2,.8,.2,1) both';
            }, gridRevealDelay);

            // grid gate
            setTimeout(function() {
                gridGate = true;
                updateSubmitState();
            }, gridRevealDelay + gridGateMs);

            // keyboard nav
            function onKey(e) {
                if (e.key === 'Enter' && hasInteracted && vignetteGate && gridGate && !submitting) {
                    doSubmit();
                }
            }
            document.addEventListener('keydown', onKey);

            function doSubmit() {
                if (submitting) return;
                submitting = true;
                var totalRT = Math.round(performance.now() - trialStart);

                // confirmed state
                submitBtn.classList.add('confirmed');
                submitBtn.innerHTML = '<span style="font-size:16px;">✓</span> Recorded';
                submitBtn.disabled = true;
                hintEl.style.display = 'none';
                grid.setPointerEvents(false);

                var counts = wCounts(lastResponse.sx, lastResponse.sy, axisOrder);
                var trialData = {
                    itemID:              stimulus.itemID,
                    actionPhrase:        stimulus.actionPhrase,
                    vignette:            stimulus.vignette,
                    axisOrder:           axisOrder,
                    colorAssignment:     JSON.stringify(colorMap || {}),
                    snapX:               lastResponse.sx,
                    snapY:               lastResponse.sy,
                    nAW:                 counts.AW,
                    nANW:                counts.ANW,
                    nNAW:                counts.NAW,
                    nNANW:               counts.NANW,
                    abilityResponse:     counts.AW + counts.ANW,
                    willingnessResponse: counts.AW + counts.NAW,
                    firstInteractionRT:  firstInteractionRT,
                    trialRT:             totalRT,
                    trialIndex:          trialIndex,
                    suspicious:          totalRT < 1500
                };
                jsPsych.data.dataProperties.trialResponses.push(trialData);
                logToBrowser('waffle trial', trialData);

                setTimeout(function() {
                    document.removeEventListener('keydown', onKey);
                    jsPsych.finishTrial();
                }, 700);
            }

            submitBtn.addEventListener('click', doSubmit);
            if (prevBtn) {
                prevBtn.addEventListener('click', function() {
                    document.removeEventListener('keydown', onKey);
                    // remove last saved trial response (going back)
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

// ---- geometry ----
var W_TRIAL_SIZE = 460;   // trial grid size (px)
var W_DEMO_SIZE  = 400;   // demo grid size (px)

var BC_PAL = {
    AW:   '#1F5572',   // deep ocean    — able + willing
    ANW:  '#5C8FA8',   // shallow water — able, not willing
    NAW:  '#D69A57',   // dune          — not able, willing
    NANW: '#A8A096',   // driftwood     — neither
};

var BC_LBLS = {
    AW:   'able &amp; willing',
    ANW:  'able, not willing',
    NAW:  'willing, not able',
    NANW: 'neither',
};

var NS = 'http://www.w3.org/2000/svg';

function bcSnapVal(frac) {
    return Math.max(0, Math.min(10, Math.round(frac * 10)));
}

// semantic quadrant counts — always in AW/ANW/NAW/NANW terms
// AW: sx=P(able), syL=P(willing|able), syR=P(willing|notAble)
// WA: sx=P(willing), syL=P(able|willing), syR=P(able|notWilling)
function bcCounts(sx, syL, syR, axisOrder) {
    var n1 = Math.floor(sx), n2L = Math.floor(syL), n2R = Math.floor(syR);
    if (axisOrder === 'AW') {
        return {
            AW:   n1 * n2L,
            ANW:  n1 * (10 - n2L),
            NAW:  (10 - n1) * n2R,
            NANW: (10 - n1) * (10 - n2R),
        };
    } else {
        // sx=willing cols, syL=able rows in willing half, syR=able rows in not-willing half
        var nw = n1, aL = n2L, aR = n2R;
        return {
            AW:   nw * aL,
            ANW:  (10 - nw) * aR,
            NAW:  nw * (10 - aL),
            NANW: (10 - nw) * (10 - aR),
        };
    }
}

function hexToRgba(hex, a) {
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
}

// axis-specific config (text labels, colors, figure-fill logic)
function getBCConfig(axisOrder, pal) {
    if (axisOrder === 'AW') {
        return {
            q1Html: 'How many of these 100 people would be <strong style="font-style:normal;color:'+pal.ANW+';">able</strong> to do this?',
            q2Html: 'Of those who are able, how many would be <strong style="font-style:normal;color:'+pal.AW+';">willing</strong>?',
            q3Html: 'Of those who are <em>not</em> able, how many would be <strong style="font-style:normal;color:'+pal.NAW+';">willing</strong>?',
            stg1LeftColor:  pal.ANW,
            stg1RightColor: pal.NANW,
            stg1LeftLabel:  'able',
            stg1RightLabel: 'not able',
            knobRColor: pal.NAW,
            getFill: function(col, row, sx, syL, syR, stage) {
                var na = Math.floor(sx), wL = Math.floor(syL), wR = Math.floor(syR);
                var able = col < na;
                if (stage === 1) return able ? pal.ANW : pal.NANW;
                if (stage === 2) return able ? (row < wL ? pal.AW : pal.ANW) : pal.NANW;
                return pal[(able ? 'A' : 'NA') + ((able ? row < wL : row < wR) ? 'W' : 'NW')];
            },
            leftTopKey: 'AW', leftBotKey: 'ANW',
            rightTopKey: 'NAW', rightBotKey: 'NANW',
        };
    } else {
        return {
            q1Html: 'How many of these 100 people would be <strong style="font-style:normal;color:'+pal.NAW+';">willing</strong> to do this?',
            q2Html: 'Of those who are willing, how many would be <strong style="font-style:normal;color:'+pal.AW+';">able</strong>?',
            q3Html: 'Of those who are <em>not</em> willing, how many would be <strong style="font-style:normal;color:'+pal.ANW+';">able</strong>?',
            stg1LeftColor:  pal.NAW,
            stg1RightColor: pal.NANW,
            stg1LeftLabel:  'willing',
            stg1RightLabel: 'not willing',
            knobRColor: pal.ANW,
            getFill: function(col, row, sx, syL, syR, stage) {
                var nw = Math.floor(sx), aL = Math.floor(syL), aR = Math.floor(syR);
                var willing = col < nw;
                if (stage === 1) return willing ? pal.NAW : pal.NANW;
                if (stage === 2) return willing ? (row < aL ? pal.AW : pal.NAW) : pal.NANW;
                if (willing) return row < aL ? pal.AW : pal.NAW;
                return row < aR ? pal.ANW : pal.NANW;
            },
            leftTopKey: 'AW', leftBotKey: 'NAW',
            rightTopKey: 'ANW', rightBotKey: 'NANW',
        };
    }
}


// ============================================================
// BentCrosshairGrid — vanilla JS component
// opts: { hidePanels, figuresRaining }
// ============================================================
function buildBentCrosshairGrid(parentEl, size, axisOrder, palette, opts) {
    opts = opts || {};
    var pal = palette || BC_PAL;
    var cfg = getBCConfig(axisOrder, pal);
    var PANEL_W  = opts.panelWidth !== undefined ? opts.panelWidth : 240;
    var CELL     = size / 10;
    var FIG_W    = CELL * 0.56;
    var FIG_H    = CELL * 0.66;
    var V_ZONE   = 30;  // px within v-line for priority grab

    var sx = 5, syL = 5, syR = 5;
    var stage = 1;
    var dragging = null;
    var destroyed = false;
    var hasInteractedL  = false;
    var hasInteractedR  = false;
    var rightNeeded     = true;   // false if sx===10 when v-line released
    var leftNeeded      = true;   // false if sx===0  when v-line released
    var isComplete      = false;
    var firstInteractRT = null;
    var stage2RT = null, stage3RT = null;
    var trialStartT = performance.now();

    var ctrl = {};

    // ---- wrapper ----
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center; user-select:none; -webkit-user-select:none;';

    // q1 above flex row
    var q1El = document.createElement('div');
    q1El.style.cssText = 'font-family:var(--serif); font-size:15px; color:var(--muted); font-style:italic; width:'+size+'px; text-align:center; margin-bottom:12px; line-height:1.5;';
    q1El.innerHTML = cfg.q1Html;
    wrapper.appendChild(q1El);

    // flex row
    var flexRow = document.createElement('div');
    flexRow.style.cssText = 'display:flex; align-items:stretch; justify-content:center;';

    // left panel
    var leftPanel = document.createElement('div');
    leftPanel.style.cssText = 'width:'+PANEL_W+'px; flex-shrink:0; opacity:0; transition:opacity 500ms ease; padding-right:14px; box-sizing:border-box;'
        + (opts.hidePanels ? 'display:none;' : '');
    var leftInner = document.createElement('div');
    leftInner.style.cssText = 'position:relative; height:'+size+'px;';
    var q2El = document.createElement('div');
    q2El.style.cssText = 'position:absolute; left:0; right:0; transform:translateY(-50%); font-family:var(--serif); font-size:13px; color:var(--muted); font-style:italic; text-align:right; line-height:1.5; top:50%;';
    q2El.innerHTML = cfg.q2Html;
    leftInner.appendChild(q2El);
    leftPanel.appendChild(leftInner);

    // right panel
    var rightPanel = document.createElement('div');
    rightPanel.style.cssText = 'width:'+PANEL_W+'px; flex-shrink:0; opacity:0; transition:opacity 500ms ease; padding-left:14px; box-sizing:border-box;'
        + (opts.hidePanels ? 'display:none;' : '');
    var rightInner = document.createElement('div');
    rightInner.style.cssText = 'position:relative; height:'+size+'px;';
    var q3El = document.createElement('div');
    q3El.style.cssText = 'position:absolute; left:0; right:0; transform:translateY(-50%); font-family:var(--serif); font-size:13px; color:var(--muted); font-style:italic; text-align:left; line-height:1.5; top:50%;';
    q3El.innerHTML = cfg.q3Html;
    rightInner.appendChild(q3El);
    rightPanel.appendChild(rightInner);

    // figure area
    var area = document.createElement('div');
    area.className = 'fig-area';
    area.style.width  = size + 'px';
    area.style.height = size + 'px';
    area.style.cursor = 'ew-resize';

    // crosshair lines
    var vl = document.createElement('div'); vl.className = 'ch-v';
    var hl = document.createElement('div'); hl.className = 'ch-hl';
    var hr = document.createElement('div'); hr.className = 'ch-hr';
    hl.style.opacity = '0'; hl.style.transition = 'opacity 500ms ease';
    hr.style.opacity = '0'; hr.style.transition = 'opacity 500ms ease';
    area.appendChild(vl); area.appendChild(hl); area.appendChild(hr);

    // knobs
    var knobV = document.createElement('div'); knobV.className = 'ch-knob';
    var knobL = document.createElement('div'); knobL.className = 'ch-knob';
    knobL.style.borderColor = pal.AW;
    knobL.style.opacity = '0'; knobL.style.transition = 'opacity 500ms ease';
    var knobR = document.createElement('div'); knobR.className = 'ch-knob';
    knobR.style.borderColor = cfg.knobRColor;
    knobR.style.opacity = '0'; knobR.style.transition = 'opacity 500ms ease';
    area.appendChild(knobV); area.appendChild(knobL); area.appendChild(knobR);

    // 100 figures
    var figs = [];
    for (var i = 0; i < 100; i++) {
        var col = i % 10, row = Math.floor(i / 10);
        var cell = document.createElement('div');
        cell.className = 'fig-cell';
        cell.style.left   = (col * CELL) + 'px';
        cell.style.top    = (row * CELL) + 'px';
        cell.style.width  = CELL + 'px';
        cell.style.height = CELL + 'px';
        if (opts.figuresRaining) {
            var rainDelay = (row * 10 + col) * 14;
            cell.style.animation = 'figureRain 500ms cubic-bezier(.2,.8,.2,1) ' + rainDelay + 'ms both';
        }
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 12 14');
        svg.setAttribute('width', FIG_W);
        svg.setAttribute('height', FIG_H);
        var g = document.createElementNS(NS, 'g');
        g.style.fill = pal.NANW;
        g.style.transition = 'fill 180ms ease';
        var head = document.createElementNS(NS, 'circle');
        head.setAttribute('cx','6'); head.setAttribute('cy','3.8'); head.setAttribute('r','3');
        var body = document.createElementNS(NS, 'path');
        body.setAttribute('d','M0,14 Q0,8.5 3,7.5 Q4.2,8 6,8 Q7.8,8 9,7.5 Q12,8.5 12,14Z');
        g.appendChild(head); g.appendChild(body); svg.appendChild(g);
        cell.appendChild(svg); area.appendChild(cell);
        figs.push({ g: g, col: col, row: row });
    }

    // marginal pills (stage 1)
    var pLeft  = document.createElement('div'); pLeft.className  = 'pill'; area.appendChild(pLeft);
    var pRight = document.createElement('div'); pRight.className = 'pill'; area.appendChild(pRight);

    // quadrant pills (stages 2–3)
    var qpills = {};
    ['AW','ANW','NAW','NANW'].forEach(function(k) {
        var p = document.createElement('div'); p.className = 'pill'; area.appendChild(p);
        qpills[k] = p;
    });

    flexRow.appendChild(leftPanel);
    flexRow.appendChild(area);
    flexRow.appendChild(rightPanel);
    wrapper.appendChild(flexRow);
    parentEl.appendChild(wrapper);

    // ---- render ----
    function render() {
        var xPx  = sx  / 10 * size;
        var yLPx = syL / 10 * size;
        var yRPx = syR / 10 * size;
        var n1   = Math.floor(sx);
        var counts = bcCounts(sx, syL, syR, axisOrder);

        // lines
        vl.style.left  = xPx + 'px';
        hl.style.width = xPx + 'px';
        hl.style.top   = (yLPx - 0.5) + 'px';
        hr.style.width = (size - xPx) + 'px';
        hr.style.top   = (yRPx - 0.5) + 'px';

        // knobs
        knobV.style.left = xPx + 'px';            knobV.style.top = (size / 2) + 'px';
        knobL.style.left = (xPx / 2) + 'px';      knobL.style.top = yLPx + 'px';
        knobR.style.left = ((xPx + size) / 2) + 'px'; knobR.style.top = yRPx + 'px';

        // floating q text tracks h-line positions
        q2El.style.top = yLPx + 'px';
        q3El.style.top = yRPx + 'px';

        // figure colors
        figs.forEach(function(f) {
            f.g.style.fill = cfg.getFill(f.col, f.row, sx, syL, syR, stage);
        });

        // hide left elements when no left group; hide right elements when no right group
        if (stage >= 2) {
            var leftVis = sx > 0 ? '1' : '0';
            hl.style.opacity         = leftVis;
            knobL.style.opacity      = leftVis;
            leftPanel.style.opacity  = leftVis;
        }
        if (stage >= 3) {
            var rightVis = sx < 10 ? '1' : '0';
            hr.style.opacity         = rightVis;
            knobR.style.opacity      = rightVis;
            rightPanel.style.opacity = rightVis;
        }

        // marginal pills — positions always update so they track v-line
        pLeft.style.left  = (xPx / 2) + 'px';
        pLeft.style.top   = (size / 2) + 'px';
        pRight.style.left = ((xPx + size) / 2) + 'px';
        pRight.style.top  = (size / 2) + 'px';
        pLeft.style.display  = stage === 1 ? '' : 'none';
        pRight.style.display = stage <= 2  ? '' : 'none';

        if (stage === 1) {
            pLeft.innerHTML  = '<span class="pill-n" style="color:'+cfg.stg1LeftColor+';">' +(n1*10)+'</span><span class="pill-lbl">'+cfg.stg1LeftLabel+'</span>';
            pRight.innerHTML = '<span class="pill-n" style="color:'+cfg.stg1RightColor+';">'+(10-n1)*10+'</span><span class="pill-lbl">'+cfg.stg1RightLabel+'</span>';
        }
        if (stage === 2) {
            pRight.innerHTML = '<span class="pill-n" style="color:'+cfg.stg1RightColor+';">'+(10-n1)*10+'</span><span class="pill-lbl">'+cfg.stg1RightLabel+'</span>';
        }

        // quadrant pills
        var ltk = cfg.leftTopKey, lbk = cfg.leftBotKey;
        var rtk = cfg.rightTopKey, rbk = cfg.rightBotKey;

        qpills[ltk].style.display = stage >= 2 ? '' : 'none';
        qpills[lbk].style.display = stage >= 2 ? '' : 'none';
        qpills[rtk].style.display = stage >= 3 ? '' : 'none';
        qpills[rbk].style.display = stage >= 3 ? '' : 'none';

        if (stage >= 2) {
            qpills[ltk].style.left = (xPx / 2) + 'px';
            qpills[ltk].style.top  = (yLPx / 2) + 'px';
            qpills[ltk].innerHTML  = '<span class="pill-n" style="color:'+pal[ltk]+';">'+counts[ltk]+'</span><span class="pill-lbl">'+BC_LBLS[ltk]+'</span>';
            qpills[lbk].style.left = (xPx / 2) + 'px';
            qpills[lbk].style.top  = ((yLPx + size) / 2) + 'px';
            qpills[lbk].innerHTML  = '<span class="pill-n" style="color:'+pal[lbk]+';">'+counts[lbk]+'</span><span class="pill-lbl">'+BC_LBLS[lbk]+'</span>';
        }
        if (stage >= 3) {
            qpills[rtk].style.left = ((xPx + size) / 2) + 'px';
            qpills[rtk].style.top  = (yRPx / 2) + 'px';
            qpills[rtk].innerHTML  = '<span class="pill-n" style="color:'+pal[rtk]+';">'+counts[rtk]+'</span><span class="pill-lbl">'+BC_LBLS[rtk]+'</span>';
            qpills[rbk].style.left = ((xPx + size) / 2) + 'px';
            qpills[rbk].style.top  = ((yRPx + size) / 2) + 'px';
            qpills[rbk].innerHTML  = '<span class="pill-n" style="color:'+pal[rbk]+';">'+counts[rbk]+'</span><span class="pill-lbl">'+BC_LBLS[rbk]+'</span>';

        }
    }

    // ---- stage advance ----
    function advanceStage() {
        if (stage === 1) {
            stage = 2;
            hl.style.opacity = '1'; knobL.style.opacity = '1';
            leftPanel.style.opacity = '1';
            area.style.cursor = 'crosshair';
            if (stage2RT === null) stage2RT = Math.round(performance.now() - trialStartT);
        } else if (stage === 2) {
            stage = 3;
            hr.style.opacity = '1'; knobR.style.opacity = '1';
            rightPanel.style.opacity = '1';
            if (stage3RT === null) stage3RT = Math.round(performance.now() - trialStartT);
        }
        updateIsComplete();
        render();
        if (ctrl.onStageAdvance) ctrl.onStageAdvance(stage);
    }

    function updateIsComplete() {
        if (stage < 3) { isComplete = false; return; }
        var noLeft  = sx === 0;
        var noRight = sx === 10;
        if (noLeft)  { isComplete = hasInteractedR; return; }
        if (noRight) { isComplete = hasInteractedL; return; }
        isComplete = hasInteractedL && hasInteractedR;
    }

    // ---- drag ----
    function mv(cx, cy, r) {
        if (!r) r = area.getBoundingClientRect();
        var lx = (cx - r.left) / size;
        var ly = (cy - r.top)  / size;
        if (dragging === 'v') {
            sx = bcSnapVal(lx);
            if (stage === 2 && sx === 0) advanceStage(); // no left group, auto-advance to show right
        } else if (dragging === 'L') { syL = bcSnapVal(ly); hasInteractedL = true; }
        else if (dragging === 'R') { syR = bcSnapVal(ly); hasInteractedR = true; }
        updateIsComplete();
        render();
        if (ctrl.onChange) ctrl.onChange({ sx:sx, syL:syL, syR:syR, stage:stage, hasInteractedR:hasInteractedR, isComplete:isComplete });
    }

    function pickDragTarget(clientX, r) {
        var lx = clientX - r.left;
        var xPx = sx / 10 * size;
        if (stage === 1)      return 'v';
        if (stage === 2)      return Math.abs(lx - xPx) < V_ZONE ? 'v' : 'L';
        return Math.abs(lx - xPx) < V_ZONE ? 'v' : (lx < xPx ? 'L' : 'R');
    }

    // ---- smooth animation ----
    var _animCancel = null;

    function onDown(e) {
        if (destroyed) return;
        if (_animCancel) { _animCancel(); }   // cancel any running animation
        var r = area.getBoundingClientRect();
        var clientX = e.touches ? e.touches[0].clientX : e.clientX;
        var clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragging = pickDragTarget(clientX, r);
        area.style.cursor = dragging === 'v' ? 'ew-resize' : 'ns-resize';
        if (firstInteractRT === null) firstInteractRT = Math.round(performance.now() - trialStartT);
        if (ctrl.onInteract) ctrl.onInteract();
        mv(clientX, clientY, r);
        e.preventDefault();
    }
    function onMove(e) {
        if (!dragging || destroyed) return;
        mv(e.clientX, e.clientY);
    }
    function onTouchMove(e) {
        if (!dragging || destroyed) return;
        mv(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
    }
    function onUp() {
        if (!dragging) return;
        var prev = dragging;
        dragging = null;
        if (stage === 1 && prev === 'v') {
            if (sx === 0) {
                // no left group — jump straight to stage 3, show right panel
                stage = 3;
                if (stage2RT === null) stage2RT = Math.round(performance.now() - trialStartT);
                if (stage3RT === null) stage3RT = Math.round(performance.now() - trialStartT);
                hr.style.opacity = '1'; knobR.style.opacity = '1';
                rightPanel.style.opacity = '1';
                area.style.cursor = 'ns-resize';
                updateIsComplete();
                render();
                if (ctrl.onStageAdvance) ctrl.onStageAdvance(3);
            } else {
                advanceStage(); // sx=10 or normal → stage 2; render() hides right panel if sx=10
            }
        } else if (stage === 2 && prev === 'L') {
            advanceStage(); // → stage 3; render() hides right panel if sx=10
        }
        if (stage === 1) area.style.cursor = 'ew-resize';
    }
    function onAreaMove(e) {
        if (dragging || destroyed || stage < 2) return;
        var r = area.getBoundingClientRect();
        var xPx = sx / 10 * size;
        area.style.cursor = Math.abs(e.clientX - r.left - xPx) < V_ZONE ? 'ew-resize' : 'ns-resize';
    }

    area.addEventListener('mousedown',  onDown);
    area.addEventListener('touchstart', onDown, { passive: false });
    area.addEventListener('mousemove',  onAreaMove);
    document.addEventListener('mousemove',  onMove);
    document.addEventListener('touchmove',  onTouchMove, { passive: false });
    document.addEventListener('mouseup',    onUp);
    document.addEventListener('touchend',   onUp);

    render();

    // ---- controller ----
    ctrl.setPos = function(newSx, newSyL, newSyR) {
        if (newSx  !== undefined) sx  = newSx;
        if (newSyL !== undefined) syL = newSyL;
        if (newSyR !== undefined) syR = newSyR;
        render();
    };
    ctrl.animateTo = function(targetSx, targetSyL, targetSyR, durationMs, onDone) {
        if (_animCancel) { _animCancel(); }
        var cancelled = false;
        _animCancel = function() { cancelled = true; _animCancel = null; };
        var startSx = sx, startSyL = syL, startSyR = syR, startT = null;
        function frame(now) {
            if (cancelled || destroyed) return;
            if (startT === null) startT = now;
            var t = Math.min(1, (now - startT) / durationMs);
            // ease-in-out cubic
            var e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
            sx  = startSx  + (targetSx  - startSx)  * e;
            syL = startSyL + (targetSyL - startSyL) * e;
            syR = startSyR + (targetSyR - startSyR) * e;
            render();
            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                sx = targetSx; syL = targetSyL; syR = targetSyR;
                render();
                _animCancel = null;
                if (onDone) onDone();
            }
        }
        requestAnimationFrame(frame);
    };
    ctrl.cancelAnimations = function() {
        if (_animCancel) { _animCancel(); }
    };
    ctrl.advanceToStage = function(n) {
        while (stage < n) advanceStage();
    };
    ctrl.getStage = function() { return stage; };
    ctrl.setPointerEvents = function(enabled) {
        area.style.pointerEvents = enabled ? '' : 'none';
    };
    ctrl.setInviteActive = function(active) {
        if (active) knobV.classList.add('ch-knob--invite');
        else        knobV.classList.remove('ch-knob--invite');
    };
    ctrl.showLeftPanel = function() {
        leftPanel.style.opacity = '1';
        q2El.style.transition = 'color 300ms ease';
        q2El.style.color = '#1F5572';
        setTimeout(function() {
            q2El.style.transition = 'color 900ms ease';
            q2El.style.color = '#6E665C';
        }, 1600);
    };
    ctrl.showRightPanel = function() {
        rightPanel.style.opacity = '1';
        q3El.style.transition = 'color 300ms ease';
        q3El.style.color = '#1F5572';
        setTimeout(function() {
            q3El.style.transition = 'color 900ms ease';
            q3El.style.color = '#6E665C';
        }, 1600);
    };
    ctrl.getState = function() {
        return { sx:sx, syL:syL, syR:syR, stage:stage, hasInteractedR:hasInteractedR, isComplete:isComplete, rightNeeded:rightNeeded, leftNeeded:leftNeeded };
    };
    ctrl.getCounts = function() { return bcCounts(sx, syL, syR, axisOrder); };
    ctrl.getTimings = function() {
        return { firstInteractRT:firstInteractRT, stage2RT:stage2RT, stage3RT:stage3RT };
    };
    ctrl.getWrapperEl = function() { return wrapper; };
    ctrl.destroy = function() {
        destroyed = true;
        area.removeEventListener('mousedown',  onDown);
        area.removeEventListener('touchstart', onDown);
        area.removeEventListener('mousemove',  onAreaMove);
        document.removeEventListener('mousemove',  onMove);
        document.removeEventListener('touchmove',  onTouchMove);
        document.removeEventListener('mouseup',    onUp);
        document.removeEventListener('touchend',   onUp);
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    };

    return ctrl;
}


// ============================================================
// Trial builder
// ============================================================
var PRACTICE_STIMULUS = {
    itemID:       'practice',
    actionPhrase: 'pass the salt',
    vignette:     'You\'re sitting at the dinner table with your family. Your mom looks over at you and asks:',
};

function buildBentCrosshairTrial(stimulus, axisOrder, colorMap, trialIndex, jsPsych) {
    var palette    = colorMap || BC_PAL;
    var isPractice = trialIndex === 0;
    var totalTrials = N_TRIALS_PER_PARTICIPANT;
    var pct = isPractice ? 0 : Math.round(((trialIndex - 1) / totalTrials) * 100);

    // pacing
    var isFirstFew      = !isPractice && trialIndex <= 2;
    var vignetteGateMs  = isPractice ? 2000 : (isFirstFew ? 3000 : 1800);
    var gridRevealDelay = isPractice ? 2000 : (isFirstFew ? 3000 : 1200);
    var gridGateMs      = isPractice ? 1000 : (isFirstFew ? 2000 : 800);

    var progressHTML = isPractice
        ? '<div class="w-practice-badge">Practice Trial</div>'
        : `<div class="w-progress-strip">
            <div class="w-progress-row">
                <span class="w-progress-label">Scenario ${trialIndex} of ${totalTrials}</span>
                <span class="w-progress-pct">${pct}%</span>
            </div>
            <div class="w-progress-track">
                <div class="w-progress-fill" id="w-prog-fill" style="width:${pct}%;"></div>
            </div>
           </div>`;

    var html = `
        <div class="w-scene">
            ${getSectionTickerHTML(isPractice ? 'instructions' : 'study')}
            ${progressHTML}
            <div class="w-card" id="w-trial-card">
                <div id="w-stimulus-section" style="${isFirstFew ? 'padding-top:80px;' : ''} transition:${isFirstFew ? 'padding-top 700ms cubic-bezier(.22,.8,.28,1)' : 'none'};">
                    <p class="w-vignette">${stimulus.vignette}</p>
                    <p class="w-question">"Can you ${stimulus.actionPhrase}?"</p>
                </div>
                <div id="w-grid-section" style="opacity:0; transform:translateY(20px); transition:opacity 500ms ease, transform 500ms cubic-bezier(.2,.8,.2,1); pointer-events:none;">
                    <div class="w-grid-reveal-wrapper">
                        <div class="w-grid-center" id="w-grid-center">
                            <div id="w-grid-container" style="pointer-events:auto;"></div>
                        </div>
                    </div>
                    <div class="w-grid-actions">
                        <div class="w-grid-spacer">
                            ${(!isPractice && trialIndex > 1) ? '<button id="w-prev-btn" class="w-btn-ghost">← Previous</button>' : ''}
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <button id="w-submit-btn" class="w-btn-primary" disabled>${isPractice ? 'Continue →' : 'Submit'}</button>
                            <div class="w-btn-hint" id="w-submit-hint">Drag the vertical line to start</div>
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
            var vignetteGate      = false;
            var gridGate          = false;
            var submitting        = false;

            var stimSection  = document.getElementById('w-stimulus-section');
            var gridSection  = document.getElementById('w-grid-section');
            var gridCenter   = document.getElementById('w-grid-center');
            var gridCont     = document.getElementById('w-grid-container');
            var submitBtn    = document.getElementById('w-submit-btn');
            var hintEl       = document.getElementById('w-submit-hint');
            var prevBtn      = document.getElementById('w-prev-btn');

            // build bent crosshair grid
            var grid = buildBentCrosshairGrid(gridCont, W_TRIAL_SIZE, axisOrder, palette, {
                panelWidth: 240,
            });

            grid.onChange = function(state) {
                updateHint(state.stage);
                updateSubmitState(state);
            };

            function updateHint(stg) {
                if (submitting) { hintEl.style.display = 'none'; return; }
                var state = grid.getState();
                if (state.isComplete) { hintEl.style.display = 'none'; return; }
                if (stg === 1)         hintEl.textContent = 'Drag the vertical line to start';
                else if (stg === 2)    hintEl.textContent = 'Now adjust the left line';
                else if (stg === 3)    hintEl.textContent = state.sx === 10 ? 'Adjust the left line to set your answer' : 'Now adjust the right line';
                hintEl.style.display = '';
            }

            function updateSubmitState(state) {
                state = state || grid.getState();
                var allDone = state.isComplete;
                var canSubmit = allDone && vignetteGate && gridGate && !submitting;
                submitBtn.disabled = !canSubmit;
                if (submitting || (allDone && vignetteGate && gridGate)) {
                    hintEl.style.display = 'none';
                }
            }

            grid.onStageAdvance = function(stage) {
                updateHint(stage);
                updateSubmitState();
            };

            // vignette gate
            setTimeout(function() {
                vignetteGate = true;
                updateSubmitState();
            }, vignetteGateMs);

            // grid reveal
            setTimeout(function() {
                if (isFirstFew) stimSection.style.paddingTop = '0px';
                gridSection.style.opacity       = '1';
                gridSection.style.transform     = 'translateY(0)';
                gridSection.style.pointerEvents = 'auto';
                gridCenter.style.animation = 'gridReveal 600ms cubic-bezier(.2,.8,.2,1) both';
            }, gridRevealDelay);

            // grid gate
            setTimeout(function() {
                gridGate = true;
                updateSubmitState();
            }, gridRevealDelay + gridGateMs);

            function onKey(e) {
                var state = grid.getState();
                if (e.key === 'Enter' && state.isComplete && vignetteGate && gridGate && !submitting) {
                    doSubmit();
                }
            }
            document.addEventListener('keydown', onKey);

            function doSubmit() {
                if (submitting) return;
                submitting = true;
                var totalRT = Math.round(performance.now() - trialStart);

                submitBtn.classList.add('confirmed');
                submitBtn.innerHTML = '<span style="font-size:16px;">✓</span> ' + (isPractice ? 'Done' : 'Recorded');
                submitBtn.disabled = true;
                hintEl.style.display = 'none';
                grid.setPointerEvents(false);

                var state   = grid.getState();
                var counts  = grid.getCounts();
                var timings = grid.getTimings();

                var trialData = {
                    itemID:                      stimulus.itemID,
                    actionPhrase:                stimulus.actionPhrase,
                    vignette:                    stimulus.vignette,
                    axisOrder:                   axisOrder,
                    isPractice:                  isPractice ? 1 : 0,
                    trialIndex:                  trialIndex,
                    // 3-DOF raw values
                    sx:                          state.sx,
                    syL:                         state.syL,
                    syR:                         state.syR,
                    // semantic quadrant counts
                    able_willing_count:          counts.AW,
                    able_not_willing_count:      counts.ANW,
                    not_able_willing_count:      counts.NAW,
                    not_able_not_willing_count:  counts.NANW,
                    total:                       100,
                    // derived
                    abilityResponse:             counts.AW + counts.ANW,
                    willingnessResponse:         counts.AW + counts.NAW,
                    // timing
                    firstInteractionRT:          timings.firstInteractRT,
                    stage2RT:                    timings.stage2RT,
                    stage3RT:                    timings.stage3RT,
                    trialRT:                     totalRT,
                    suspicious:                  totalRT < 2000,
                };

                jsPsych.data.dataProperties.trialResponses.push(trialData);
                logToBrowser('bent crosshair trial', trialData);

                setTimeout(function() {
                    document.removeEventListener('keydown', onKey);
                    grid.destroy();
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
                    grid.destroy();
                    jsPsych.finishTrial();
                });
            }

            updateHint(1);
        }
    };
}

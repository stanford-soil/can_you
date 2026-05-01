// ---- study config ----
var IS_TESTING   = true;         // true = dev mode: panel visible, protections off
var TESTING_MODE = IS_TESTING;   // alias used by main.js (applyProductionProtections gate)

const experimentIdOSF       = 'H9cxh2VA14kV';
const prolificCompletionURL = 'https://app.prolific.com/submissions/complete?cc=CEPHL0CF';
const TEST    = false;           // true = prefix saves w/ DEBUG_
const VERBOSE = false;
const SEED    = null;

const N_ITEMS                 = 153;   // total items in stimulus set
const N_TRIALS_PER_PARTICIPANT = 30;   // how many each participant sees
const N_ATTENTION_CHECKS      = 2;
const ESTIMATED_DURATION_MIN  = 15;   // TODO: update after pilot
const PAYMENT                 = 2.50; // TODO: update after pilot ($)

const LAB_NAME      = "Social Interaction Lab";
const PI_NAME       = "Robert Hawkins";
const CONTACT_EMAIL = "mokeeffe@stanford.edu";
const INSTITUTION   = "Stanford University";
const LAB_LOGO      = "🌱";
const STUDY_TITLE   = "Thinking About What People Do";

const IDLE_TIMEOUT_MS  = 5 * 60 * 1000;  // 5 min inactivity → session timeout
const ATTN_TARGET_POOL = [14, 22, 31, 43, 57, 68, 79, 86];  // avoids 50 (default slider pos)

// ---- grid viz config ----
const PALETTE_NAME = 'coastal';
const VIZ_MODE     = 'figures';

const PALETTES = {
    coastal: {
        AW:   '#1F5572',  // deep ocean    — able + willing
        NAW:  '#D69A57',  // dune          — not able, willing
        ANW:  '#5C8FA8',  // shallow water — able, not willing
        NANW: '#A8A096',  // driftwood     — neither
    },
    ink: {
        AW:   '#2A2A2A',
        NAW:  '#8A6A4A',
        ANW:  '#4A6680',
        NANW: '#B5AC9F',
    },
    mineral: {
        AW:   '#506D7A',
        NAW:  '#A88566',
        ANW:  '#7A8B7E',
        NANW: '#B0A89E',
    },
};

// design tokens — mirrored in CSS :root vars
const TOKENS = {
    bg:           '#FBFAF7',
    card:         '#FFFFFF',
    ink:          '#1F1A14',
    muted:        '#6E665C',
    faint:        '#A89E91',
    hairline:     '#E8E2D5',
    accent:       '#1F5572',
    accentBg:     'rgba(31,85,114,0.08)',
    successGreen: '#2E7D5B',
    serif:        "'Source Serif 4', 'Source Serif Pro', Georgia, serif",
    sans:         "'Inter', system-ui, sans-serif",
    mono:         "'JetBrains Mono', monospace",
};

// ---- dev panel (IS_TESTING only) ----
// sections: [{ label, index }] where index is the timeline slice position
function initDevPanel(sections) {
    if (!IS_TESTING) return;

    // allow free navigation without the "don't leave" prompt
    window.onbeforeunload = null;

    var params = new URLSearchParams(window.location.search);
    var curSkip = params.get('skip') || '0';

    var panel = document.createElement('div');
    panel.id = 'w-dev-panel';

    var lbl = document.createElement('span');
    lbl.className = 'w-dev-label';
    lbl.textContent = 'DEV';

    var divider = document.createElement('div');
    divider.className = 'w-dev-divider';

    var select = document.createElement('select');
    select.className = 'w-dev-select';
    sections.forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = String(s.index);
        opt.textContent = s.label;
        if (String(s.index) === curSkip) opt.selected = true;
        select.appendChild(opt);
    });

    var btn = document.createElement('button');
    btn.className = 'w-dev-go';
    btn.textContent = 'Jump';
    btn.addEventListener('click', function() {
        var p = new URLSearchParams(window.location.search);
        p.set('skip', select.value);
        // keep axis param if present (for linear)
        window.location.href = window.location.pathname + '?' + p.toString();
    });

    panel.appendChild(lbl);
    panel.appendChild(divider);
    panel.appendChild(select);
    panel.appendChild(btn);
    document.body.appendChild(panel);
}

// pill label text per semantic quadrant (fixed regardless of axis order)
function getQuadLabels(axisOrder) {
    return {
        AW:   'able and willing',
        ANW:  'able, not willing',
        NAW:  'willing, not able',
        NANW: 'not able or willing',
    };
}

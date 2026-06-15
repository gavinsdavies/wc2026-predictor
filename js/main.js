// js/main.js — orchestrator / app state.
// Imports all logic modules and drives the UI renders.

import {
  loadData,
  STAGE_ORDER,
  GROUPS,
} from './data.js';

import {
  dayKey,
  dayHeading,
  kickoffText,
  getTZMode,
  setTZMode,
  TZ_OPTIONS,
} from './timezone.js';

import {
  getPrediction,
  setPrediction,
  clearPredictions,
  getOverrides,
  setOverride,
  clearOverrides,
  clearOverridesMatchingActual,
  effectiveActual,
  exportJSON,
  importJSON,
} from './predictions.js';

import { allGroupTables } from './standings.js';
import { buildBracket } from './bracket.js';
import { scoreMatch, tallyAll, POINTS } from './scoring.js';

import { renderFixtures } from './ui/fixtures.js';
import { renderTables } from './ui/tables.js';
import { renderBracket } from './ui/bracketview.js';
import { renderScoreboard } from './ui/scoreboard.js';

// ============================================================
// APP STATE
// ============================================================
let ctx = null;
let appView = 'actual';    // "actual" | "predicted"
let appTab = 'fixtures';   // "fixtures" | "groups" | "bracket" | "score"
let fixtureFilterStage = 'all';
let fixtureFilterGroup = 'all';
let editingActualOverrides = new Set();

// ============================================================
// BOOT
// ============================================================
async function init() {
  ctx = await loadData();
  clearOverridesMatchingActual(ctx.matches);
  document.getElementById('loading-state')?.remove();
  bindGlobalControls();
  applyHash();
  window.addEventListener('hashchange', () => { applyHash(); render(); });
  render();
}

// Deep-linkable state: #<tab> or #<tab>/<view>, e.g. "#bracket/predicted".
function applyHash() {
  const [tab, view] = location.hash.slice(1).split('/');
  if (['fixtures', 'groups', 'bracket', 'score'].includes(tab)) appTab = tab;
  if (['actual', 'predicted'].includes(view)) appView = view;
}
function syncHash() {
  const next = `${appTab}/${appView}`;
  if (location.hash.slice(1) !== next) location.hash = next; // fires hashchange -> render
}

// ============================================================
// RESULT FUNCTIONS per view
// ============================================================
function makeResultFn() {
  if (appView === 'predicted') {
    return (m) => {
      const p = getPrediction(m.id);
      return (p && p.home != null && p.away != null)
        ? { home: p.home, away: p.away }
        : null;
    };
  }
  // actual view: hand override beats FIFA snapshot
  const overrides = getOverrides();
  return (m) => effectiveActual(m, overrides);
}

function makeDecideWinner() {
  if (appView === 'predicted') {
    return (match, aCode, bCode, scores) => {
      if (scores.home > scores.away) return aCode;
      if (scores.away > scores.home) return bCode;
      // tie — use winner pick from prediction
      return getPrediction(match.id)?.winner || null;
    };
  }
  // actual view: penalties decide ties
  return (match, aCode, bCode, scores) => {
    if (scores.home > scores.away) return aCode;
    if (scores.away > scores.home) return bCode;
    // tie — check penalties from effective actual
    const overrides = getOverrides();
    const act = effectiveActual(match, overrides);
    if (act) {
      if (act.penHome != null && act.penAway != null) {
        return act.penHome > act.penAway ? aCode : bCode;
      }
    }
    return null;
  };
}

// ============================================================
// RENDER DISPATCH
// ============================================================
function render() {
  updateToggleUI();
  updateTabUI();
  updateScoreBadge();

  const container = document.getElementById('main-content');
  if (!container || !ctx) return;

  const resultFn = makeResultFn();
  const decideWinner = makeDecideWinner();
  const tables = allGroupTables(ctx, resultFn);
  const bracket = buildBracket(ctx, {
    tables,
    resultFn,
    decideWinner,
    preferAssigned: appView === 'actual',
  });

  switch (appTab) {
    case 'fixtures':  renderTab_Fixtures(container, resultFn); break;
    case 'groups':    renderTab_Groups(container, tables); break;
    case 'bracket':   renderTab_Bracket(container, bracket); break;
    case 'score':     renderTab_Score(container, resultFn); break;
  }
}

// ============================================================
// TAB: FIXTURES
// ============================================================
function renderTab_Fixtures(container, resultFn) {
  // Build ordered, filtered list of matches
  const allMatches = [...ctx.matches].sort((a, b) => {
    const da = a.dateUTC || '9999';
    const db = b.dateUTC || '9999';
    return da < db ? -1 : da > db ? 1 : a.number - b.number;
  });

  const filtered = allMatches.filter(m => {
    if (fixtureFilterStage !== 'all' && m.stage !== fixtureFilterStage) return false;
    if (fixtureFilterGroup !== 'all' && m.group !== fixtureFilterGroup) return false;
    return true;
  });

  // Group by day — key and heading both come from the active timezone basis,
  // so the day a fixture is filed under always matches its displayed time.
  const dayMap = new Map();
  for (const m of filtered) {
    const key = dayKey(m);
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key).push(m);
  }

  const overrides = getOverrides();

  const days = [...dayMap.entries()].map(([key, matches]) => {
    const label = dayHeading(key);

    const fixtures = matches.map(m => {
      const prediction = getPrediction(m.id);
      const actual = effectiveActual(m, overrides);
      const overrideActive = !!(overrides[m.id] && overrides[m.id].home != null);
      const overrideEditing = editingActualOverrides.has(m.id);
      const scoring = scoreMatch(prediction, actual);

      // Resolve team info (may be null for unplayed knockouts)
      const homeTeam = m.home ? ctx.teams[m.home.code] || m.home : null;
      const awayTeam = m.away ? ctx.teams[m.away.code] || m.away : null;

      return {
        match: m,
        timeText: kickoffText(m),
        homeCode: homeTeam?.code || null,
        homeName: homeTeam?.name || null,
        homeAbbr: homeTeam?.abbr || null,
        homeFlag: homeTeam?.flag || null,
        homeLabel: m.placeholderA || 'TBD',
        awayCode: awayTeam?.code || null,
        awayName: awayTeam?.name || null,
        awayAbbr: awayTeam?.abbr || null,
        awayFlag: awayTeam?.flag || null,
        awayLabel: m.placeholderB || 'TBD',
        prediction,
        actual,
        overrideActive,
        overrideEditing,
        scoring,
        isKnockout: !m.group,
      };
    });

    return { key, label, fixtures };
  });

  // Available stages for filter (in STAGE_ORDER)
  const stagesPresent = new Set(ctx.matches.map(m => m.stage));
  const stages = STAGE_ORDER.filter(s => stagesPresent.has(s));

  // Groups (only if First Stage or group filter is already selected)
  const groupsPresent = GROUPS.filter(g => ctx.byGroup.has(g));

  const vm = {
    days,
    filterStage: fixtureFilterStage,
    filterGroup: fixtureFilterGroup,
    stages,
    groups: groupsPresent,
    view: appView,
  };

  const handlers = {
    onPrediction(matchId, { home, away, winner }) {
      setPrediction(matchId, { home, away, winner });
      render();
    },
    onOverride(matchId, score) {
      const match = ctx.byNumber.get(Number(matchId)) || ctx.matches.find(m => m.id === matchId);
      if (_matchesActual(score, match?.actual)) {
        setOverride(matchId, null);
      } else {
        setOverride(matchId, score);
      }
      render();
    },
    onToggleOverrideEditor(matchId, isEditing) {
      if (isEditing) editingActualOverrides.add(matchId);
      else editingActualOverrides.delete(matchId);
      render();
    },
    onFilterStage(value) {
      fixtureFilterStage = value;
      // Reset group filter when switching to non-group stage
      if (value !== 'all' && value !== 'First Stage') {
        fixtureFilterGroup = 'all';
      }
      render();
    },
    onFilterGroup(value) {
      fixtureFilterGroup = value;
      if (value !== 'all') fixtureFilterStage = 'First Stage';
      render();
    },
  };

  renderFixtures(container, vm, handlers);
}

function _matchesActual(score, actual) {
  if (!score || !actual) return false;
  return score.home === actual.home &&
    score.away === actual.away &&
    (score.penHome ?? null) === (actual.penHome ?? null) &&
    (score.penAway ?? null) === (actual.penAway ?? null);
}

// ============================================================
// TAB: GROUPS
// ============================================================
function renderTab_Groups(container, tables) {
  const groups = GROUPS
    .filter(g => tables[g] && tables[g].length)
    .map(g => ({
      letter: g,
      rows: tables[g],
    }));

  renderTables(container, { groups });
}

// ============================================================
// TAB: BRACKET
// ============================================================
function renderTab_Bracket(container, bracket) {
  // Build rounds in STAGE_ORDER (knockout only)
  const knockoutStages = STAGE_ORDER.filter(s => s !== 'First Stage');

  const rounds = knockoutStages.map(stageName => {
    const matchesForStage = [...bracket.values()].filter(n => n.stage === stageName);
    matchesForStage.sort((a, b) => a.number - b.number);

    return {
      name: stageName,
      matches: matchesForStage.map(n => _bracketNodeToMatch(n)),
    };
  }).filter(r => r.matches.length > 0);

  const vm = { rounds };
  const handlers = {
    onTeamClick(code) {
      // highlight state is managed inside bracketview
    },
  };

  renderBracket(container, vm, handlers);
}

function _bracketNodeToMatch(n) {
  const aTeam = n.a ? (ctx.teams[n.a] || null) : null;
  const bTeam = n.b ? (ctx.teams[n.b] || null) : null;
  return {
    number: n.number,
    aCode:  n.a || null,
    aLabel: n.aLabel || 'TBD',
    aName:  aTeam?.name  || null,
    aAbbr:  aTeam?.abbr  || (n.a || n.aLabel || 'TBD'),
    aFlag:  aTeam?.flag  || null,
    bCode:  n.b || null,
    bLabel: n.bLabel || 'TBD',
    bName:  bTeam?.name  || null,
    bAbbr:  bTeam?.abbr  || (n.b || n.bLabel || 'TBD'),
    bFlag:  bTeam?.flag  || null,
    scoreA: n.scoreA,
    scoreB: n.scoreB,
    winner: n.winner || null,
  };
}

// ============================================================
// TAB: SCORE
// ============================================================
function renderTab_Score(container, resultFn) {
  const overrides = getOverrides();
  const getActual = (m) => effectiveActual(m, overrides);
  const tally = tallyAll(ctx.matches, getPrediction, getActual);

  renderScoreboard(container, {
    total: tally.total,
    counts: tally.counts,
    scored: tally.scored,
    totalMatches: ctx.matches.length,
  });
}

// ============================================================
// SCORE BADGE UPDATE
// ============================================================
function updateScoreBadge() {
  const overrides = getOverrides();
  const getActual = (m) => effectiveActual(m, overrides);
  const tally = tallyAll(ctx.matches, getPrediction, getActual);
  const el = document.getElementById('score-total');
  if (el) el.textContent = tally.total;
}

// ============================================================
// GLOBAL CONTROLS
// ============================================================
function bindGlobalControls() {
  // View toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      appView = btn.dataset.view;
      syncHash();
      render();
    });
  });

  // Tab nav
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      appTab = btn.dataset.tab;
      syncHash();
      render();
    });
  });

  // Timezone switcher — drives both grouping and display, so re-render on change
  const tzSelect = document.getElementById('tz-select');
  if (tzSelect) {
    tzSelect.innerHTML = TZ_OPTIONS
      .map(o => `<option value="${o.value}">${o.label}</option>`)
      .join('');
    tzSelect.value = getTZMode();
    tzSelect.addEventListener('change', () => {
      setTZMode(tzSelect.value);
      render();
    });
  }

  // Export
  document.getElementById('btn-export')?.addEventListener('click', () => {
    exportJSON();
  });

  // Import
  document.getElementById('import-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importJSON(file);
    e.target.value = '';
    render();
  });

  // Clear all
  document.getElementById('btn-clear')?.addEventListener('click', () => {
    if (!confirm('Clear all predictions and actual overrides?')) return;
    clearPredictions();
    clearOverrides();
    render();
  });
}

function updateToggleUI() {
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === appView);
  });
}

function updateTabUI() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === appTab);
  });
}

// ============================================================
// START
// ============================================================
init().catch(err => {
  console.error('WC2026 Predictor failed to initialise:', err);
  const container = document.getElementById('main-content');
  if (container) {
    container.innerHTML = `<div class="empty-state">
      Failed to load data: ${err.message}.<br>
      Make sure you are serving via <code>python3 -m http.server</code>.
    </div>`;
  }
});

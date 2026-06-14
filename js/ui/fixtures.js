// js/ui/fixtures.js — render the fixtures list.
//
// View-model shape:
//   {
//     days: [
//       {
//         key: "2026-06-11",                  // YYYY-MM-DD
//         label: "Thu, Jun 11",               // display label
//         fixtures: [
//           {
//             match,                           // raw match object
//             timeText,                        // formatted kickoff line
//             homeCode, homeName, homeAbbr, homeFlag,   // resolved (or null)
//             awayCode, awayName, awayAbbr, awayFlag,
//             homeLabel, awayLabel,            // placeholder strings if unresolved
//             prediction,                      // {home,away,winner?}|null
//             actual,                          // {home,away}|null (effective)
//             overrideActive,                  // bool — is there a manual override?
//             scoring,                         // {points,tier}|null
//             isKnockout,                      // bool
//           }
//         ]
//       }
//     ],
//     filterStage: string,        // current stage filter ("all" | stage name)
//     filterGroup: string,        // "all" | "A".."L"
//     stages: [string],           // available stage names
//     groups: [string],           // available group letters
//     view: "actual"|"predicted"
//   }
//
// Handlers:
//   onPrediction(matchId, {home, away, winner}) — user changed a prediction input
//   onOverride(matchId, {home, away})           — user changed an actual override
//   onFilterStage(value)
//   onFilterGroup(value)

export function renderFixtures(container, vm, handlers) {
  // Build toolbar filters
  const filtersEl = document.getElementById('toolbar-filters');
  if (filtersEl) {
    filtersEl.innerHTML = _buildFilters(vm);
    filtersEl.querySelector('#filter-stage')?.addEventListener('change', (e) => {
      handlers.onFilterStage(e.target.value);
    });
    filtersEl.querySelector('#filter-group')?.addEventListener('change', (e) => {
      handlers.onFilterGroup(e.target.value);
    });
  }

  if (!vm.days.length) {
    container.innerHTML = '<div class="empty-state">No matches match the current filter.</div>';
    return;
  }

  const html = vm.days.map(day => _renderDay(day, vm.view)).join('');
  container.innerHTML = html;

  // Wire events
  container.querySelectorAll('.pred-input').forEach(input => {
    input.addEventListener('change', () => _handlePredInput(input, container, handlers));
  });

  container.querySelectorAll('.winner-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const matchId = sel.dataset.matchid;
      const home = _parseScore(container.querySelector(`.pred-home[data-matchid="${matchId}"]`)?.value);
      const away = _parseScore(container.querySelector(`.pred-away[data-matchid="${matchId}"]`)?.value);
      handlers.onPrediction(matchId, { home, away, winner: sel.value || null });
    });
  });

  container.querySelectorAll('.override-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const matchId = btn.dataset.matchid;
      const row = container.querySelector(`.fixture-row[data-matchid="${matchId}"]`);
      const overrideSection = row?.querySelector('.override-section');
      if (!overrideSection) return;
      const isHidden = overrideSection.style.display === 'none' || overrideSection.style.display === '';
      if (isHidden) {
        overrideSection.style.display = 'block';
        btn.classList.add('active');
        btn.textContent = 'done';
      } else {
        overrideSection.style.display = 'none';
        btn.classList.remove('active');
        btn.textContent = 'edit';
      }
    });
  });

  container.querySelectorAll('.override-input').forEach(input => {
    input.addEventListener('change', () => _handleOverrideInput(input, container, handlers));
  });
}

function _parseScore(val) {
  if (val === '' || val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function _handlePredInput(input, container, handlers) {
  const matchId = input.dataset.matchid;
  const home = _parseScore(container.querySelector(`.pred-home[data-matchid="${matchId}"]`)?.value);
  const away = _parseScore(container.querySelector(`.pred-away[data-matchid="${matchId}"]`)?.value);
  const winner = container.querySelector(`.winner-select[data-matchid="${matchId}"]`)?.value || null;
  handlers.onPrediction(matchId, { home, away, winner: winner || null });
}

function _handleOverrideInput(input, container, handlers) {
  const matchId = input.dataset.matchid;
  const home = _parseScore(container.querySelector(`.override-home[data-matchid="${matchId}"]`)?.value);
  const away = _parseScore(container.querySelector(`.override-away[data-matchid="${matchId}"]`)?.value);
  if (home == null && away == null) {
    handlers.onOverride(matchId, null);
  } else {
    handlers.onOverride(matchId, { home, away });
  }
}

function _buildFilters(vm) {
  const stageOpts = ['<option value="all">All Stages</option>',
    ...vm.stages.map(s => `<option value="${_esc(s)}"${vm.filterStage === s ? ' selected' : ''}>${_esc(s)}</option>`)
  ].join('');

  const groupOpts = ['<option value="all">All Groups</option>',
    ...vm.groups.map(g => `<option value="${_esc(g)}"${vm.filterGroup === g ? ' selected' : ''}>Group ${g}</option>`)
  ].join('');

  return `
    <select class="filter-select" id="filter-stage">${stageOpts}</select>
    <select class="filter-select" id="filter-group">${groupOpts}</select>
  `;
}

function _renderDay(day, view) {
  return `
    <div class="day-group">
      <h2 class="day-heading">${_esc(day.label)}</h2>
      ${day.fixtures.map(f => _renderFixture(f, view)).join('')}
    </div>
  `;
}

function _renderFixture(f, view) {
  const m = f.match;
  const isPredicted = f.prediction && f.prediction.home != null && f.prediction.away != null;
  const rowClass = ['fixture-row',
    m.played ? 'played' : '',
    isPredicted ? 'predicted-done' : ''
  ].filter(Boolean).join(' ');

  const homeHtml = _renderTeamSide(f.homeCode, f.homeName, f.homeAbbr, f.homeFlag, f.homeLabel, 'home');
  const awayHtml = _renderTeamSide(f.awayCode, f.awayName, f.awayAbbr, f.awayFlag, f.awayLabel, 'away');
  const centreHtml = _renderCentre(f, view);

  return `
    <div class="${rowClass}" data-matchid="${_esc(m.id)}">
      ${homeHtml}
      ${centreHtml}
      ${awayHtml}
    </div>
  `;
}

function _renderTeamSide(code, name, abbr, flag, label, side) {
  const cls = `fixture-team ${side}`;
  if (code && flag) {
    return `
      <div class="${cls}">
        <img class="team-flag" src="${_esc(flag)}" alt="${_esc(abbr)}" loading="lazy" />
        <div>
          <div class="team-name">${_esc(name || abbr || code)}</div>
          <div class="team-abbr">${_esc(abbr || code)}</div>
        </div>
      </div>
    `;
  }
  // Unresolved placeholder
  return `
    <div class="${cls}">
      <div class="team-flag-placeholder">${_esc(label || '?')}</div>
      <div>
        <div class="team-name no-data">${_esc(label || 'TBD')}</div>
        <div class="team-abbr no-data">—</div>
      </div>
    </div>
  `;
}

function _renderCentre(f, view) {
  const m = f.match;
  const meta = `
    <div class="fixture-meta">
      <span>${_esc(f.timeText)}</span>
      <span class="venue">${_esc(m.stadium)} &middot; ${_esc(m.city)}</span>
      ${m.stage !== 'First Stage' ? `<span>${_esc(m.stage)}</span>` : ''}
    </div>
  `;

  const predHomVal = f.prediction?.home ?? '';
  const predAwaVal = f.prediction?.away ?? '';

  const predInputs = `
    <div class="score-section">
      <span class="score-label">Predict</span>
      <div class="score-pair">
        <input type="number" min="0" max="30"
          class="score-input pred-input pred-home"
          data-matchid="${_esc(m.id)}"
          value="${predHomVal !== '' ? _esc(String(predHomVal)) : ''}"
          placeholder="–"
        />
        <span class="score-sep">:</span>
        <input type="number" min="0" max="30"
          class="score-input pred-input pred-away"
          data-matchid="${_esc(m.id)}"
          value="${predAwaVal !== '' ? _esc(String(predAwaVal)) : ''}"
          placeholder="–"
        />
      </div>
    </div>
  `;

  // Actual score display
  const act = f.actual;
  const actHomeDisplay = act && act.home != null ? String(act.home) : '–';
  const actAwayDisplay = act && act.away != null ? String(act.away) : '–';
  const hasScore = act && act.home != null;

  const actualDisplay = `
    <div class="score-section">
      <span class="score-label">
        Actual
        <button class="override-toggle${f.overrideActive ? ' active' : ''}" data-matchid="${_esc(m.id)}" title="Edit actual score">
          ${f.overrideActive ? 'done' : 'edit'}
        </button>
      </span>
      <div class="score-pair">
        <span class="actual-score${hasScore ? ' has-score' : ''}">${actHomeDisplay}</span>
        <span class="score-sep">:</span>
        <span class="actual-score${hasScore ? ' has-score' : ''}">${actAwayDisplay}</span>
      </div>
    </div>
  `;

  const overrideHomeVal = f.overrideActive && act ? (act.home ?? '') : '';
  const overrideAwayVal = f.overrideActive && act ? (act.away ?? '') : '';

  const overrideSection = `
    <div class="override-section" style="${f.overrideActive ? 'display:block' : 'display:none'}">
      <div class="score-pair" style="margin-top:4px;">
        <input type="number" min="0" max="30"
          class="score-input override-input override-home${f.overrideActive ? ' override-mode' : ''}"
          data-matchid="${_esc(m.id)}"
          value="${overrideHomeVal}"
          placeholder="–"
        />
        <span class="score-sep">:</span>
        <input type="number" min="0" max="30"
          class="score-input override-input override-away${f.overrideActive ? ' override-mode' : ''}"
          data-matchid="${_esc(m.id)}"
          value="${overrideAwayVal}"
          placeholder="–"
        />
      </div>
    </div>
  `;

  // Points chip
  let chipHtml = '';
  if (f.scoring) {
    const tierClass = f.scoring.tier === 'result+gd' ? 'resultgd' : f.scoring.tier;
    const tierLabel = { exact: 'Exact', 'result+gd': 'Res+GD', result: 'Result', miss: 'Miss' }[f.scoring.tier] || '';
    chipHtml = `<span class="points-chip ${tierClass}">+${f.scoring.points} ${tierLabel}</span>`;
  }

  // Winner pick for knockout ties
  const needsWinner = f.isKnockout && f.homeCode && f.awayCode &&
    f.prediction && f.prediction.home != null && f.prediction.away != null &&
    f.prediction.home === f.prediction.away;

  let winnerHtml = '';
  if (needsWinner) {
    const opts = [
      `<option value="">Pick winner</option>`,
      `<option value="${_esc(f.homeCode)}"${f.prediction?.winner === f.homeCode ? ' selected' : ''}>${_esc(f.homeAbbr || f.homeCode)}</option>`,
      `<option value="${_esc(f.awayCode)}"${f.prediction?.winner === f.awayCode ? ' selected' : ''}>${_esc(f.awayAbbr || f.awayCode)}</option>`,
    ].join('');
    winnerHtml = `
      <div class="winner-pick">
        <span class="winner-label">Winner (pens):</span>
        <select class="winner-select" data-matchid="${_esc(m.id)}">${opts}</select>
      </div>
    `;
  }

  return `
    <div class="fixture-centre">
      ${meta}
      <div class="score-inputs">
        ${predInputs}
        <span style="font-size:11px;color:var(--text-muted);padding:0 4px;">vs</span>
        ${actualDisplay}
      </div>
      ${overrideSection}
      ${chipHtml}
      ${winnerHtml}
    </div>
  `;
}

function _esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

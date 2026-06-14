// js/ui/bracketview.js — render the knockout bracket as a visual tree.
//
// View-model shape:
//   {
//     rounds: [
//       {
//         name: "Round of 32",
//         matches: [
//           {
//             number: 73,
//             aCode: "MEX"|null,   aLabel: "2A",  aName: "Mexico", aAbbr: "MEX", aFlag: "...",
//             bCode: "RSA"|null,   bLabel: "2B",  bName: "...",    bAbbr: "...", bFlag: "...",
//             scoreA: Number|null, scoreB: Number|null,
//             winner: "MEX"|null,
//           }
//         ]
//       }
//     ],
//     thirdPlace: { ... } | null,   // same shape as a match, or null
//     final:      { ... } | null,   // same shape as a match
//   }
//
// Handlers:
//   onTeamClick(code) — clicking a team code highlights that team's path

export function renderBracket(container, vm, handlers) {
  // No filters for bracket tab
  const filtersEl = document.getElementById('toolbar-filters');
  if (filtersEl) filtersEl.innerHTML = '';

  let highlightedCode = null;

  function render() {
    const mainRounds = vm.rounds.filter(r => r.name !== 'Final' && r.name !== 'Play-off for third place');
    const finalRound = vm.rounds.find(r => r.name === 'Final');
    const thirdRound = vm.rounds.find(r => r.name === 'Play-off for third place');

    let html = '<div class="bracket-container"><div class="bracket-scroll">';

    for (const round of mainRounds) {
      html += _renderRound(round, highlightedCode);
    }

    if (finalRound) {
      html += _renderRound(finalRound, highlightedCode);
    }

    html += '</div>';

    if (thirdRound && thirdRound.matches.length) {
      html += `
        <div class="bracket-third" style="margin-top:24px;max-width:220px;">
          <div class="bracket-round-header" style="margin:0 0 4px;">3rd Place Play-off</div>
          ${_renderMatchCard(thirdRound.matches[0], highlightedCode)}
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;

    // Wire team-click events
    container.querySelectorAll('.bracket-team[data-code]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        const code = el.dataset.code;
        if (!code) return;
        highlightedCode = highlightedCode === code ? null : code;
        handlers.onTeamClick(highlightedCode);
        render();
      });
    });
  }

  render();
}

function _renderRound(round, highlightedCode) {
  const slots = round.matches.map(m => _renderMatchCard(m, highlightedCode)).join('');
  return `
    <div class="bracket-round">
      <div class="bracket-round-header">${_esc(round.name)}</div>
      <div class="bracket-slots">${slots}</div>
    </div>
  `;
}

function _renderMatchCard(m, highlightedCode) {
  const isHighlighted = highlightedCode &&
    (m.aCode === highlightedCode || m.bCode === highlightedCode);

  const cardClass = ['bracket-match', isHighlighted ? 'highlighted' : ''].filter(Boolean).join(' ');

  return `
    <div class="${cardClass}" data-number="${m.number}">
      ${_renderBracketTeam(m.aCode, m.aLabel, m.aName, m.aAbbr, m.aFlag, m.scoreA, m.winner, m.bCode ? m.winner : null)}
      ${_renderBracketTeam(m.bCode, m.bLabel, m.bName, m.bAbbr, m.bFlag, m.scoreB, m.winner, m.aCode ? m.winner : null)}
    </div>
  `;
}

function _renderBracketTeam(code, label, name, abbr, flag, score, winner, oppositeWinner) {
  const isWinner = winner && code && winner === code;
  const isLoser = oppositeWinner && code && oppositeWinner !== code && winner !== null && winner !== code;

  let cls = 'bracket-team';
  if (code) cls += ` ${cls}--resolved`;
  if (isWinner) cls += ' is-winner';
  if (isLoser) cls += ' is-loser';

  const displayCode = code || null;
  const displayLabel = code ? (abbr || code) : (label || 'TBD');

  const flagHtml = code && flag
    ? `<img class="bracket-team-flag" src="${_esc(flag)}" alt="${_esc(abbr || code)}" loading="lazy" />`
    : `<div class="bracket-team-placeholder"></div>`;

  const scoreHtml = score != null
    ? `<span class="bracket-team-score">${score}</span>`
    : '';

  return `
    <div class="${cls}" ${displayCode ? `data-code="${_esc(displayCode)}"` : ''}>
      <div class="bracket-team-cursor"></div>
      ${flagHtml}
      <span class="bracket-team-abbr" title="${_esc(name || label || '')}">${_esc(displayLabel)}</span>
      ${scoreHtml}
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

// js/ui/scoreboard.js — render the scoreboard/points summary tab.
//
// View-model shape:
//   {
//     total: Number,
//     counts: { exact: N, "result+gd": N, result: N, miss: N },
//     scored: Number,   // matches with both prediction and actual
//     totalMatches: Number,
//   }

export function renderScoreboard(container, vm) {
  const filtersEl = document.getElementById('toolbar-filters');
  if (filtersEl) filtersEl.innerHTML = '';

  const { total, counts, scored, totalMatches } = vm;

  container.innerHTML = `
    <div class="scoreboard">
      <div class="score-hero">
        <div class="score-hero-total">${total}</div>
        <div class="score-hero-label">Total Points</div>
        <div class="score-hero-sub">${scored} of ${totalMatches} matches scored</div>
      </div>

      <div class="score-breakdown">
        <div class="score-tile exact">
          <div class="score-tile-count">${counts.exact}</div>
          <div class="score-tile-label">Exact</div>
          <div class="score-tile-pts">5 pts each</div>
        </div>
        <div class="score-tile resultgd">
          <div class="score-tile-count">${counts['result+gd']}</div>
          <div class="score-tile-label">Res + GD</div>
          <div class="score-tile-pts">3 pts each</div>
        </div>
        <div class="score-tile result">
          <div class="score-tile-count">${counts.result}</div>
          <div class="score-tile-label">Result</div>
          <div class="score-tile-pts">2 pts each</div>
        </div>
        <div class="score-tile miss">
          <div class="score-tile-count">${counts.miss}</div>
          <div class="score-tile-label">Miss</div>
          <div class="score-tile-pts">0 pts</div>
        </div>
      </div>

      <div class="score-legend">
        <div class="score-legend-title">Points System</div>
        <div class="legend-rows">
          <div class="legend-row">
            <span class="legend-badge" style="color:var(--tier-exact)">5</span>
            <span class="legend-desc"><strong>Exact scoreline</strong> — you named the precise score</span>
          </div>
          <div class="legend-row">
            <span class="legend-badge" style="color:var(--tier-resultgd)">3</span>
            <span class="legend-desc"><strong>Result + goal difference</strong> — correct outcome and margin</span>
          </div>
          <div class="legend-row">
            <span class="legend-badge" style="color:var(--tier-result)">2</span>
            <span class="legend-desc"><strong>Result only</strong> — correct Win / Draw / Loss</span>
          </div>
          <div class="legend-row">
            <span class="legend-badge" style="color:var(--tier-miss)">0</span>
            <span class="legend-desc"><strong>Miss</strong> — wrong outcome</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

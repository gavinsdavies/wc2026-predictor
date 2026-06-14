// js/ui/tables.js — render the 12 group standing tables.
//
// View-model shape:
//   {
//     groups: [
//       {
//         letter: "A",
//         rows: [
//           { code, name, abbr, flag, group, P, W, D, L, GF, GA, GD, Pts, rank }
//         ],
//         qualifiedCodes: Set<string>,     // top-2 teams who qualify directly
//         possibleThirdCode: string|null,  // rank-3 team
//       }
//     ]
//   }

export function renderTables(container, vm) {
  // No filters for groups tab
  const filtersEl = document.getElementById('toolbar-filters');
  if (filtersEl) filtersEl.innerHTML = '';

  const html = `<div class="groups-grid">${vm.groups.map(_renderGroup).join('')}</div>`;
  container.innerHTML = html;
}

function _renderGroup(g) {
  const rowsHtml = g.rows.map((row, i) => _renderRow(row, i, g)).join('');
  return `
    <div class="group-card">
      <div class="group-card-header">
        <span class="group-letter">${_esc(g.letter)}</span>
        <span class="group-title">Group ${_esc(g.letter)}</span>
      </div>
      <table class="group-table">
        <thead>
          <tr>
            <th style="width:40%">Team</th>
            <th>P</th><th>W</th><th>D</th><th>L</th>
            <th>GF</th><th>GA</th><th title="Goal difference">GD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

function _renderRow(row, i, g) {
  let rowClass = '';
  if (i < 2) {
    rowClass = 'qualify';
  } else if (i === 2) {
    rowClass = 'possible-third';
  } else {
    rowClass = 'eliminated';
  }

  const gdClass = row.GD > 0 ? 'positive' : row.GD < 0 ? 'negative' : '';
  const gdDisplay = row.GD > 0 ? `+${row.GD}` : String(row.GD);

  const flagHtml = row.flag
    ? `<img class="team-flag" src="${_esc(row.flag)}" alt="${_esc(row.abbr)}" loading="lazy" />`
    : `<span class="team-flag-placeholder"></span>`;

  return `
    <tr class="${rowClass}">
      <td>
        <span class="rank-num">${i + 1}</span>
        <span class="table-team">
          ${flagHtml}
          <span class="table-team-name">${_esc(row.name || row.abbr)}</span>
        </span>
      </td>
      <td>${row.P}</td>
      <td>${row.W}</td>
      <td>${row.D}</td>
      <td>${row.L}</td>
      <td>${row.GF}</td>
      <td>${row.GA}</td>
      <td class="gd-col ${gdClass}">${gdDisplay}</td>
      <td class="pts-col">${row.Pts}</td>
    </tr>
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

// standings.js — compute group tables from ANY result source.
//
// resultFn(match) -> { home: Number, away: Number } | null
// Pass a prediction-backed fn or an actual-backed fn; the math is identical.
// This single parameterization is what makes the Predicted/Actual toggle
// almost free.

const WIN = 3, DRAW = 1;

function emptyRow(code, team) {
  return {
    code, name: team?.name || code, abbr: team?.abbr || code,
    flag: team?.flag, group: team?.group,
    P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0,
  };
}

// Build per-team rows for one group given a result source.
export function computeGroupTable(group, ctx, resultFn) {
  const { byGroup, teams, groupTeams } = ctx;
  const rows = new Map();
  for (const code of (groupTeams.get(group) || [])) {
    rows.set(code, emptyRow(code, teams[code]));
  }
  const matches = (byGroup.get(group) || []);
  for (const m of matches) {
    if (!m.home || !m.away) continue;
    const r = resultFn(m);
    if (!r || r.home == null || r.away == null) continue;
    const h = rows.get(m.home.code), a = rows.get(m.away.code);
    if (!h || !a) continue;
    h.P++; a.P++;
    h.GF += r.home; h.GA += r.away;
    a.GF += r.away; a.GA += r.home;
    if (r.home > r.away) { h.W++; a.L++; h.Pts += WIN; }
    else if (r.home < r.away) { a.W++; h.L++; a.Pts += WIN; }
    else { h.D++; a.D++; h.Pts += DRAW; a.Pts += DRAW; }
  }
  for (const row of rows.values()) row.GD = row.GF - row.GA;
  return rankRows([...rows.values()], matches, resultFn);
}

// FIFA order: Pts -> GD -> GF -> head-to-head among the tied teams.
function rankRows(rows, matches, resultFn) {
  const overall = (a, b) =>
    b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF;
  rows.sort(overall);

  // Resolve ties with a head-to-head mini-table among equal-on-(Pts,GD,GF).
  const out = [];
  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    while (j < rows.length &&
      rows[j].Pts === rows[i].Pts &&
      rows[j].GD === rows[i].GD &&
      rows[j].GF === rows[i].GF) j++;
    const tied = rows.slice(i, j);
    if (tied.length > 1) {
      out.push(...breakTie(tied, matches, resultFn));
    } else {
      out.push(tied[0]);
    }
    i = j;
  }
  out.forEach((r, idx) => (r.rank = idx + 1));
  return out;
}

function breakTie(tied, matches, resultFn) {
  const codes = new Set(tied.map((r) => r.code));
  const mini = new Map(tied.map((r) => [r.code, { code: r.code, Pts: 0, GD: 0, GF: 0 }]));
  for (const m of matches) {
    if (!m.home || !m.away) continue;
    if (!codes.has(m.home.code) || !codes.has(m.away.code)) continue;
    const r = resultFn(m);
    if (!r || r.home == null || r.away == null) continue;
    const h = mini.get(m.home.code), a = mini.get(m.away.code);
    h.GF += r.home; a.GF += r.away;
    h.GD += r.home - r.away; a.GD += r.away - r.home;
    if (r.home > r.away) h.Pts += WIN;
    else if (r.home < r.away) a.Pts += WIN;
    else { h.Pts += DRAW; a.Pts += DRAW; }
  }
  return tied.slice().sort((x, y) => {
    const mx = mini.get(x.code), my = mini.get(y.code);
    return (my.Pts - mx.Pts) || (my.GD - mx.GD) || (my.GF - mx.GF) ||
           x.code.localeCompare(y.code); // stable last resort
  });
}

// All 12 group tables at once: { A: [rows], B: [...], ... }
export function allGroupTables(ctx, resultFn) {
  const tables = {};
  for (const g of ctx.groupTeams.keys()) {
    tables[g] = computeGroupTable(g, ctx, resultFn);
  }
  return tables;
}

// Rank the 12 third-placed teams (best -> worst); the top 8 advance.
export function rankThirds(tables) {
  const thirds = Object.values(tables)
    .map((rows) => rows[2])
    .filter(Boolean);
  thirds.sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF ||
                        a.code.localeCompare(b.code));
  return thirds; // [{...row, group}, ...] length up to 12
}

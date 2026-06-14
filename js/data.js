// data.js — load the local FIFA snapshot and build lookup indices.
// Everything downstream depends only on this normalized shape, never on
// FIFA's raw API.

let _cache = null;

export async function loadData() {
  if (_cache) return _cache;
  const [matches, teams, meta] = await Promise.all([
    fetch("data/matches.json").then((r) => r.json()),
    fetch("data/teams.json").then((r) => r.json()),
    fetch("data/meta.json").then((r) => r.json()),
  ]);

  const byNumber = new Map();
  const byGroup = new Map();   // "A" -> [matches]
  const byStage = new Map();   // "Round of 32" -> [matches]
  for (const m of matches) {
    byNumber.set(m.number, m);
    if (m.group) {
      if (!byGroup.has(m.group)) byGroup.set(m.group, []);
      byGroup.get(m.group).push(m);
    }
    if (!byStage.has(m.stage)) byStage.set(m.stage, []);
    byStage.get(m.stage).push(m);
  }

  // group letter -> [team codes]
  const groupTeams = new Map();
  for (const code of Object.keys(teams)) {
    const g = teams[code].group;
    if (!groupTeams.has(g)) groupTeams.set(g, []);
    groupTeams.get(g).push(code);
  }

  _cache = { matches, teams, meta, byNumber, byGroup, byStage, groupTeams };
  return _cache;
}

export const STAGE_ORDER = [
  "First Stage",
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Play-off for third place",
  "Final",
];

export const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

// Kickoff formatting + day bucketing now lives in timezone.js, so grouping and
// display always share one timezone basis (see that module for the rationale).

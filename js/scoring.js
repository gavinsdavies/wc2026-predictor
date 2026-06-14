// scoring.js — points for predictions vs actual results.
// Tune the constants to taste.

export const POINTS = {
  EXACT: 5,        // exact scoreline
  RESULT_GD: 3,    // right outcome AND right goal difference
  RESULT: 2,       // right outcome only (W/D/L)
  MISS: 0,
};

function outcome(h, a) { return h > a ? "H" : h < a ? "A" : "D"; }

// Returns { points, tier } for one match, or null if not scorable yet.
export function scoreMatch(prediction, actual) {
  if (!prediction || prediction.home == null || prediction.away == null) return null;
  if (!actual || actual.home == null || actual.away == null) return null;
  const ph = prediction.home, pa = prediction.away;
  const ah = actual.home, aa = actual.away;
  if (ph === ah && pa === aa) return { points: POINTS.EXACT, tier: "exact" };
  if (outcome(ph, pa) === outcome(ah, aa)) {
    if (ph - pa === ah - aa) return { points: POINTS.RESULT_GD, tier: "result+gd" };
    return { points: POINTS.RESULT, tier: "result" };
  }
  return { points: POINTS.MISS, tier: "miss" };
}

// Aggregate across all matches.
// getActual(match) -> effective actual {home,away} | null
// getPrediction(matchId) -> {home,away} | null
export function tallyAll(matches, getPrediction, getActual) {
  let total = 0;
  const counts = { exact: 0, "result+gd": 0, result: 0, miss: 0 };
  let scored = 0;
  const perMatch = new Map();
  for (const m of matches) {
    const res = scoreMatch(getPrediction(m.id), getActual(m));
    if (!res) continue;
    perMatch.set(m.id, res);
    total += res.points;
    counts[res.tier]++;
    scored++;
  }
  return { total, counts, scored, perMatch };
}

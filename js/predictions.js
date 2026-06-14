// predictions.js — user state in localStorage.
//
// Two independent stores:
//   PRED_KEY      your predicted scores         { [matchId]: {home, away, winner?} }
//   OVERRIDE_KEY  manual actual-score overrides { [matchId]: {home, away, penHome?, penAway?} }
//
// Keeping overrides separate means re-running fetch_data.py refreshes FIFA's
// actuals without wiping anything you typed by hand (override wins on merge).

const PRED_KEY = "wc2026:predictions";
const OVERRIDE_KEY = "wc2026:actualOverrides";

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}
function write(key, obj) {
  localStorage.setItem(key, JSON.stringify(obj));
}

// --- predictions --------------------------------------------------------
export function getPredictions() { return read(PRED_KEY); }

export function getPrediction(matchId) { return read(PRED_KEY)[matchId] || null; }

export function setPrediction(matchId, { home, away, winner }) {
  const all = read(PRED_KEY);
  if (home == null && away == null && winner == null) {
    delete all[matchId];
  } else {
    all[matchId] = { home, away, ...(winner ? { winner } : {}) };
  }
  write(PRED_KEY, all);
}

export function clearPredictions() { localStorage.removeItem(PRED_KEY); }

// --- actual-score overrides --------------------------------------------
export function getOverrides() { return read(OVERRIDE_KEY); }

export function setOverride(matchId, score) {
  const all = read(OVERRIDE_KEY);
  if (!score || (score.home == null && score.away == null)) {
    delete all[matchId];
  } else {
    all[matchId] = score;
  }
  write(OVERRIDE_KEY, all);
}

export function clearOverrides() { localStorage.removeItem(OVERRIDE_KEY); }

// Effective actual result for a match: hand override beats FIFA's snapshot.
export function effectiveActual(match, overrides) {
  const o = overrides[match.id];
  if (o && o.home != null && o.away != null) return o;
  return match.actual; // may be null if not yet played
}

// --- export / import ----------------------------------------------------
export function exportJSON() {
  const blob = new Blob(
    [JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      predictions: read(PRED_KEY),
      actualOverrides: read(OVERRIDE_KEY),
    }, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wc2026-predictions-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importJSON(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (data.predictions) write(PRED_KEY, data.predictions);
  if (data.actualOverrides) write(OVERRIDE_KEY, data.actualOverrides);
}

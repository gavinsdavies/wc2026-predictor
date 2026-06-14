// bracket.js — resolve knockout placeholders into concrete teams for the
// active view (predicted or actual).
//
// Placeholder grammar:
//   "1A","2B"      position N of group X            -> tables[X][N-1]
//   "3ABCDF"       a best-third; letters = the slot's candidate groups
//   "Wnn"          winner of match nn               (recursive)
//   "RUnn"         runner-up / loser of match nn    (recursive)
//
// The eight "3XXXXX" slots are assigned globally via a deterministic
// bipartite matching of the top-8 third-placed teams to slots whose
// candidate set contains their group.

import { rankThirds } from "./standings.js";

// --- third-place slot assignment ---------------------------------------
// Returns Map(matchNumber -> { slot: "A"|"B", code }) for the 8 third slots.
function assignThirds(ctx, tables) {
  const slots = []; // { match, slot, candidates:Set<letter> }
  for (const m of ctx.byStage.get("Round of 32") || []) {
    for (const slot of ["A", "B"]) {
      const ph = slot === "A" ? m.placeholderA : m.placeholderB;
      if (ph && ph[0] === "3" && ph.length > 2) {
        slots.push({ match: m, slot, candidates: new Set(ph.slice(1).split("")) });
      }
    }
  }
  const thirds = rankThirds(tables).slice(0, 8); // best-8 thirds, ranked
  const qualifyingGroups = thirds.map((t) => t.group);
  const groupToCode = new Map(thirds.map((t) => [t.group, t.code]));

  // Kuhn's bipartite matching: groups (ranked best-first) -> slots.
  // Deterministic because both orderings are fixed.
  const slotByMatchSlot = (s) => `${s.match.number}${s.slot}`;
  const matchOfGroup = new Map(); // group -> slot key
  const slotTaken = new Map();    // slot key -> group

  function tryAssign(group, seen) {
    for (const s of slots) {
      const key = slotByMatchSlot(s);
      if (!s.candidates.has(group) || seen.has(key)) continue;
      seen.add(key);
      if (!slotTaken.has(key) || tryAssign(slotTaken.get(key), seen)) {
        slotTaken.set(key, group);
        matchOfGroup.set(group, key);
        return true;
      }
    }
    return false;
  }
  for (const g of qualifyingGroups) tryAssign(g, new Set());

  const out = new Map();
  for (const s of slots) {
    const key = slotByMatchSlot(s);
    const g = slotTaken.get(key);
    out.set(key, g ? { slot: s.slot, code: groupToCode.get(g) } : { slot: s.slot, code: null });
  }
  return out;
}

// --- main builder -------------------------------------------------------
// opts: { tables, resultFn, decideWinner, preferAssigned }
//   resultFn(match)  -> {home, away} | null  (scores for this view)
//   decideWinner(match, aCode, bCode, scores) -> winning code | null
//   preferAssigned   use FIFA's real home/away when populated (Actual view)
export function buildBracket(ctx, opts) {
  const { tables, resultFn, decideWinner, preferAssigned } = opts;
  const thirdMap = assignThirds(ctx, tables);
  const memo = new Map(); // matchNumber -> resolved node

  function resolvePlaceholder(ph, match, slot) {
    if (!ph) return null;
    if (preferAssigned && match) {
      const side = slot === "A" ? match.home : match.away;
      if (side) return side.code;
    }
    const first = ph[0];
    if (first === "W" || (ph.startsWith("RU"))) {
      const isRU = ph.startsWith("RU");
      const num = parseInt(ph.replace(/^(RU|W)/, ""), 10);
      const node = resolveMatch(num);
      if (!node) return null;
      if (isRU) {
        if (!node.winner) return null;
        return node.winner === node.a ? node.b : node.a;
      }
      return node.winner;
    }
    if (first === "3" && ph.length > 2) {
      const got = thirdMap.get(`${match.number}${slot}`);
      return got ? got.code : null;
    }
    // "1A".."4L"
    const pos = parseInt(first, 10);
    const group = ph.slice(1);
    const table = tables[group];
    if (!table || !table[pos - 1]) return null;
    return table[pos - 1].code;
  }

  function resolveMatch(number) {
    if (memo.has(number)) return memo.get(number);
    const m = ctx.byNumber.get(number);
    if (!m) return null;
    const node = {
      number, stage: m.stage, match: m,
      a: null, b: null,
      aLabel: m.placeholderA, bLabel: m.placeholderB,
      winner: null, scoreA: null, scoreB: null,
    };
    memo.set(number, node); // set early to guard against cycles (none expected)
    node.a = resolvePlaceholder(m.placeholderA, m, "A");
    node.b = resolvePlaceholder(m.placeholderB, m, "B");
    const sc = resultFn(m);
    if (sc && sc.home != null && sc.away != null) {
      node.scoreA = sc.home;
      node.scoreB = sc.away;
      if (node.a && node.b) node.winner = decideWinner(m, node.a, node.b, sc);
    }
    return node;
  }

  const bracket = new Map();
  for (const m of ctx.matches) {
    if (m.group) continue; // knockout only
    bracket.set(m.number, resolveMatch(m.number));
  }
  return bracket;
}

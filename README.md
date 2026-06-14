# WC 2026 Predictor

A local-only, offline webpage for the 2026 FIFA World Cup: country flags,
fixtures with kickoff times + venues, group tables, an auto-resolving playoff
bracket, and a prediction game with scoring. No build step, no framework, no
runtime network access — just static files and a JSON snapshot pulled from
FIFA.

## Quick start

```bash
python3 fetch_data.py     # pull FIFA data -> data/ (matches, teams, flags)
./serve.sh                # serve at http://localhost:8000
```

Open <http://localhost:8000>. Re-run `fetch_data.py` anytime to refresh scores
and (once decided) real knockout matchups.

> Must be served over HTTP. Opening `index.html` via `file://` breaks ES-module
> imports and `fetch()` of the local JSON.

## What it does

- **Fixtures** — all 104 matches grouped by day, with viewer-local + venue-local
  kickoff, stadium · city, flags, your **predicted** score inputs, and the
  **actual** score (auto-filled from FIFA, hand-editable via the edit toggle).
- **Groups** — 12 group tables; top-2 highlighted, 3rd-place row marked.
- **Bracket** — Round of 32 → Final, resolving placeholders (`1A`, `2B`,
  `3ABCDF`, `W74`, `RU101`) into real teams. Click a team to trace its path.
- **Score** — points for predictions vs actuals: exact 5 / result+GD 3 /
  result 2.
- **Predicted ⇄ Actual** toggle drives the tables and bracket between your
  hypothetical run and what really happened. Deep-linkable via URL hash
  (e.g. `#bracket/predicted`).
- **Export / Import** your predictions as JSON; everything else lives in
  `localStorage`.

## Data source

FIFA's public JSON API (competition `17`, season `285023`):
`api.fifa.com/api/v3/calendar/matches`. `fetch_data.py` normalizes it into
`data/*.json` and caches flag PNGs locally, so the page works fully offline.
All FIFA-specific quirks are isolated to that one script — the UI only reads the
normalized shape.

## Notes / limitations

- Group tiebreakers implemented: points → goal difference → goals for →
  head-to-head. FIFA's further tiebreakers (fair play, drawing of lots) are not
  modeled.
- Best-third → R32-slot assignment uses a deterministic bipartite matching that
  honors each slot's candidate groups (always yields a valid bracket). In the
  **Actual** view, FIFA's real assigned teams are preferred once a knockout
  match is populated.

## Layout

```
fetch_data.py      FIFA -> data/ (stdlib only, no deps)
serve.sh           local static server
index.html
css/styles.css
js/
  data.js          load + index the snapshot
  predictions.js   localStorage + export/import
  standings.js     group tables from any result source
  bracket.js       placeholder + best-thirds resolution
  scoring.js       prediction points
  main.js          orchestrator / state
  ui/*.js          fixtures, tables, bracket, scoreboard renderers
```

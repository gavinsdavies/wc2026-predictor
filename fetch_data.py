#!/usr/bin/env python3
"""Fetch 2026 FIFA World Cup data from FIFA's public JSON API and write a
normalized, local snapshot the static webpage reads.

No third-party dependencies (stdlib urllib/json only) -> nothing to install.

Outputs (in ./data):
  matches.json  - all 104 matches, normalized
  teams.json    - 48 teams keyed by 3-letter code
  meta.json     - ids, fetch timestamp, counts
  flags/<CODE>.png - one flag per team (skip with --no-flags)

Usage:
  python3 fetch_data.py            # full refresh incl. flags
  python3 fetch_data.py --no-flags # data only
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

COMPETITION = "17"        # FIFA World Cup
SEASON = "285023"         # 2026 edition
API = (
    "https://api.fifa.com/api/v3/calendar/matches"
    f"?idCompetition={COMPETITION}&idSeason={SEASON}&count=200&language=en"
)
FLAG_URL = "https://api.fifa.com/api/v3/picture/flags-sq-4/{code}"

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
FLAGS = os.path.join(DATA, "flags")

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def http_get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA,
                                               "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if binary else json.loads(data)


def loc(value, default=None):
    """FIFA localizes text as [{Locale, Description}] (sometimes a single
    dict). Return the en-GB string, else the first available."""
    if value is None:
        return default
    items = value if isinstance(value, list) else [value]
    chosen = None
    for it in items:
        if not isinstance(it, dict):
            continue
        if it.get("Locale", "").lower().startswith("en"):
            return it.get("Description", default)
        if chosen is None:
            chosen = it.get("Description", default)
    return chosen if chosen is not None else default


def group_letter(name):
    # "Group A" -> "A"; knockout matches have no group
    if not name:
        return None
    return name.replace("Group", "").strip() or None


def team_obj(side):
    """Normalize a Home/Away object. Returns None if the slot is unfilled
    (knockout placeholders before teams are known)."""
    if not side:
        return None
    code = side.get("IdCountry")
    if not code:
        return None
    return {
        "code": code,
        "name": loc(side.get("TeamName"), code),
        "abbr": side.get("Abbreviation") or code,
        "flag": f"data/flags/{code}.png",
    }


def normalize_match(m):
    home_raw = m.get("Home") or {}
    away_raw = m.get("Away") or {}
    hs = home_raw.get("Score")
    as_ = away_raw.get("Score")
    played = hs is not None and as_ is not None
    stadium = m.get("Stadium") or {}
    return {
        "id": m.get("IdMatch"),
        "number": m.get("MatchNumber"),
        "stage": loc(m.get("StageName")),
        "group": group_letter(loc(m.get("GroupName"))),
        "matchday": m.get("MatchDay"),
        "dateUTC": m.get("Date"),
        "localDate": m.get("LocalDate"),
        "stadium": loc(stadium.get("Name")),
        "city": loc(stadium.get("CityName")),
        "hostCountry": stadium.get("IdCountry"),
        "status": m.get("MatchStatus"),
        "played": played,
        "home": team_obj(home_raw),
        "away": team_obj(away_raw),
        "placeholderA": m.get("PlaceHolderA"),
        "placeholderB": m.get("PlaceHolderB"),
        "actual": {
            "home": hs,
            "away": as_,
            "penHome": m.get("HomeTeamPenaltyScore"),
            "penAway": m.get("AwayTeamPenaltyScore"),
        } if played else None,
        "winner": m.get("Winner"),
    }


def build_teams(matches):
    teams = {}
    for m in matches:
        if m["group"] is None:
            continue
        for side in (m["home"], m["away"]):
            if side and side["code"] not in teams:
                teams[side["code"]] = {
                    "code": side["code"],
                    "name": side["name"],
                    "abbr": side["abbr"],
                    "group": m["group"],
                    "flag": side["flag"],
                }
    return teams


def download_flags(teams):
    ok = 0
    for code in sorted(teams):
        dest = os.path.join(FLAGS, f"{code}.png")
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            ok += 1
            continue
        try:
            png = http_get(FLAG_URL.format(code=code), binary=True)
            with open(dest, "wb") as f:
                f.write(png)
            ok += 1
            time.sleep(0.05)
        except (urllib.error.URLError, OSError) as e:
            print(f"  ! flag {code} failed: {e}", file=sys.stderr)
    return ok


def main():
    no_flags = "--no-flags" in sys.argv
    os.makedirs(FLAGS, exist_ok=True)

    print(f"Fetching matches (competition {COMPETITION}, season {SEASON}) ...")
    payload = http_get(API)
    raw = payload.get("Results", [])
    matches = [normalize_match(m) for m in raw]
    matches.sort(key=lambda x: (x["number"] or 0))

    teams = build_teams(matches)

    nflags = 0
    if no_flags:
        print("Skipping flag download (--no-flags).")
    else:
        print(f"Downloading flags for {len(teams)} teams ...")
        nflags = download_flags(teams)

    meta = {
        "competition": COMPETITION,
        "season": SEASON,
        "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "counts": {
            "matches": len(matches),
            "teams": len(teams),
            "flags": nflags,
            "played": sum(1 for m in matches if m["played"]),
        },
    }

    with open(os.path.join(DATA, "matches.json"), "w") as f:
        json.dump(matches, f, ensure_ascii=False, indent=1)
    with open(os.path.join(DATA, "teams.json"), "w") as f:
        json.dump(teams, f, ensure_ascii=False, indent=1)
    with open(os.path.join(DATA, "meta.json"), "w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)

    c = meta["counts"]
    print(f"\nWrote data/  ->  {c['matches']} matches, {c['teams']} teams, "
          f"{c['flags']} flags, {c['played']} played.")
    if c["matches"] != 104:
        print(f"  ! expected 104 matches, got {c['matches']}", file=sys.stderr)
    if c["teams"] != 48:
        print(f"  ! expected 48 teams, got {c['teams']} "
              f"(group draw may be incomplete)", file=sys.stderr)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate an iCalendar file from the normalized World Cup fixture data."""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent
DEFAULT_MATCHES = REPO_ROOT / "data" / "matches.json"
DEFAULT_TEAMS = REPO_ROOT / "data" / "teams.json"
DEFAULT_META = REPO_ROOT / "data" / "meta.json"
DEFAULT_OUTPUT = REPO_ROOT / "wc2026.ics"

# FIFA uses three-letter team codes; flag emoji use ISO-3166 alpha-2 codes.
FIFA_TO_ISO = {
    "MEX": "MX",
    "RSA": "ZA",
    "KOR": "KR",
    "CZE": "CZ",
    "CAN": "CA",
    "BIH": "BA",
    "USA": "US",
    "PAR": "PY",
    "HAI": "HT",
    "SCO": "GB",
    "AUS": "AU",
    "TUR": "TR",
    "BRA": "BR",
    "MAR": "MA",
    "QAT": "QA",
    "SUI": "CH",
    "CIV": "CI",
    "ECU": "EC",
    "GER": "DE",
    "CUW": "CW",
    "NED": "NL",
    "JPN": "JP",
    "SWE": "SE",
    "TUN": "TN",
    "KSA": "SA",
    "URU": "UY",
    "ESP": "ES",
    "CPV": "CV",
    "IRN": "IR",
    "NZL": "NZ",
    "BEL": "BE",
    "EGY": "EG",
    "FRA": "FR",
    "SEN": "SN",
    "IRQ": "IQ",
    "NOR": "NO",
    "ARG": "AR",
    "ALG": "DZ",
    "AUT": "AT",
    "JOR": "JO",
    "GHA": "GH",
    "PAN": "PA",
    "ENG": "GB",
    "CRO": "HR",
    "POR": "PT",
    "COD": "CD",
    "UZB": "UZ",
    "COL": "CO",
}


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def parse_utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def format_ical_dt(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def escape_ical_text(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace(";", "\\;")
        .replace(",", "\\,")
    )


def fold_ical_line(line: str) -> list[str]:
    """Fold a content line to 75 octets per RFC 5545."""
    raw = line.encode("utf-8")
    chunks: list[bytes] = []
    while len(raw) > 75:
        split = 75
        while split > 0 and (raw[split] & 0xC0) == 0x80:
            split -= 1
        chunks.append(raw[:split])
        raw = raw[split:]
    chunks.append(raw)

    lines = [chunks[0].decode("utf-8")]
    lines.extend(" " + chunk.decode("utf-8") for chunk in chunks[1:])
    return lines


def flag_emoji(iso_code: str | None) -> str:
    if not iso_code or len(iso_code) != 2:
        return ""
    base = ord("A")
    return "".join(chr(0x1F1E6 + ord(char.upper()) - base) for char in iso_code)


def team_display(team: dict | None) -> str:
    if not team:
        return "TBD"
    name = team.get("name") or team.get("abbr") or team.get("code") or "TBD"
    emoji = flag_emoji(FIFA_TO_ISO.get(team.get("code", "")))
    return f"{name} {emoji}" if emoji else name


def placeholder_to_text(placeholder: str | None) -> str:
    if not placeholder:
        return "TBD"
    if placeholder.startswith("RU") and placeholder[2:].isdigit():
        return f"Runner-up of Match {placeholder[2:]}"
    if placeholder.startswith("W") and placeholder[1:].isdigit():
        return f"Winner of Match {placeholder[1:]}"
    if placeholder[0] == "1" and len(placeholder) == 2:
        return f"Winner Group {placeholder[1]}"
    if placeholder[0] == "2" and len(placeholder) == 2:
        return f"Runner-up Group {placeholder[1]}"
    if placeholder[0] == "3" and len(placeholder) > 1:
        return "Third-place Group " + "/".join(placeholder[1:])
    return placeholder


def match_summary(match: dict) -> str:
    home = team_display(match.get("home")) if match.get("home") else placeholder_to_text(match.get("placeholderA"))
    away = team_display(match.get("away")) if match.get("away") else placeholder_to_text(match.get("placeholderB"))
    return f"{home} vs {away}"


def match_location(match: dict) -> str:
    parts = [match.get("stadium"), match.get("city"), match.get("hostCountry")]
    return ", ".join(str(part) for part in parts if part)


def metadata_dtstamp(meta_path: Path) -> datetime:
    try:
        fetched_at = load_json(meta_path).get("fetchedAt")
        if fetched_at:
            return parse_utc(fetched_at)
    except FileNotFoundError:
        pass
    return datetime.now(UTC).replace(microsecond=0)


def build_calendar(matches: list[dict], dtstamp: datetime, duration: timedelta) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//WC 2026 Predictor//World Cup Calendar//EN",
        "CALSCALE:GREGORIAN",
    ]

    for match in matches:
        kickoff = match.get("dateUTC")
        if not kickoff:
            continue

        start = parse_utc(kickoff)
        end = start + duration
        event_lines = [
            "BEGIN:VEVENT",
            f"UID:{match.get('id')}@wc2026-predictor",
            f"DTSTAMP:{format_ical_dt(dtstamp)}",
            f"DTSTART:{format_ical_dt(start)}",
            f"DTEND:{format_ical_dt(end)}",
            f"SUMMARY:{escape_ical_text(match_summary(match))}",
        ]

        location = match_location(match)
        if location:
            event_lines.append(f"LOCATION:{escape_ical_text(location)}")

        event_lines.append("END:VEVENT")
        lines.extend(event_lines)

    lines.append("END:VCALENDAR")

    folded: list[str] = []
    for line in lines:
        folded.extend(fold_ical_line(line))
    return "\r\n".join(folded) + "\r\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--matches", type=Path, default=DEFAULT_MATCHES, help="Path to matches.json")
    parser.add_argument("--teams", type=Path, default=DEFAULT_TEAMS, help="Path to teams.json for code coverage checks")
    parser.add_argument("--meta", type=Path, default=DEFAULT_META, help="Path to meta.json for a stable DTSTAMP")
    parser.add_argument("-o", "--output", type=Path, default=DEFAULT_OUTPUT, help="Output .ics path")
    parser.add_argument("--duration-minutes", type=int, default=120, help="Calendar event duration")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    matches = load_json(args.matches)
    teams = load_json(args.teams)

    missing_flag_codes = sorted(code for code in teams if code not in FIFA_TO_ISO)
    if missing_flag_codes:
        raise SystemExit(f"Missing FIFA_TO_ISO mappings: {', '.join(missing_flag_codes)}")

    calendar = build_calendar(
        matches,
        dtstamp=metadata_dtstamp(args.meta),
        duration=timedelta(minutes=args.duration_minutes),
    )
    args.output.write_text(calendar, encoding="utf-8", newline="")
    print(f"Wrote {len(matches)} events to {args.output}")


if __name__ == "__main__":
    main()

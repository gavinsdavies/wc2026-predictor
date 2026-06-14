// timezone.js — single source of truth for how kickoff times are bucketed
// and displayed.
//
// Two values per match drive everything:
//   dateUTC    the true instant ("2026-06-14T01:00:00Z")
//   localDate  the venue wall-clock, carrying a *spurious* Z
//              ("2026-06-13T21:00:00Z" really means 21:00 at the stadium)
//
// The historical bug: the day *grouping* used dateUTC's UTC calendar day while
// the time *label* used the viewer's device zone. For any evening kickoff in
// the Americas the instant is past midnight UTC, so a Friday-night game was
// filed under Saturday. Fix: derive the day key AND the label from one chosen
// timezone, surfaced to the user as a switcher.

const TZ_KEY = "wc2026:tz";

// "device" -> the browser's own zone; "venue" -> stadium wall-clock from
// localDate; anything else is a literal IANA zone passed straight to Intl.
export const TZ_OPTIONS = [
  { value: "device",              label: "My time" },
  { value: "venue",               label: "Venue local" },
  { value: "America/New_York",    label: "US Eastern" },
  { value: "America/Chicago",     label: "US Central" },
  { value: "America/Denver",      label: "US Mountain" },
  { value: "America/Los_Angeles", label: "US Pacific" },
  { value: "Europe/London",       label: "UK" },
  { value: "Europe/Copenhagen",   label: "Copenhagen" },
];

const VALID = new Set(TZ_OPTIONS.map((o) => o.value));

export function getTZMode() {
  const v = localStorage.getItem(TZ_KEY);
  return v && VALID.has(v) ? v : "device";
}

export function setTZMode(v) {
  if (VALID.has(v)) localStorage.setItem(TZ_KEY, v);
}

// Map a mode to the `timeZone` option for Intl:
//   "device" -> undefined (Intl uses the runtime default zone)
//   IANA     -> itself
// "venue" never reaches Intl; it is read straight off the localDate string.
function zoneFor(mode) {
  return mode === "device" ? undefined : mode;
}

// YYYY-MM-DD calendar day in the active basis — the bucket key for grouping.
export function dayKey(match) {
  const mode = getTZMode();
  if (mode === "venue") {
    return match.localDate ? match.localDate.slice(0, 10) : "TBD";
  }
  if (!match.dateUTC) return "TBD";
  // en-CA formats as ISO-style YYYY-MM-DD, so the string is also sortable.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zoneFor(mode),
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(match.dateUTC));
}

// Heading for a day group. The key is already a calendar date in the active
// basis; render it at UTC noon so weekday/date never roll into a neighbour.
export function dayHeading(key) {
  if (key === "TBD") return "Date TBD";
  return new Date(key + "T12:00:00Z").toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

// Per-fixture kickoff line: time in the active basis, plus the venue wall-clock
// as a muted hint whenever the active basis isn't already the venue.
export function kickoffText(match) {
  const mode = getTZMode();
  if (mode === "venue") {
    return match.localDate ? `${match.localDate.slice(11, 16)} venue` : "TBD";
  }
  if (!match.dateUTC) return "TBD";
  const primary = new Intl.DateTimeFormat(undefined, {
    timeZone: zoneFor(mode),
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(match.dateUTC));
  const venue = match.localDate ? ` · ${match.localDate.slice(11, 16)} venue` : "";
  return primary + venue;
}

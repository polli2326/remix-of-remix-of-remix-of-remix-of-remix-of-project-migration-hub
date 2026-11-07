import type { Cell, Offer, OfferEvent } from "./fortebet.functions";

export type DateKey = "ALL" | "TODAY" | "TOMORROW" | "H1" | "H3" | "H6" | "CAL";
export const DATE_FILTERS: { key: DateKey; label: string }[] = [
  { key: "TODAY", label: "Today" },
  { key: "TOMORROW", label: "Tomorrow" },
  { key: "ALL", label: "All" },
  { key: "H1", label: "1 Hour" },
  { key: "H3", label: "3 Hours" },
];
export const ODDS_MIN = 1;
export const ODDS_MAX = 1000;
export const SEARCH_MIN = 3;

export type Filters = {
  q: string;
  date: DateKey;
  cal: string; // YYYY-MM-DD for CAL
  min: number;
  max: number;
  tours: string[]; // checked tournament ids
};

export const DEFAULT_FILTERS: Filters = { q: "", date: "ALL", cal: "", min: ODDS_MIN, max: ODDS_MAX, tours: [] };

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Start time filter, evaluated in the visitor's local time like the reference site. */
export function passDate(startIso: string, date: DateKey, cal: string, now = Date.now()) {
  const t = Date.parse(startIso);
  const today = dayStart(new Date(now));
  const DAY = 864e5;
  switch (date) {
    case "TODAY":
      return t < today + DAY;
    case "TOMORROW":
      return t >= today + DAY && t < today + 2 * DAY;
    case "H1":
      return t <= now + 36e5;
    case "H3":
      return t <= now + 3 * 36e5;
    case "H6":
      return t <= now + 6 * 36e5;
    case "CAL": {
      if (!cal) return true;
      const [y, m, d] = cal.split("-").map(Number);
      const s = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime();
      return t >= s && t < s + DAY;
    }
    default:
      return true;
  }
}

/** Odds range: an event passes when any of its first three main odds is inside [min, max]. Live events are never filtered. */
export function passOdds(cells: Cell[], min: number, max: number, live = false) {
  if (live) return true;
  if (min <= ODDS_MIN && max >= ODDS_MAX) return true;
  return cells.slice(0, 3).some((c) => c != null && !c.l && c.v >= min && c.v <= max);
}

export function isFiltered(f: Filters) {
  return f.date !== "ALL" || f.min > ODDS_MIN || f.max < ODDS_MAX || f.tours.length > 0;
}

export function searchEvents(offer: Offer, q: string, limit = 30): OfferEvent[] {
  const s = q.trim().toLowerCase();
  if (s.length < SEARCH_MIN) return [];
  const tours = new Map(offer.tournaments.map((t) => [t.id, t]));
  const cats = new Map(offer.categories.map((c) => [c.id, c]));
  const out: OfferEvent[] = [];
  for (const e of offer.events) {
    const t = tours.get(e.t);
    const c = t ? cats.get(t.categoryId) : undefined;
    const hay = `${e.h} ${e.a} ${t?.name ?? ""} ${c?.name ?? ""}`.toLowerCase();
    if (hay.includes(s)) out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

export function applyFilters(events: OfferEvent[], f: Filters, live = false, now = Date.now()) {
  const tours = f.tours.length ? new Set(f.tours) : null;
  return events.filter(
    (e) => (!tours || tours.has(e.t)) && (live || passDate(e.s, f.date, f.cal, now)) && passOdds(e.c, f.min, f.max, live),
  );
}

/** Favourite (lowest) of the home/away win odds. */
export function favOdds(e: OfferEvent) {
  const xs = [e.c[0], e.c[e.c.length >= 3 ? 2 : 1]].filter((c): c is NonNullable<Cell> => !!c && !c.l).map((c) => c.v);
  return xs.length ? Math.min(...xs) : Infinity;
}

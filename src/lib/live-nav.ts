import type { Offer, OfferEvent } from "@/lib/fortebet.functions";
import type { VirtualMatch } from "@/lib/virtual-soccer";

export type LiveSportTab = { id: string; name: string; icon: string; count: number };

/** Sport tabs on the live page: only sports with live matches, in Fortebet's sport order, with their match counts. */
export function liveSportTabs(offer: Pick<Offer, "sports" | "events">): LiveSportTab[] {
  const counts = new Map<string, number>();
  for (const e of offer.events) counts.set(e.sp, (counts.get(e.sp) ?? 0) + 1);
  return offer.sports.filter((s) => counts.has(s.id)).map((s) => ({ id: s.id, name: s.name, icon: s.icon, count: counts.get(s.id) ?? 0 }));
}

/** The selected sport if it still has live matches, otherwise the first sport tab. */
export function activeLiveSport(tabs: LiveSportTab[], wanted: string | null): string | null {
  if (wanted && tabs.some((t) => t.id === wanted)) return wanted;
  return tabs[0]?.id ?? null;
}

export type LiveListFilter = { view: "sport" | "selection"; sport: string | null; q: string; favs: string[] };

/**
 * Rows shown on the live page. "My selection" shows starred matches of every sport,
 * otherwise only the active sport. Search (2+ letters) matches team names.
 */
export function filterLiveEvents(events: OfferEvent[], f: LiveListFilter): OfferEvent[] {
  const q = f.q.trim().toLowerCase();
  return events.filter((e) => {
    if (f.view === "selection" ? !f.favs.includes(e.id) : e.sp !== f.sport) return false;
    if (q.length >= 2 && !`${e.h} ${e.a}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Market headings over the live list: main market, plus Double Chance when the sport shows six odds. */
export function liveMarketHeadings(sport: { market: string; cols: string[] } | undefined): [string, string] {
  if (!sport) return ["", ""];
  return [sport.market, sport.cols.length > 3 ? "Double Chance" : ""];
}

/** The virtual match the menu counts down to: the first one that has not kicked off yet. */
export function nextVirtualMatch(matches: VirtualMatch[], now: number): VirtualMatch | undefined {
  return matches.find((m) => Date.parse(m.item_time) > now) ?? matches[0];
}

/** Fortebet's short menu label, e.g. "V-Dortmund" vs "V-Leverkusen" → "Dor-Lev". */
export function virtualNavLabel(m: Pick<VirtualMatch, "home" | "away"> | undefined): string {
  if (!m) return "Virtual";
  const short = (n: string) => n.replace(/^V-/, "").slice(0, 3);
  return `${short(m.home)}-${short(m.away)}`;
}

/** Calendar day tabs (Kampala time): today plus the next four days. */
export function calendarDays(now: number, count = 5): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now + i * 864e5);
    const key = d.toLocaleDateString("en-CA", { timeZone: "Africa/Kampala" });
    const md = d.toLocaleDateString("en-US", { timeZone: "Africa/Kampala", month: "short", day: "2-digit" });
    const wd = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { timeZone: "Africa/Kampala", weekday: "short" });
    out.push({ key, label: `${wd} | ${md}` });
  }
  return out;
}

/** Kampala calendar date (YYYY-MM-DD) of an ISO time. */
export function kampalaDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Kampala" });
}

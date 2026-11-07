import { describe, expect, it } from "vitest";
import { activeLiveSport, calendarDays, filterLiveEvents, liveMarketHeadings, liveSportTabs, nextVirtualMatch, virtualNavLabel } from "@/lib/live-nav";
import type { OfferEvent, OfferSport } from "@/lib/fortebet.functions";
import type { VirtualMatch } from "@/lib/virtual-soccer";

const sport = (id: string, name: string, order: number, cols = ["1", "X", "2", "1X", "12", "X2"]): OfferSport => ({ id, name, icon: name.toLowerCase(), order, count: 0, market: id === "1" ? "Full Time Result" : "Match Winner", cols });
const ev = (id: string, sp: string, h: string, a: string): OfferEvent => ({ id, sp, t: "T", h, a, s: "2026-11-07T08:00:00Z", mc: 5, mk: [], c: [] });

const sports = [sport("1", "Soccer", 1), sport("20", "Table Tennis", 2, ["1", "2"]), sport("5", "Tennis", 3, ["1", "2"])];
const events = [ev("A", "1", "Arsenal", "Hull"), ev("B", "1", "Roma", "Lazio"), ev("C", "20", "Karel F.", "Kus O.")];

describe("live sport tabs", () => {
  it("lists only sports with live matches, in Fortebet order, with counts", () => {
    expect(liveSportTabs({ sports, events })).toEqual([
      { id: "1", name: "Soccer", icon: "soccer", count: 2 },
      { id: "20", name: "Table Tennis", icon: "table tennis", count: 1 },
    ]);
  });
  it("falls back to the first tab when the chosen sport has no live matches", () => {
    const tabs = liveSportTabs({ sports, events });
    expect(activeLiveSport(tabs, "5")).toBe("1");
    expect(activeLiveSport(tabs, "20")).toBe("20");
  });
});

describe("live list filter", () => {
  it("shows only the selected sport", () => {
    expect(filterLiveEvents(events, { view: "sport", sport: "20", q: "", favs: [] }).map((e) => e.id)).toEqual(["C"]);
  });
  it("My selection shows starred matches of every sport", () => {
    expect(filterLiveEvents(events, { view: "selection", sport: "1", q: "", favs: ["C", "A"] }).map((e) => e.id)).toEqual(["A", "C"]);
  });
  it("search needs two letters and matches team names", () => {
    expect(filterLiveEvents(events, { view: "sport", sport: "1", q: "r", favs: [] })).toHaveLength(2);
    expect(filterLiveEvents(events, { view: "sport", sport: "1", q: "ro", favs: [] }).map((e) => e.id)).toEqual(["B"]);
  });
  it("adds the Double Chance heading only for six-odds sports", () => {
    expect(liveMarketHeadings(sports[0])).toEqual(["Full Time Result", "Double Chance"]);
    expect(liveMarketHeadings(sports[1])).toEqual(["Match Winner", ""]);
  });
});

describe("virtual menu item", () => {
  const vm = (id: number, time: string, home: string, away: string) => ({ item_id: id, item_time: time, home, away }) as VirtualMatch;
  const list = [vm(1, "2026-11-07T11:55:00+03:00", "V-Dortmund", "V-Leverkusen"), vm(2, "2026-11-07T12:00:00+03:00", "V-B.Munich", "V-Roma")];
  it("counts down to the first match that has not kicked off", () => {
    expect(nextVirtualMatch(list, Date.parse("2026-11-07T08:54:00Z"))?.item_id).toBe(1);
    expect(nextVirtualMatch(list, Date.parse("2026-11-07T08:56:00Z"))?.item_id).toBe(2);
  });
  it("uses Fortebet's three-letter label", () => {
    expect(virtualNavLabel(list[0])).toBe("Dor-Lev");
    expect(virtualNavLabel(list[1])).toBe("B.M-Rom");
  });
});

describe("live schedule days", () => {
  it("shows today and the next four days in Uganda time", () => {
    const days = calendarDays(Date.parse("2026-11-07T22:30:00Z"));
    expect(days).toHaveLength(5);
    expect(days[0]).toEqual({ key: "2026-11-08", label: "Today | Nov 08" });
    expect(days[1]?.label).toBe("Tomorrow | Nov 09");
    expect(days[2]?.label).toBe("Tue | Nov 10");
  });
});

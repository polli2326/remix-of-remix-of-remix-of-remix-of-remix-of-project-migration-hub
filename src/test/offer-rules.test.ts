import { describe, expect, it } from "vitest";
import { passDate, passOdds, applyFilters, DEFAULT_FILTERS } from "@/lib/offer-filters";
import { possibleWin, stakeError, vipPoints, TICKET_RULES } from "@/lib/ticket";
import { applyDelta, getOdd, seedOdds } from "@/lib/odds-feed";

const cells = (a: number, x: number, b: number) => [{ id: 1, v: a }, { id: 2, v: x }, { id: 3, v: b }];

describe("odds range", () => {
  it("passes when any of the first three odds is inside the range", () => {
    expect(passOdds(cells(1.2, 5, 9), 4, 6)).toBe(true);
  });
  it("fails when none of the first three odds is inside the range", () => {
    expect(passOdds([...cells(1.2, 7, 9), { id: 4, v: 5 }], 4, 6)).toBe(false);
  });
  it("never filters live matches", () => {
    expect(passOdds(cells(1.2, 7, 9), 4, 6, true)).toBe(true);
  });
});

describe("date filters", () => {
  const now = new Date(2026, 10, 6, 10, 0).getTime();
  const at = (h: number, d = 6) => new Date(2026, 10, d, h, 0).toISOString();
  it("Today keeps today and drops tomorrow", () => {
    expect(passDate(at(22), "TODAY", "", now)).toBe(true);
    expect(passDate(at(1, 7), "TODAY", "", now)).toBe(false);
  });
  it("Tomorrow keeps only tomorrow", () => {
    expect(passDate(at(1, 7), "TOMORROW", "", now)).toBe(true);
    expect(passDate(at(22), "TOMORROW", "", now)).toBe(false);
  });
  it("3 Hours keeps matches starting within 3 hours", () => {
    expect(passDate(at(12), "H3", "", now)).toBe(true);
    expect(passDate(at(14), "H3", "", now)).toBe(false);
  });
  it("calendar keeps only the chosen day", () => {
    expect(passDate(at(15, 9), "CAL", "2026-11-09", now)).toBe(true);
    expect(passDate(at(15, 8), "CAL", "2026-11-09", now)).toBe(false);
  });
  it("checked leagues limit the list", () => {
    const ev = (id: string, t: string) => ({ id, sp: "1", t, h: "A", a: "B", s: at(12), mc: 1, mk: [], c: cells(2, 3, 4) });
    const out = applyFilters([ev("E1", "TO17"), ev("E2", "TO8")], { ...DEFAULT_FILTERS, tours: ["TO8"] }, false, now);
    expect(out.map((e) => e.id)).toEqual(["E2"]);
  });
});

describe("ticket rules", () => {
  it("stake must be between 1,000 and 5,000,000 UGX", () => {
    expect(stakeError(999)).not.toBeNull();
    expect(stakeError(1000)).toBeNull();
    expect(stakeError(5_000_001)).not.toBeNull();
  });
  it("possible win is capped at 1,000,000,000 UGX", () => {
    expect(possibleWin(2000, 3.5)).toBe(7000);
    expect(possibleWin(5_000_000, 1000)).toBe(TICKET_RULES.MAX_WIN);
  });
  it("VIP points follow the selection-count levels", () => {
    expect(vipPoints(10_000, 1, 2)).toBe(10);
    expect(vipPoints(10_000, 3, 5)).toBe(20);
    expect(vipPoints(10_000, 16, 50)).toBe(100);
  });
});

describe("live odds feed", () => {
  it("applies odds updates and locks from the socket", () => {
    seedOdds([{ id: 900, v: 1.5 }], 1000);
    applyDelta({ live: { update: { odds: { "900": { odds: 1.65 } } } } }, 2000);
    expect(getOdd(900)?.v).toBe(1.65);
    applyDelta({ live: { update: { odds: { "900": { locked: 1 } } } } }, 3000);
    expect(getOdd(900)?.l).toBe(true);
  });
  it("ignores older snapshot values", () => {
    seedOdds([{ id: 901, v: 2 }], 5000);
    seedOdds([{ id: 901, v: 1.1 }], 4000);
    expect(getOdd(901)?.v).toBe(2);
  });
});

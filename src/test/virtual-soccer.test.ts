import { describe, expect, it } from "vitest";
import { kickoffCountdown, virtualOddLabel, virtualClock, toggleVirtualPick, type VirtualPick } from "../lib/virtual-soccer";

describe("virtual soccer display rules", () => {
  it("displays Uganda time regardless of the visitor's computer timezone", () => {
    expect(virtualClock(Date.parse("2026-11-06T13:13:00Z"))).toBe("16:13:00");
  });
  it("toggles the same outcome and replaces a different outcome for the same match", () => {
    const pick: VirtualPick = { matchId: 1097814, dailyId: 192, home: "V-Sporting", away: "V-Benfica", start: "2026-11-06T16:10:00+03:00", market: "FULL TIME RESULT", odd: { id: 1, odds_name: "1", odds_val: 2.5 } };
    expect(toggleVirtualPick([], pick)).toEqual([pick]);
    expect(toggleVirtualPick([pick], pick)).toEqual([]);
    const other = { ...pick, odd: { id: 3, odds_name: "2", odds_val: 2.75 } };
    expect(toggleVirtualPick([pick], other)).toEqual([other]);
  });
  it("counts down to the actual feed kickoff rather than a fixed five-minute loop", () => {
    expect(kickoffCountdown("2026-11-06T16:10:00+03:00", Date.parse("2026-11-06T13:06:43Z"))).toBe("03:17");
    expect(kickoffCountdown("2026-11-06T16:10:00+03:00", Date.parse("2026-11-06T13:10:01Z"))).toBe("00:00");
  });
  it("labels outcome 28 as any other result despite the feed's duplicated score name", () => {
    expect(virtualOddLabel({ id: 28, odds_name: "2:0", odds_val: 4.35 })).toBe("Any other result");
    expect(virtualOddLabel({ id: 20, odds_name: "2:0", odds_val: 10 })).toBe("2:0");
  });
});
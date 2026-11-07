export type VirtualOdd = { id: number; odds_name: string; odds_val: number };
export type VirtualMatch = {
  item_id: number; item_daily_id: number; item_status: number; item_time: string;
  home: string; away: string; item_league: string;
  odds: Record<string, { id: number; type: string; odds: Record<string, VirtualOdd> }>;
};
export type VirtualResult = {
  id: number; daily_id: number; home: string; away: string;
  result_ft: { home: number; away: number }; result_ht: { home: number; away: number };
};
export type VirtualOffer = { at: string; matches: VirtualMatch[]; results: VirtualResult[]; error: string | null };
export type VirtualPick = { matchId: number; dailyId: number; home: string; away: string; start: string; market: string; odd: VirtualOdd };

export function toggleVirtualPick(picks: VirtualPick[], pick: VirtualPick) {
  const same = picks.some(p => p.matchId === pick.matchId && p.odd.id === pick.odd.id);
  const remaining = picks.filter(p => p.matchId !== pick.matchId);
  return same ? remaining : [...remaining, pick];
}

export function virtualClock(now: number) {
  return new Date(now).toLocaleTimeString("en-GB", { timeZone: "Africa/Kampala", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function kickoffCountdown(start: string | undefined, now: number) {
  const target = start ? Date.parse(start) : NaN;
  if (!Number.isFinite(target)) return "--:--";
  const seconds = Math.max(0, Math.ceil((target - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function virtualOddLabel(odd: VirtualOdd) {
  if (odd.id === 28) return "Any other result";
  if (odd.id === 29 || odd.id === 31) return "Yes";
  if (odd.id === 30 || odd.id === 32) return "No";
  return odd.odds_name.replace(/^U(?=\d)/, "Under ").replace(/^O(?=\d)/, "Over ");
}
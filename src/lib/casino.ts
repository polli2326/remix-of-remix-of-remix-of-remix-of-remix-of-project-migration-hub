import type { CasinoGame } from "@/lib/fortebet.functions";

export const CASINO_PROVIDERS = [
  { key: "all", label: "All providers", icon: "all_providers", provider: null },
  { key: "apollo_casino", label: "Apollo Casino", icon: "apollo_casino", provider: "Apollo Casino" },
  { key: "pragmatic_play", label: "Pragmatic", icon: "pragmatic_play", provider: "Pragmatic Play" },
  { key: "spribe", label: "Spribe", icon: "spribe", provider: "Spribe" },
  { key: "fortebet", label: "Fortebet", icon: "fortebet", provider: "Fortebet" },
] as const;

export const CASINO_CATEGORIES = [
  { key: "all", label: "All Games", icon: "all_games", tag: null },
  { key: "crash", label: "Crash Games", icon: "crash", tag: "crash" },
  { key: "slots", label: "Slots", icon: "slots", tag: "slots" },
  { key: "wheel", label: "Wheel Games", icon: "wheel", tag: "wheel" },
  { key: "jackpot", label: "Jackpot Games", icon: "jackpot", tag: "jackpot" },
  { key: "virtual_sports", label: "Virtual Sports", icon: "virtual_sports", tag: "virtual sports" },
  { key: "table_and_cards", label: "Table / Cards", icon: "table_and_cards", tag: "table and cards" },
  { key: "buy_bonus", label: "Buy Bonus", icon: "buy_bonus", tag: "buy bonus" },
  { key: "fast", label: "Fast Games", icon: "fast", tag: "fast" },
  { key: "numbers", label: "Numbers", icon: "numbers", tag: "numbers" },
  { key: "plinko", label: "Plinko", icon: "plinko", tag: "plinko" },
] as const;

export type CasinoFilter = { provider: string; category: string; q: string };
export const DEFAULT_CASINO_FILTER: CasinoFilter = { provider: "all", category: "all", q: "" };

const byOrder = (a: CasinoGame, b: CasinoGame) => a.sortOrder - b.sortOrder || a.id - b.id;

/** "Most popular games": games Fortebet marks as web-preferred, in that order, topped up from the normal order to 12. */
export function popularGames(games: CasinoGame[], max = 12): CasinoGame[] {
  const pref = games.filter((g) => g.popular != null).sort((a, b) => a.popular! - b.popular! || a.id - b.id).slice(0, max);
  if (pref.length >= max) return pref;
  const ids = new Set(pref.map((g) => g.id));
  return [...pref, ...games.filter((g) => !ids.has(g.id)).sort(byOrder).slice(0, max - pref.length)];
}

export function isFiltered(f: CasinoFilter) {
  return f.provider !== "all" || f.category !== "all" || f.q.trim() !== "";
}

/** Main games grid. With no filter, popular games are already shown above and are left out. */
export function filterGames(games: CasinoGame[], f: CasinoFilter): CasinoGame[] {
  const prov = CASINO_PROVIDERS.find((p) => p.key === f.provider)?.provider ?? null;
  const tag = CASINO_CATEGORIES.find((c) => c.key === f.category)?.tag ?? null;
  const q = f.q.trim().toLowerCase();
  const popular = new Set(isFiltered(f) ? [] : popularGames(games).map((g) => g.id));
  return games
    .filter((g) => !popular.has(g.id))
    .filter((g) => !prov || g.provider === prov)
    .filter((g) => !tag || g.tags.includes(tag))
    .filter((g) => !q || g.name.toLowerCase().includes(q) || g.ident.toLowerCase().includes(q))
    .sort(byOrder);
}

/** Categories / providers that still have games under the other active filters (the rest are greyed out). */
export function availableKeys(games: CasinoGame[], f: CasinoFilter) {
  const providers = new Set<string>(["all"]);
  const categories = new Set<string>(["all"]);
  for (const p of CASINO_PROVIDERS) if (p.provider && filterGames(games, { ...f, provider: p.key }).length) providers.add(p.key);
  for (const c of CASINO_CATEGORIES) if (c.tag && filterGames(games, { ...f, category: c.key }).length) categories.add(c.key);
  return { providers, categories };
}

/** Fortebet's jackpot counter: it climbs from (value − 60 s × speed) up to value over 60 seconds. */
export const JACKPOT_CYCLE_MS = 60_000;
export function jackpotStart(value: number, speed: number) {
  return Math.max(0, value - 60 * Math.max(0, speed));
}
/** Counter value `elapsed` ms after it started moving from `from` towards `to`. A lower new value jumps straight down. */
export function jackpotCounter(from: number, to: number, elapsed: number) {
  if (to <= from) return to;
  return from + (to - from) * Math.min(1, Math.max(0, elapsed) / JACKPOT_CYCLE_MS);
}

// Four bet slips shared by every page, kept in the visitor's browser.
import { useSyncExternalStore } from "react";
import { TICKET_RULES } from "./ticket";

export type Sel = {
  key: string; // odds id as string
  oddsId: number;
  eventId: string;
  match: string;
  market: string;
  outcome: string;
  odds: number; // odds the player accepted
  at: number; // when they were accepted
  live: boolean;
  start: string;
  league?: string | undefined;
};

type State = { tickets: Sel[][]; stakes: number[]; active: number };
const KEY = "fb-tickets-v2";
const EMPTY: State = { tickets: [[], [], [], []], stakes: [2000, 2000, 2000, 2000], active: 0 };
let state: State = EMPTY;
let loaded = false;
const ls = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw?.tickets?.length === 4) state = { ...EMPTY, ...raw };
  } catch {
    /* ignore */
  }
}
function set(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  for (const l of ls) l();
}
const sub = (l: () => void) => {
  ls.add(l);
  return () => ls.delete(l);
};
const snap = () => {
  load();
  return state;
};

function upd(fn: (s: Sel[]) => Sel[]) {
  set({ ...state, tickets: state.tickets.map((t, i) => (i === state.active ? fn(t) : t)) });
}

export function useSels() {
  const s = useSyncExternalStore(sub, snap, () => EMPTY);
  const sels = s.tickets[s.active] ?? [];
  return {
    sels,
    active: s.active,
    counts: s.tickets.map((t) => t.length),
    stake: s.stakes[s.active] ?? TICKET_RULES.DEFAULT_STAKE,
    setActive: (i: number) => set({ ...state, active: i }),
    setStake: (v: number) => set({ ...state, stakes: state.stakes.map((x, i) => (i === state.active ? v : x)) }),
    /** One pick per match: picking another outcome of the same match replaces it. */
    toggle: (sel: Sel) =>
      upd((t) => {
        if (t.some((x) => x.key === sel.key)) return t.filter((x) => x.key !== sel.key);
        const rest = t.filter((x) => x.eventId !== sel.eventId);
        if (rest.length >= TICKET_RULES.MAX_ITEMS) return t;
        const idx = t.findIndex((x) => x.eventId === sel.eventId);
        if (idx >= 0) {
          const copy = [...t];
          copy[idx] = sel;
          return copy;
        }
        return [...rest, sel];
      }),
    remove: (k: string) => upd((t) => t.filter((x) => x.key !== k)),
    clear: () => upd(() => []),
    accept: (cur: Record<string, number>) => upd((t) => t.map((x) => (cur[x.key] != null ? { ...x, odds: cur[x.key]!, at: Date.now() } : x))),
  };
}
export type Slip = ReturnType<typeof useSels>;

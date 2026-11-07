import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_FILTERS, type Filters } from "@/lib/offer-filters";

export type View =
  | { kind: "landing" }
  | { kind: "sport"; sportId: string }
  | { kind: "focus"; id: string; live: boolean }
  | { kind: "favMatches" }
  | { kind: "favTeams" };

type Favs = { leagues: string[]; matches: string[]; teams: string[] };
const FAV_KEY = "fb-favs-v1";

type Ctx = {
  f: Filters;
  set: (p: Partial<Filters>) => void;
  setTours: (ids: string[], on: boolean) => void;
  view: View;
  setView: (v: View) => void;
  favs: Favs;
  toggleFav: (k: keyof Favs, id: string) => void;
};

const C = createContext<Ctx | null>(null);

export function OfferFilterProvider({ children }: { children: ReactNode }) {
  const [f, setF] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<View>({ kind: "landing" });
  const [favs, setFavs] = useState<Favs>({ leagues: [], matches: [], teams: [] });
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(FAV_KEY) ?? "null");
      if (raw) setFavs({ leagues: raw.leagues ?? [], matches: raw.matches ?? [], teams: raw.teams ?? [] });
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo<Ctx>(
    () => ({
      f,
      set: (p) => setF((x) => ({ ...x, ...p })),
      setTours: (ids, on) =>
        setF((x) => {
          const s = new Set(x.tours);
          for (const id of ids) (on ? s.add(id) : s.delete(id));
          return { ...x, tours: [...s] };
        }),
      view,
      setView,
      favs,
      toggleFav: (k, id) =>
        setFavs((x) => {
          const list = x[k].includes(id) ? x[k].filter((y) => y !== id) : [...x[k], id];
          const next = { ...x, [k]: list };
          try {
            localStorage.setItem(FAV_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          return next;
        }),
    }),
    [f, view, favs],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}

const FALLBACK: Ctx = {
  f: DEFAULT_FILTERS,
  set: () => {},
  setTours: () => {},
  view: { kind: "landing" },
  setView: () => {},
  favs: { leagues: [], matches: [], teams: [] },
  toggleFav: () => {},
};

export function useOfferFilters() {
  return useContext(C) ?? FALLBACK;
}

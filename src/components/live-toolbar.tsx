import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { liveQuery } from "@/components/fortebet-live";
import { activeLiveSport, liveSportTabs } from "@/lib/live-nav";

// ---------- Shared live-page state (toolbar + list read the same values) ----------
type LiveState = { view: "sport" | "selection"; sport: string | null; q: string; favs: string[] };
const FAV_KEY = "fb-favs-v1";
let state: LiveState = { view: "sport", sport: null, q: "", favs: [] };
let loaded = false;
const subs = new Set<() => void>();
const SERVER_STATE = state;

function emit(next: Partial<LiveState>) {
  state = { ...state, ...next };
  subs.forEach((f) => f());
}

function loadFavs() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) ?? "null");
    if (Array.isArray(raw?.matches)) emit({ favs: raw.matches });
  } catch {
    /* ignore */
  }
}

export function useLiveState() {
  useEffect(loadFavs, []);
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f); },
    () => state,
    () => SERVER_STATE,
  );
}

export const liveActions = {
  sport: (sport: string) => emit({ view: "sport", sport }),
  selection: () => emit({ view: "selection" }),
  search: (q: string) => emit({ q }),
  toggleFav: (id: string) => {
    const favs = state.favs.includes(id) ? state.favs.filter((x) => x !== id) : [...state.favs, id];
    emit({ favs });
    try {
      const raw = JSON.parse(localStorage.getItem(FAV_KEY) ?? "null") ?? {};
      localStorage.setItem(FAV_KEY, JSON.stringify({ leagues: [], teams: [], ...raw, matches: favs }));
    } catch {
      /* ignore */
    }
  },
};

const Ico = ({ id, cls }: { id: string; cls: string }) => (
  <icon {...({ classname: cls } as any)}><svg className={`${cls} align-middle`} viewBox="0 0 100 100"><use xlinkHref={`#${id}`} /></svg></icon>
);

/** Live toolbar like fortebet.ug: search, My selection, one tab per live sport with counts, Schedule. */
export function LiveToolbar() {
  const { data } = useQuery(liveQuery);
  const s = useLiveState();
  const nav = useNavigate();
  const path = useLocation({ select: (l) => l.pathname });
  const onCalendar = path.startsWith("/live/calendar");
  const onList = path === "/live/preview";
  const tabs = useMemo(() => (data ? liveSportTabs(data) : []), [data]);
  const sport = activeLiveSport(tabs, s.sport);
  const [searchOpen, setSearchOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const toList = () => { if (!onList) void nav({ to: "/live/preview" }); };
  const favCount = data ? data.events.filter((e) => s.favs.includes(e.id)).length : 0;
  const open = searchOpen || s.q !== "";

  return (
    <div className="live__head">
      <div className="[transition:width_0.2s_ease-in-out]" style={{ minWidth: "calc(39px * var(--factor))", width: open ? "calc(195px * var(--factor))" : undefined }}>
        <div data-ce="offer-search">
          <div className={`searchOffer [font-weight:700] ${open ? "open" : ""}`}>
            <input ref={input} id="searchInputEl" name="searchOffer" type="text" placeholder="Looking for something?" autoComplete="off"
              value={s.q} onFocus={() => setSearchOpen(true)} onBlur={() => setSearchOpen(false)}
              onChange={(e) => { liveActions.search(e.target.value); toList(); }}
              onKeyDown={(e) => { if (e.key === "Escape") { liveActions.search(""); input.current?.blur(); } }} />
            {s.q ? (
              <label className="curPointer" aria-label="Clear search" onMouseDown={(e) => { e.preventDefault(); liveActions.search(""); }} style={{ color: "rgb(0,166,90)", fontWeight: 900 }}>✕</label>
            ) : (
              <label htmlFor="searchInputEl"><Ico id="icoGlass" cls="current h20" /></label>
            )}
          </div>
        </div>
      </div>
      <div data-ce="offer-sport-filter">
        <div className="head baseLeft">
          <innerscroll>
            <div>
              <div className={!onCalendar && s.view === "selection" ? "active" : ""}>
                <a className="curPointer" onClick={() => { liveActions.selection(); toList(); }}>
                  <Ico id="icoClientStarfull" cls="gold h13" /> My selection <span className="counter items-center justify-center text-center [height:calc(18px_*_var(--factor))] [right:calc(10px_*_var(--factor))]!">{favCount}</span>
                </a>
              </div>
              {tabs.map((t) => (
                <div key={t.id} className={!onCalendar && s.view === "sport" && t.id === sport ? "active" : ""}>
                  <a className="curPointer" onClick={() => { liveActions.sport(t.id); toList(); }}>
                    {" "}{t.name} <span className="counter items-center justify-center text-center [height:calc(18px_*_var(--factor))] [right:calc(10px_*_var(--factor))]!">{t.count}</span>
                  </a>
                </div>
              ))}
            </div>
          </innerscroll>
          <div className={`wmc [font-weight:700] ${onCalendar ? "active" : ""}`}>
            <a href="/live/calendar"><Ico id="icoCalendar" cls="current h12" /> Schedule </a>
          </div>
        </div>
      </div>
    </div>
  );
}

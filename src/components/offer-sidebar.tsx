import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useOffer, fmtTime } from "@/components/fortebet-live";
import { useOfferFilters } from "@/components/offer-context";
import { DATE_FILTERS, ODDS_MAX, ODDS_MIN, SEARCH_MIN, searchEvents } from "@/lib/offer-filters";

function Icon({ href, cls = "current h20" }: { href: string; cls?: string }) {
  return <svg className={`${cls} align-middle`} viewBox="0 0 100 100"><use xlinkHref={href} /></svg>;
}

function highlight(text: string, q: string): ReactNode {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (!q || i < 0) return text;
  return <>{text.slice(0, i)}<span className="serachHighlight">{text.slice(i, i + q.length)}</span>{text.slice(i + q.length)}</>;
}

export function OfferSearch() {
  const { data } = useOffer(false);
  const live = useOffer(true);
  const { f, set, setView } = useOfferFilters();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const results = useMemo(() => {
    const out: { e: ReturnType<typeof searchEvents>[number]; live: boolean; league: string; icon: string }[] = [];
    for (const [o, isLive] of [[live.data, true], [data, false]] as const) {
      if (!o) continue;
      const tours = new Map(o.tournaments.map((t) => [t.id, t]));
      const cats = new Map(o.categories.map((c) => [c.id, c]));
      for (const e of searchEvents(o, f.q, 30)) {
        if (out.some((x) => x.e.id === e.id)) continue;
        const t = tours.get(e.t);
        out.push({ e, live: isLive, league: `${t ? cats.get(t.categoryId)?.name ?? "" : ""} - ${t?.name ?? ""}`, icon: o.sports.find((s) => s.id === e.sp)?.icon ?? "soccer" });
      }
    }
    return out.slice(0, 30);
  }, [data, live.data, f.q]);
  const q = f.q.trim();
  return (
    <div data-ce="offer-search" ref={box}>
      <div className="searchOffer">
        <input id="searchInputEl" name="searchOffer" type="text" placeholder="Looking for something?" autoComplete="off" value={f.q}
          onChange={(e) => { set({ q: e.target.value }); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)} />
        <label htmlFor="searchInputEl">
          {f.q ? (
            <a className="curPointer" aria-label="Clear search" onClick={() => { set({ q: "" }); setOpen(false); }} style={{ position: "absolute", right: 8, top: 4, color: "rgb(0,166,90)", fontSize: 18, fontWeight: 900 }}>✕</a>
          ) : <icon {...({ href: "#icoGlass", classname: "current h20" } as any)}><Icon href="#icoGlass" /></icon>}
        </label>
        {open && q.length > 0 && (
          <div className="results" style={{ zIndex: 50, maxHeight: 420, overflowY: "auto" }}>
            {q.length < SEARCH_MIN ? <div className="no-results">Type at least {SEARCH_MIN} letters</div>
              : results.length === 0 ? <div className="no-results">No results</div>
              : results.map(({ e, live: isLive, league, icon }) => {
                const t = fmtTime(e.s);
                return (
                  <a key={e.id} className="curPointer" onClick={() => { setView({ kind: "focus", id: e.id, live: isLive }); setOpen(false); }}>
                    <small><span>{league}</span><span>{isLive ? <b style={{ color: "rgb(0,166,90)" }}>LIVE</b> : <><b>{t.day}</b> | {t.time}</>}</span></small>
                    <strong><span className={`ico ${icon} h12`} /> {highlight(e.h, q)} - {highlight(e.a, q)}</strong>
                  </a>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

export function DateFilter() {
  const { f, set } = useOfferFilters();
  const [cal, setCal] = useState(false);
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return (
    <div data-ce="offer-date-filter" style={{ position: "relative" }}>
      <div className="time [gap:calc(1px_*_var(--factor))]">
        {DATE_FILTERS.map((d) => (
          <a key={d.key} className={`curPointer ${f.date === d.key ? "active" : ""}`} onClick={() => { set({ date: d.key, cal: "" }); setCal(false); }}> {d.label} </a>
        ))}
        <a id="filterCalIcon" className={`curPointer ${f.date === "CAL" ? "active" : ""}`} aria-label="Pick a day" onClick={() => setCal((x) => !x)}>
          <icon {...({ href: "#icoCalendar", classname: "current h16" } as any)}><Icon href="#icoCalendar" cls="current h16" /></icon>
        </a>
      </div>
      {cal && (
        <div style={{ position: "absolute", zIndex: 40, top: "100%", left: 0, right: 0, background: "#3d3f49", padding: 8, borderRadius: 6, marginTop: 4, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, boxShadow: "0 6px 20px rgba(0,0,0,.5)" }}>
          {days.map((d) => {
            const v = iso(d);
            const on = f.date === "CAL" && f.cal === v;
            return (
              <a key={v} className="curPointer" onClick={() => { set({ date: "CAL", cal: v }); setCal(false); }}
                style={{ textAlign: "center", padding: "5px 0", borderRadius: 4, fontSize: 11, fontWeight: 700, background: on ? "rgb(206,166,66)" : "#2a2c33", color: on ? "#20222c" : "#c9c9cb" }}>
                {d.toLocaleDateString("en-US", { weekday: "short" })}<br />{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// slider maps 0..1 to odds 1..1000 on a log scale so low odds get most of the track
const toOdds = (p: number) => Math.round(Math.exp(Math.log(ODDS_MIN) + p * (Math.log(ODDS_MAX) - Math.log(ODDS_MIN))) * 100) / 100;
const toPos = (v: number) => (Math.log(Math.max(ODDS_MIN, v)) - Math.log(ODDS_MIN)) / (Math.log(ODDS_MAX) - Math.log(ODDS_MIN));

export function OddsRange() {
  const { f, set } = useOfferFilters();
  const [open, setOpen] = useState(false);
  const [minT, setMinT] = useState(String(f.min));
  const [maxT, setMaxT] = useState(String(f.max));
  useEffect(() => { setMinT(String(f.min)); setMaxT(String(f.max)); }, [f.min, f.max]);
  const line = useRef<HTMLDivElement>(null);
  const drag = (which: "min" | "max") => (e: React.PointerEvent) => {
    e.preventDefault();
    const el = line.current;
    if (!el) return;
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      const v = toOdds(p);
      if (which === "min") set({ min: Math.min(v, f.max) });
      else set({ max: Math.max(v, f.min) });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const commit = () => {
    let a = Number(minT) || ODDS_MIN;
    let b = Number(maxT) || ODDS_MAX;
    a = Math.min(Math.max(a, ODDS_MIN), ODDS_MAX);
    b = Math.min(Math.max(b, ODDS_MIN), ODDS_MAX);
    if (a > b) [a, b] = [b, a];
    set({ min: a, max: b });
  };
  const leftSet = f.min > ODDS_MIN;
  const rightSet = f.max < ODDS_MAX;
  const l = toPos(f.min) * 100;
  const r = (1 - toPos(f.max)) * 100;
  return (
    <div data-ce="offer-odds-range-filter">
      <div className={`oddsRange ${leftSet ? "leftSet" : ""} ${rightSet ? "rightSet" : ""}`}>
        <div className="buttons [gap:calc(5px_*_var(--factor))] [transition:0.3s]">
          <a className="clearRange" id="oddsRangeReset" onClick={() => set({ min: ODDS_MIN, max: ODDS_MAX })} style={leftSet || rightSet ? { opacity: 1, cursor: "pointer" } : undefined}>Reset range</a>
          <a className="collapseButton curPointer" aria-label="Show odds range" onClick={() => setOpen((x) => !x)}>
            <icon {...({ href: "#icoArrowSimple" } as any)}><svg className={`h16 ${open ? "" : "t180"} align-middle`} viewBox="0 0 100 100"><use xlinkHref="#icoArrowSimple" /></svg></icon>
          </a>
        </div>
        <h3 className="curPointer" onClick={() => setOpen((x) => !x)}>Odds range</h3>
        <div className={`oddsRangeContent ${open ? "" : "oddsRangeContent--collapsed"}`}>
          <div className="oddsSliderLine" ref={line}>
            <div style={{ left: `${l}%`, right: `${r}%` }}>
              <span id="oddsSliderLeft" onPointerDown={drag("min")} style={{ touchAction: "none", cursor: "grab" }} />
              <span id="oddsSliderRight" onPointerDown={drag("max")} style={{ touchAction: "none", cursor: "grab" }} />
            </div>
          </div>
          <div className="oddsRangeValues">
            <div>
              <input type="text" id="oddsRangeMin" inputMode="decimal" value={minT} onChange={(e) => setMinT(e.target.value.replace(/[^\d.]/g, ""))} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
              <label htmlFor="oddsRangeMin">Min.</label>
            </div>
            <div>
              <input type="text" id="oddsRangeMax" inputMode="decimal" value={maxT} onChange={(e) => setMaxT(e.target.value.replace(/[^\d.]/g, ""))} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
              <label htmlFor="oddsRangeMax">Max.</label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TopBetsList() {
  const { data } = useOffer(false);
  const { f, setTours, setView } = useOfferFilters();
  if (!data) return <ul className="topbets"><li><a> Loading…</a></li></ul>;
  const sel = new Set(f.tours);
  const live = new Set(data.tournaments.map((t) => t.id));
  const groups = data.top.map((g) => ({ ...g, ids: g.ids.filter((id) => live.has(id)) })).filter((g) => g.ids.length);
  const multi = groups.filter((g) => g.ids.length > 1);
  const single = groups.filter((g) => g.ids.length === 1);
  const row = (g: { name: string; ids: string[] }, i: number, white: boolean) => {
    const on = g.ids.every((id) => sel.has(id));
    const flip = () => { setTours(g.ids, !on); setView({ kind: "landing" }); };
    return (
      <li key={g.name + i}>
        <a className="curPointer" onClick={flip}> {g.name} {white && <span>({g.ids.length}x)</span>}</a>
        <span className="toRight"><input className={`${white ? "white" : ""} items-center justify-center`} type="checkbox" id={`tb${white ? "m" : "s"}${i}`} checked={on} onChange={flip} /><label htmlFor={`tb${white ? "m" : "s"}${i}`} /></span>
      </li>
    );
  };
  return (
    <ul className="topbets">
      {multi.map((g, i) => row(g, i, true))}
      {multi.length > 0 && single.length > 0 && <hr />}
      {single.map((g, i) => row(g, i, false))}
    </ul>
  );
}

export function MySelection() {
  const { data } = useOffer(false);
  const { f, setTours, favs, setView } = useOfferFilters();
  const box = (icon: string, n: number, label: ReactNode, onClick: () => void, extra?: ReactNode) => (
    <div className={`buttons ${n ? "" : "disabled"}`}>
      <a className={n ? "curPointer" : ""} onClick={() => n && onClick()}>
        <strong>{extra ?? <icon {...({ href: icon, classname: "h12" } as any)}><Icon href={icon} cls="h12" /></icon>} {n} </strong>
        <span>{label}</span>
      </a>
    </div>
  );
  const validLeagues = favs.leagues.filter((id) => data?.tournaments.some((t) => t.id === id));
  return (
    <div data-ce="offer-my-selection">
      <div className="mySelection">
        <strong style={{ display: "flex", justifyContent: "space-between" }}>My selection
          {f.tours.length > 0 && <a className="curPointer" aria-label="Clear selection" onClick={() => { setTours(f.tours, false); setView({ kind: "landing" }); }}>🗑</a>}
        </strong>
        <div className="list">
          {box("#icoFlag", validLeagues.length, <>My favorite<br /> leagues</>, () => { setTours(validLeagues, true); setView({ kind: "landing" }); })}
          {box("#icoStar", favs.matches.length, <>My favorite<br /> matches</>, () => setView({ kind: "favMatches" }))}
          {box("#icoHeart", favs.teams.length, <>My favorite<br /> teams</>, () => setView({ kind: "favTeams" }))}
          {box("", f.tours.length, <>My current<br /> selection</>, () => setView({ kind: "landing" }), <span className="favSquare" />)}
        </div>
      </div>
    </div>
  );
}

export function SportsList() {
  const { data } = useOffer(false);
  const { f, setTours, setView } = useOfferFilters();
  const [openSport, setOpenSport] = useState<string | null>(null);
  const [openCats, setOpenCats] = useState<string[]>([]);
  if (!data) return <ul className="events [font-weight:700]"><li><a> Loading…</a></li></ul>;
  const sel = new Set(f.tours);
  const pick = (ids: string[], on: boolean) => { setTours(ids, on); setView({ kind: "landing" }); };
  return (
    <ul className="events [font-weight:700]">
      {data.sports.map((s) => {
        const cats = data.categories.filter((c) => c.sportId === s.id);
        const tIds = data.tournaments.filter((t) => t.sportId === s.id).map((t) => t.id);
        const nSel = tIds.filter((id) => sel.has(id)).length;
        const isOpen = openSport === s.id;
        return (
          <li key={s.id}>
            <a className={`curPointer ${isOpen ? "active" : ""}`} onClick={() => setOpenSport(isOpen ? null : s.id)}><span className={`h16 ico ${s.icon} wp21`} /> {s.name} <small>{s.count}</small></a>
            <span className="toRight" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {nSel > 0 && <><span className="selectCount">{nSel}</span><a className="curPointer" aria-label={`Clear ${s.name}`} onClick={() => pick(tIds, false)} style={{ color: "#cea642", fontWeight: 900 }}>✕</a></>}
              <a className="curPointer" aria-label={`All ${s.name}`} title="Show all" onClick={() => { setView({ kind: "sport", sportId: s.id }); }} style={{ fontSize: 10, color: "#a3a4a8" }}>ALL</a>
            </span>
            {isOpen && (
              <ul>
                {cats.map((c) => {
                  const ts = data.tournaments.filter((t) => t.categoryId === c.id);
                  const ids = ts.map((t) => t.id);
                  const all = ids.length > 0 && ids.every((id) => sel.has(id));
                  const some = ids.some((id) => sel.has(id));
                  const cOpen = openCats.includes(c.id);
                  return (
                    <li key={c.id}>
                      <a className="curPointer" onClick={() => setOpenCats((x) => (cOpen ? x.filter((y) => y !== c.id) : [...x, c.id]))}>
                        <span className={`ico flag ${c.icon}`} /> {c.name} <span className="toShow">({c.count})</span>
                      </a>
                      <span className="toRight"><input type="checkbox" className={some && !all ? "empty" : ""} id={`c${c.id}`} checked={all} onChange={() => pick(ids, !all)} /><label htmlFor={`c${c.id}`} /></span>
                      {cOpen && (
                        <ul>
                          {ts.map((t) => (
                            <li key={t.id}>
                              <a className="curPointer" onClick={() => pick([t.id], !sel.has(t.id))}>{t.name} ({t.count})</a>
                              <span className="toRight"><input type="checkbox" id={`t${t.id}`} checked={sel.has(t.id)} onChange={() => pick([t.id], !sel.has(t.id))} /><label htmlFor={`t${t.id}`} /></span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

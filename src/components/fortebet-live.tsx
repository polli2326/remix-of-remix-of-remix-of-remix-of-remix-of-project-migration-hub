import { Fragment, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { getPrematchOffer, getLiveOffer, getBanners, getEventDetail, getMarketOffer, type Cell, type Offer, type OfferEvent, type QuickFilter } from "@/lib/fortebet.functions";
import { seedOdds, useLiveOdd, useLiveEvent, useFeedVersion, getOdd, isMarketLocked, useOddsFeed } from "@/lib/odds-feed";
import { applyFilters, favOdds } from "@/lib/offer-filters";
import { possibleWin, stakeError, totalOdds, vipPoints, TICKET_RULES } from "@/lib/ticket";
import { useSels, type Sel, type Slip } from "@/lib/tickets-store";
import { useOfferFilters } from "@/components/offer-context";
import { LockIcon, TicketSheet, sheetBtn } from "@/components/ticket-check";

export { useSels };
export type { Sel, Slip };

const G = "rgb(0,166,90)";
const UP = "#22d47e";
const DOWN = "#ff5a5a";

// ---------- Queries ----------
export const prematchQuery = queryOptions({ queryKey: ["fb-pre"], queryFn: () => getPrematchOffer(), refetchInterval: 60_000, staleTime: 30_000 });
export const liveQuery = queryOptions({ queryKey: ["fb-live"], queryFn: () => getLiveOffer(), refetchInterval: 20_000, staleTime: 5_000 });
export const bannersQuery = queryOptions({ queryKey: ["fb-banners"], queryFn: () => getBanners(), staleTime: 300_000 });

export function useOffer(live: boolean, enabled = true) {
  const q = useQuery({ ...(live ? liveQuery : prematchQuery), enabled });
  useEffect(() => {
    if (q.data) seedOdds(q.data.events.flatMap((e) => e.c.filter((c): c is NonNullable<Cell> => !!c)), q.data.at);
  }, [q.data]);
  return q;
}

/** Mount once per page: keeps the real-time odds connection open. */
export function LiveOddsFeed() {
  useOddsFeed();
  return null;
}

export function fmtTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const tom = new Date(now.getTime() + 864e5);
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const day = d.toDateString() === now.toDateString() ? "Today" : d.toDateString() === tom.toDateString() ? "Tomorrow" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { day, time };
}

export function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <> &nbsp; </>;
  const date = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).replace(",", "");
  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return <> {date}, {time} </>;
}

// ---------- Names ----------
const MAIN_NAMES = (short: string, h: string, a: string, market: string): [string, string] => {
  const m: Record<string, [string, string]> = {
    "1": [market, h], X: [market, "Draw"], "2": [market, a],
    "1X": ["Double Chance", `${h} or Draw`], X2: ["Double Chance", `Draw or ${a}`], "12": ["Double Chance", `${h} or ${a}`],
  };
  return m[short] ?? [market, short];
};

/** Lay odds out in the 6-column grid used by the offer. */
export function layout(cells: Cell[], cols: string[]): { cells: Cell[]; cols: string[] } {
  if (cols.length === 2) return { cells: [cells[0] ?? null, null, cells[1] ?? null, null, null, null], cols: [cols[0] ?? "", "", cols[1] ?? "", "", "", ""] };
  const c = [...cells];
  const h = [...cols];
  while (c.length < 6) c.push(null);
  while (h.length < 6) h.push("");
  return { cells: c.slice(0, 6), cols: h.slice(0, 6) };
}

// ---------- Odds button ----------
type OddProps = {
  cell: Cell;
  at: number;
  mk?: number[] | undefined;
  sels: Sel[];
  toggle: (s: Sel) => void;
  info: { eventId: string; match: string; market: string; outcome: string; live: boolean; start: string; league?: string | undefined };
  variant?: "grid" | "chip" | "live";
  label?: string;
  favorite?: boolean;
};

export function OddBtn({ cell, at, mk, sels, toggle, info, variant = "grid", label, favorite }: OddProps) {
  const { v, locked, dir } = useLiveOdd(cell?.id, cell?.v, at, !!cell?.l, mk);
  const on = !!cell && sels.some((s) => s.key === String(cell.id));
  const usable = !!cell && !locked && !!v;
  const click = () => usable && toggle({ key: String(cell!.id), oddsId: cell!.id, odds: v!, at: Date.now(), ...info });
  const arrow = dir ? <span style={{ color: on ? "#fff" : dir === "up" ? UP : DOWN, fontSize: "0.75em", marginLeft: 2 }}>{dir === "up" ? "▲" : "▼"}</span> : null;
  // Any odd without a usable price ("-") is shown as suspended with the padlock.
  const shut = !usable;
  const text = shut ? <LockIcon size={12} /> : v!.toFixed(2);
  const flash: CSSProperties | undefined = dir && !on && !shut ? { boxShadow: `inset 0 0 0 1px ${dir === "up" ? UP : DOWN}` } : undefined;
  if (variant === "chip") {
    return (
      <div className="curPointer" onClick={click} aria-label={shut ? "Suspended" : undefined}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 10px", background: on ? G : shut ? "#25262c" : "#2a2c33", color: on ? "#fff" : shut ? "#8b8d96" : "#e6e6e8", fontWeight: 700, textTransform: "uppercase", cursor: usable ? "pointer" : "not-allowed", ...flash }}>
        <span>{label}</span><b style={{ color: on ? "#fff" : UP, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center" }}>{text}{!shut && arrow}</b>
      </div>
    );
  }
  return (
    <div className={`curPointer ${favorite && !on ? "favorite" : ""} ${on ? "selected" : ""}`} aria-label={shut ? "Suspended" : undefined}
      style={{ ...(on ? { background: G, color: "#fff" } : {}), ...flash, ...(shut ? { background: "#25262c", cursor: "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" } : {}) }}
      onClick={click}>
      {shut ? text : <> {text}{arrow} </>}
    </div>
  );
}

// ---------- Rows ----------
type RowProps = {
  e: OfferEvent;
  at: number;
  cells?: Cell[] | undefined;
  mk?: number[] | undefined;
  cols: string[];
  market: string;
  sels: Sel[];
  toggle: (s: Sel) => void;
  open: () => void;
  stats: () => void;
  live?: boolean;
  league?: string;
};

export function MatchRow({ e, at, cells, mk, cols, market, sels, toggle, open, stats, live = false, league }: RowProps) {
  const t = fmtTime(e.s);
  const ev = useLiveEvent(e.id, { sc: e.sc, st: e.st }, at);
  const { favs, toggleFav } = useOfferFilters();
  const raw = cells ?? e.c;
  const L = layout(raw, cols);
  const fav = cells ? undefined : favOdds(e);
  const favMatch = favs.matches.includes(e.id);
  const favTeam = favs.teams.includes(e.h) || favs.teams.includes(e.a);
  const match = `${e.h} - ${e.a}`;
  return (
    <div className="offerMatch">
      <div className="app-widget-event-set curPointer" onClick={open}>
        <span className="matchName"><span> {e.h} </span> - <span> {e.a} </span>{league && <span className="tooltip">{league}</span>}</span>
        <div><span>
          <span className="ico star h13 deadSpace curPointer" role="button" aria-label="Favourite match" title="Favourite match" style={{ opacity: favMatch ? 1 : 0.6, filter: favMatch ? "drop-shadow(0 0 2px #cea642)" : undefined }} onClick={(x) => { x.stopPropagation(); toggleFav("matches", e.id); }} />
          <span className="liveIco">Live</span>
          <span className="ico chart h13 opa06 deadSpace curPointer" role="button" aria-label="Match statistics" style={{ display: "inline-block", minWidth: 14, minHeight: 13 }} onClick={(x) => { x.stopPropagation(); stats(); }} />
          <span className="ico hearth h13 deadSpace curPointer" role="button" aria-label="Favourite teams" title="Favourite teams" style={{ opacity: favTeam ? 1 : 0.6, filter: favTeam ? "drop-shadow(0 0 2px #cea642)" : undefined }} onClick={(x) => { x.stopPropagation(); toggleFav("teams", e.h); toggleFav("teams", e.a); }} />
        </span></div>
      </div>
      <div className="app-widget-time-set">
        <div>{live || ev.sc ? <><span className="textOrange"> {ev.sc ?? "0:0"} </span> | {ev.st ?? "LIVE"}</> : <><span className="textOrange"> {t.day} </span> | {t.time}</>}</div>
      </div>
      <div className="app-widget-market-set">
        {L.cells.map((c, k) => {
          const [mkName, out] = cells ? [market, L.cols[k] ?? ""] : MAIN_NAMES(L.cols[k] ?? "", e.h, e.a, market);
          return (
            <div className="odds" key={k}>
              {L.cols[k] || c ? (
                <OddBtn cell={c} at={at} mk={mk ?? e.mk} sels={sels} toggle={toggle} favorite={fav != null && c != null && c.v === fav && k !== 1}
                  info={{ eventId: e.id, match, market: mkName, outcome: out, live, start: e.s, league }} />
              ) : <div style={{ visibility: "hidden" }}> - </div>}
            </div>
          );
        })}
      </div>
      <div className="curPointer" onClick={open}>+{Math.max(0, e.mc - 1)}</div>
    </div>
  );
}

// ---------- Quick market tabs ----------
export function useQuickMarket(sportId: string, qf: QuickFilter | undefined) {
  const enabled = !!qf && qf.marketId !== 1 || (!!qf && !!qf.spec);
  const q = useQuery({
    queryKey: ["fb-mk", sportId, qf?.key],
    queryFn: () => getMarketOffer({ data: { sportId, marketId: qf!.marketId, spec: qf!.spec, outcomes: qf!.outcomes } }),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  useEffect(() => {
    if (q.data) seedOdds(Object.values(q.data.events).flatMap((x) => x.c.filter((c): c is NonNullable<Cell> => !!c)), q.data.at);
  }, [q.data]);
  return enabled ? q : null;
}

export function QuickTabs({ list, active, onPick }: { list: QuickFilter[]; active: string; onPick: (k: string) => void }) {
  return (
    <div className="offerMenu baseLeft center" style={{ flexWrap: "wrap" }}>
      {list.map((q) => (
        <div key={q.key} className={q.key === active ? "active" : ""}><a className="curPointer" onClick={() => onPick(q.key)} style={{ textTransform: "uppercase" }}>{q.label}</a></div>
      ))}
    </div>
  );
}

function headerCols(cols: string[]) {
  return layout([], cols).cols;
}

// ---------- Landing panel (tabs under the banner) ----------
export function MatchesPanel({ mode, slip }: { mode: "home" | "live"; slip: Slip }) {
  const live = mode === "live";
  const q = useOffer(live);
  const { f } = useOfferFilters();
  const [tab, setTab] = useState(0);
  const [limit, setLimit] = useState(8);
  const [open, setOpen] = useState<string | null>(null);
  const [statsId, setStatsId] = useState<string | null>(null);
  const [qk, setQk] = useState("1");
  useEffect(() => { setOpen(null); setLimit(8); }, [mode]);
  const offer = q.data;
  const quick = offer?.quick["1"] ?? [];
  const qf = quick.find((x) => x.key === qk);
  const mq = useQuickMarket("1", live ? undefined : qf);
  const tours = useMemo(() => new Map(offer?.tournaments.map((t) => [t.id, t]) ?? []), [offer]);
  const cats = useMemo(() => new Map(offer?.categories.map((c) => [c.id, c]) ?? []), [offer]);
  const list: OfferEvent[] = useMemo(() => {
    if (!offer) return [];
    const all = applyFilters(offer.events, { ...f, tours: [] }, live);
    if (live) return all;
    const byId = new Map(all.map((e) => [e.id, e]));
    const soccer = all.filter((e) => e.sp === "1");
    if (tab === 0) return offer.popularEvents.map((id) => byId.get(id)).filter((e): e is OfferEvent => !!e);
    if (tab === 1) return soccer.filter((e) => favOdds(e) <= 1.3);
    return soccer.filter((e) => favOdds(e) > 1.3 && favOdds(e) <= 1.5);
  }, [offer, f, tab, live]);
  const tabs = live ? ["LIVE MATCHES"] : ["MOST POPULAR MATCHES", "SOCCER ODDS UNDER 1.30", "LOW SOCCER ODDS (1.31 - 1.50)"];
  const useQf = !live && qf && mq;
  const cols = useQf ? qf.cols : ["1", "X", "2", "1X", "X2", "12"];
  const leagueOf = (e: OfferEvent) => { const t = tours.get(e.t); const c = t ? cats.get(t.categoryId) : undefined; return [c?.name, t?.name].filter(Boolean).join(" / "); };
  const sportOf = (e: OfferEvent) => offer?.sports.find((s) => s.id === e.sp);
  return (
    <div className="mainOffer">
      <div className="offerMenu baseLeft center">
        {tabs.map((t, k) => (
          <div key={t} className={k === tab || live ? "active" : ""}><a className="curPointer" onClick={() => { setTab(k); setLimit(8); }}>{t}</a></div>
        ))}
      </div>
      {!live && quick.length > 0 && <QuickTabs list={quick} active={qk} onPick={setQk} />}
      <div className="emptyLow" />
      <div className="offerHead"><div />{headerCols(cols).map((p, i) => <div key={i}>{p}</div>)}</div>
      {q.isLoading && <div className="offerHead"><div>Loading matches…</div></div>}
      {q.isError && <div className="offerHead"><div>Could not load matches. Retrying…</div></div>}
      {!q.isLoading && list.length === 0 && !q.isError && <div className="offerHead"><div>No matches for these filters.</div></div>}
      {offer && list.slice(0, limit).map((e) => {
        const sp = sportOf(e);
        const m = useQf ? mq.data?.events[e.id] : undefined;
        return (
          <Fragment key={e.id}>
            <MatchRow e={e} at={useQf ? mq.data?.at ?? offer.at : offer.at} cells={useQf ? m?.c ?? [] : undefined} mk={useQf ? (m ? [m.mk] : []) : undefined}
              cols={useQf ? qf.cols : sp?.cols ?? ["1", "X", "2"]} market={useQf ? qf.label.replace(/^Home/, e.h).replace(/^Away/, e.a) : sp?.market ?? "Full Time Result"}
              sels={slip.sels} toggle={slip.toggle} live={live} league={leagueOf(e)}
              open={() => setOpen((o) => (o === e.id ? null : e.id))} stats={() => setStatsId(e.id)} />
            {open === e.id && <MarketsDropdown id={e.id} live={live} sels={slip.sels} toggle={slip.toggle} />}
          </Fragment>
        );
      })}
      {statsId && <StatsModal id={statsId} live={live} onClose={() => setStatsId(null)} />}
      <div className="offerButtons">
        {limit < list.length && <div className="buttons empty"><a className="curPointer" onClick={() => setLimit((l) => l + 10)}>SHOW MORE</a></div>}
      </div>
    </div>
  );
}

// ---------- Full sport view (sidebar selections, favourites) ----------
export function SportsView({ slip }: { slip: Slip }) {
  const q = useOffer(false);
  const { f, setTours, view, setView, favs, toggleFav } = useOfferFilters();
  const offer = q.data;
  const [open, setOpen] = useState<string | null>(null);
  const [statsId, setStatsId] = useState<string | null>(null);
  const [limit, setLimit] = useState(120);
  const sportIds = useMemo(() => {
    if (!offer) return [];
    if (view.kind === "sport") return [view.sportId];
    const tset = new Set(f.tours);
    return offer.sports.filter((s) => offer.tournaments.some((t) => t.sportId === s.id && tset.has(t.id))).map((s) => s.id);
  }, [offer, f.tours, view]);
  const [sportId, setSportId] = useState<string>("");
  const sid = sportIds.includes(sportId) ? sportId : sportIds[0] ?? "";
  const sport = offer?.sports.find((s) => s.id === sid);
  const quick = offer?.quick[sid] ?? [];
  const [qk, setQk] = useState("");
  const qf = quick.find((x) => x.key === qk) ?? quick[0];
  const mq = useQuickMarket(sid, qf);
  const useQf = !!(qf && mq);
  const groups = useMemo(() => {
    if (!offer) return [];
    const evs = applyFilters(offer.events.filter((e) => e.sp === sid), view.kind === "sport" && !f.tours.length ? { ...f, tours: [] } : f);
    const cats = new Map(offer.categories.map((c) => [c.id, c]));
    const order = offer.tournaments.filter((t) => t.sportId === sid);
    const out: { t: (typeof order)[number]; cat: string; icon: string; evs: OfferEvent[] }[] = [];
    for (const t of order) {
      const list = evs.filter((e) => e.t === t.id);
      if (list.length) out.push({ t, cat: cats.get(t.categoryId)?.name ?? "", icon: cats.get(t.categoryId)?.icon ?? "", evs: list });
    }
    return out;
  }, [offer, sid, f, view]);
  if (q.isLoading) return <div className="mainOffer"><div className="offerHead"><div>Loading offer…</div></div></div>;
  if (!offer) return <div className="mainOffer"><div className="offerHead"><div>Could not load the offer. Retrying…</div></div></div>;
  let shown = 0;
  const selectedNames = offer.tournaments.filter((t) => f.tours.includes(t.id));
  return (
    <div className="mainOffer" style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#3d3f49", color: "#e6e6e8", fontWeight: 700, borderRadius: 6, textTransform: "uppercase" }}>
        <span className={`ico ${sport?.icon ?? "soccer"} h16`} /> <span style={{ flex: 1 }}>{sport?.name ?? "Sports"}</span>
        {sportIds.length > 1 && sportIds.map((id) => <a key={id} className="curPointer" onClick={() => setSportId(id)} style={{ fontSize: 11, color: id === sid ? UP : "#a3a4a8" }}>{offer.sports.find((s) => s.id === id)?.name}</a>)}
        <a className="curPointer" onClick={() => { setTours(f.tours, false); setView({ kind: "landing" }); }} style={{ fontSize: 11, color: "#a3a4a8" }}>✕ CLOSE</a>
      </div>
      {selectedNames.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "6px 0" }}>
          {selectedNames.map((t) => <a key={t.id} className="curPointer" onClick={() => setTours([t.id], false)} style={{ background: "#2a2c33", color: "#e6e6e8", fontSize: 11, padding: "3px 8px", borderRadius: 3 }}>{t.name} ✕</a>)}
        </div>
      )}
      {quick.length > 0 && <QuickTabs list={quick} active={qf?.key ?? ""} onPick={setQk} />}
      {groups.length === 0 && <div className="offerHead"><div>No matches for these filters.</div></div>}
      {groups.map((g) => {
        if (shown >= limit) return null;
        const cols = useQf ? qf!.cols : sport?.cols ?? ["1", "X", "2"];
        const favL = favs.leagues.includes(g.t.id);
        return (
          <div key={g.t.id} data-ce="offer-tournament-detail" style={{ display: "block" }}>
            <div className="offerHead league">
              <div><span className={`ico ${sport?.icon ?? "soccer"} h13`} /></div>
              <div>
                <span className={`ico flag ${g.icon}`} /> {g.cat} - {g.t.name}
                <a className="curPointer" role="button" aria-label="Favourite league" title="Favourite league" onClick={() => toggleFav("leagues", g.t.id)} style={{ marginLeft: 8 }}>{favL ? "★" : "☆"}</a>
              </div>
              {headerCols(cols).map((p, i) => <div key={i}>{p}</div>)}
            </div>
            {g.evs.map((e) => {
              if (shown++ >= limit) return null;
              const m = useQf ? mq!.data?.events[e.id] : undefined;
              return (
                <Fragment key={e.id}>
                  <MatchRow e={e} at={useQf ? mq!.data?.at ?? offer.at : offer.at} cells={useQf ? m?.c ?? [] : undefined} mk={useQf ? (m ? [m.mk] : []) : undefined}
                    cols={cols} market={useQf ? qf!.label.replace(/^Home/, e.h).replace(/^Away/, e.a) : sport?.market ?? ""}
                    sels={slip.sels} toggle={slip.toggle} league={`${g.cat} / ${g.t.name}`}
                    open={() => setOpen((o) => (o === e.id ? null : e.id))} stats={() => setStatsId(e.id)} />
                  {open === e.id && <MarketsDropdown id={e.id} live={false} sels={slip.sels} toggle={slip.toggle} />}
                </Fragment>
              );
            })}
          </div>
        );
      })}
      {shown > limit && <div className="offerButtons"><div className="buttons empty"><a className="curPointer" onClick={() => setLimit((l) => l + 120)}>SHOW MORE</a></div></div>}
      {statsId && <StatsModal id={statsId} onClose={() => setStatsId(null)} />}
    </div>
  );
}

/** Favourite matches / teams list and single searched match. */
export function PickedView({ slip }: { slip: Slip }) {
  const pre = useOffer(false);
  const lv = useOffer(true);
  const { view, setView, favs } = useOfferFilters();
  const [open, setOpen] = useState<string | null>(view.kind === "focus" ? view.id : null);
  const [statsId, setStatsId] = useState<string | null>(null);
  useEffect(() => { if (view.kind === "focus") setOpen(view.id); }, [view]);
  const rows: { e: OfferEvent; o: Offer }[] = [];
  for (const o of [lv.data, pre.data]) {
    if (!o) continue;
    for (const e of o.events) {
      const ok = view.kind === "focus" ? e.id === view.id : view.kind === "favMatches" ? favs.matches.includes(e.id) : view.kind === "favTeams" ? favs.teams.includes(e.h) || favs.teams.includes(e.a) : false;
      if (ok && !rows.some((r) => r.e.id === e.id)) rows.push({ e, o });
    }
  }
  const title = view.kind === "focus" ? "Search result" : view.kind === "favMatches" ? "My favourite matches" : "My favourite teams";
  return (
    <div className="mainOffer" style={{ marginTop: 10 }}>
      <div className="offerMenu baseLeft center">
        <div className="active"><a>{title}</a></div>
        <div><a className="curPointer" onClick={() => setView({ kind: "landing" })}>← BACK</a></div>
      </div>
      <div className="offerHead"><div />{["1", "X", "2", "1X", "X2", "12"].map((p) => <div key={p}>{p}</div>)}</div>
      {rows.length === 0 && <div className="offerHead"><div>{pre.isLoading ? "Loading…" : "Nothing here yet. Use the star or heart on a match to add it."}</div></div>}
      {rows.map(({ e, o }) => {
        const sp = o.sports.find((s) => s.id === e.sp);
        return (
          <Fragment key={e.id}>
            <MatchRow e={e} at={o.at} cols={sp?.cols ?? ["1", "X", "2"]} market={sp?.market ?? ""} sels={slip.sels} toggle={slip.toggle} live={o.live}
              open={() => setOpen((x) => (x === e.id ? null : e.id))} stats={() => setStatsId(e.id)} />
            {open === e.id && <MarketsDropdown id={e.id} live={o.live} sels={slip.sels} toggle={slip.toggle} />}
          </Fragment>
        );
      })}
      {statsId && <StatsModal id={statsId} onClose={() => setStatsId(null)} />}
    </div>
  );
}

export function OfferCenter({ slip, mode, banner }: { slip: Slip; mode: "home" | "live"; banner: ReactNode }) {
  const { f, view } = useOfferFilters();
  if (mode === "home" && (view.kind === "focus" || view.kind === "favMatches" || view.kind === "favTeams")) return <PickedView slip={slip} />;
  if (mode === "home" && (view.kind === "sport" || f.tours.length > 0)) return <SportsView slip={slip} />;
  return <>{banner}<div data-ce="offer-highlighted-events"><MatchesPanel mode={mode} slip={slip} /></div></>;
}

// ---------- Banners ----------
export function BannerSlider() {
  const { data } = useQuery(bannersQuery);
  const list = data ?? [];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), 6000);
    return () => clearInterval(t);
  }, [list.length]);
  const img = list[i % Math.max(list.length, 1)]?.image ?? "/site-assets/05bbece20555e650.webp";
  return (
    <div className="slider">
      <div><div style={{ backgroundImage: `url("${img}")` }} /></div>
      <div className="sliderDots justify-center [bottom:calc(32px_*_var(--factor))] [gap:calc(10px_*_var(--factor))]">
        {list.map((b, k) => (
          <div key={b.label + k} className={k === i ? "active" : ""} onClick={() => setI(k)} role="button" aria-label={`Banner ${k + 1}`} />
        ))}
      </div>
    </div>
  );
}

// ---------- Event markets ----------
function useEventDetail(id: string, live: boolean) {
  const q = useQuery({ queryKey: ["fb-ev", id, live], queryFn: () => getEventDetail({ data: { id, live } }), refetchInterval: live ? 10_000 : 30_000 });
  useEffect(() => {
    if (q.data) seedOdds(q.data.markets.flatMap((m) => m.outcomes.filter((o) => o.odds).map((o) => ({ id: o.id, v: o.odds!, l: o.locked }))), q.data.at);
  }, [q.data]);
  return q;
}

export function MarketsDropdown({ id, live, sels, toggle }: { id: string; live: boolean; sels: Sel[]; toggle: (s: Sel) => void }) {
  const q = useEventDetail(id, live);
  const ev = q.data;
  const [closed, setClosed] = useState<number[]>([]);
  const box: CSSProperties = { display: "block", height: "auto", gridColumn: "1 / -1", width: "100%", background: "#2e3139", color: "#e6e6e8", fontSize: 12, padding: "4px 6px 8px", marginBottom: 2 };
  if (q.isLoading) return <div style={box}>Loading odds…</div>;
  if (q.isError || !ev) return <div style={box}>Odds for this match are not available right now.</div>;
  if (!ev.markets.length) return <div style={box}>No more markets are open for this match right now.</div>;
  return (
    <div style={box}>
      {ev.markets.map((mk, mi) => {
        const isClosed = closed.includes(mi);
        const cols = mk.outcomes.length % 3 === 0 && mk.outcomes.length <= 9 ? 3 : 2;
        return (
          <div key={mk.id} style={{ display: "block", height: "auto", background: "#3a3d47", marginTop: 6, borderRadius: 2 }}>
            <div className="curPointer" onClick={() => setClosed((c) => (isClosed ? c.filter((x) => x !== mi) : [...c, mi]))}
              style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", fontWeight: 700, textTransform: "uppercase" }}>
              <span>{mk.name}</span><span>{isClosed ? "▾" : "▴"}</span>
            </div>
            {!isClosed && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3, padding: "0 10px 10px" }}>
                {mk.outcomes.map((o) => (
                  <OddBtn key={o.id} variant="chip" label={o.name} cell={o.odds ? { id: o.id, v: o.odds, ...(o.locked ? { l: 1 as const } : {}) } : null} at={ev.at} mk={[mk.id]} sels={sels} toggle={toggle}
                    info={{ eventId: id, match: `${ev.home} - ${ev.away}`, market: mk.name, outcome: o.name, live, start: ev.startTs, league: ev.league }} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EventDetail({ id, live, onClose, sels, toggle }: { id: string; live: boolean; onClose: () => void; sels: Sel[]; toggle: (s: Sel) => void }) {
  const q = useEventDetail(id, live);
  const [stats, setStats] = useState(false);
  const ev = q.data;
  const bar: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.08)", color: "#e6e6e8", fontWeight: 700, fontSize: 13, marginTop: 6 };
  return (
    <div style={{ display: "block" }}>
      <div className="mainOffer"><div className="offerMenu baseLeft center">
        <div className="active"><a>{ev ? `${ev.home} - ${ev.away}` : "Loading…"}</a></div>
        <div><a onClick={onClose} className="curPointer">← BACK</a></div>
      </div></div>
      <div style={bar}>
        <div>{ev ? `${ev.league} · ${fmtTime(ev.startTs).day} ${fmtTime(ev.startTs).time}` : ""}</div>
        <div><a onClick={() => setStats(true)} className="textOrange curPointer">Match statistics</a></div>
        {stats && <StatsModal id={id} live={live} onClose={() => setStats(false)} />}
      </div>
      {q.isError && <div style={bar}><div>Odds for this match are not available right now.</div></div>}
      {ev && <MarketsDropdown id={id} live={live} sels={sels} toggle={toggle} />}
    </div>
  );
}

// ---------- Bet slip ----------
export function BetSlip({ slip, title = "Sportsbook" }: { slip: Slip; title?: string }) {
  useFeedVersion();
  const { sels, remove, clear, active, setActive, counts, stake, setStake, accept } = slip;
  const [stakeText, setStakeText] = useState(String(stake));
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  useEffect(() => setStakeText(String(stake)), [stake, active]);
  const items = sels.map((s) => {
    const o = getOdd(s.oddsId);
    const fresh = o && o.at >= s.at;
    const cur = fresh ? o.v : s.odds;
    const locked = (fresh && o.l) || isMarketLocked(undefined, s.at);
    return { s, cur, locked, changed: Math.abs(cur - s.odds) > 1e-9 };
  });
  const active_ = items.filter((x) => !x.locked);
  const total = totalOdds(active_.map((x) => x.cur));
  const win = possibleWin(stake, total);
  const vip = vipPoints(stake, active_.length, total);
  const err = sels.length ? stakeError(stake) : null;
  const changed = items.filter((x) => x.changed);
  const lockedCount = items.filter((x) => x.locked).length;
  const canPlace = sels.length > 0 && !err && !changed.length && !lockedCount;
  const describe = (s: Sel) => [s.market, s.outcome];
  const btn: CSSProperties = { background: "#e4e4e6", color: "#333", fontWeight: 700, fontSize: 11, padding: "4px 0", textAlign: "center", cursor: "pointer" };
  const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const commitStake = (v: number) => setStake(Math.round(Math.max(0, Math.min(v, TICKET_RULES.MAX_STAKE * 10)) * 100) / 100);
  return (
    <div className="ticket">
      <div className="ticketHead"> Bet slip - {title} <div /></div>
      <div className="betSlipMenu" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>{[0, 1, 2, 3].map((i) => <a key={i} className={`curPointer ${i === active ? "active" : ""}`} onClick={() => setActive(i)}> {i + 1} <span>{counts[i] ?? 0}</span></a>)}</div>
        {sels.length > 0 && <a className="curPointer" onClick={clear} aria-label="Clear ticket" style={{ fontSize: 18, color: "#777", paddingRight: 6 }}>🗑</a>}
      </div>
      {sels.length === 0 ? (
        <div className="empty"> Your Ticket is still empty </div>
      ) : (
        <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.25, margin: 0, padding: 0, width: "100%" }}>
          <div style={{ background: G, color: "#fff" }}>
            {items.map(({ s, cur, locked, changed: ch }, i) => {
              const [mk, out] = describe(s);
              const up = cur > s.odds;
              return (
                <div key={s.key} style={{ padding: "5px 8px 6px", borderBottom: "1px solid rgba(255,255,255,0.3)", opacity: locked ? 0.55 : 1, background: ch ? "rgba(0,0,0,0.12)" : undefined }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, gap: 6 }}>
                    <span><span style={{ display: "inline-flex", width: 15, height: 15, borderRadius: 99, background: "#fff", color: G, fontSize: 10, alignItems: "center", justifyContent: "center", marginRight: 5 }}>{i + 1}</span>{s.live && <span style={{ background: "#fff", color: G, fontSize: 9, padding: "0 3px", borderRadius: 2, marginRight: 4 }}>LIVE</span>}{s.match}</span>
                    <a className="curPointer" onClick={() => remove(s.key)} aria-label="Remove" style={{ color: "#fff", fontSize: 14, fontWeight: 900, flexShrink: 0 }}>✕</a>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,0.8fr) 52px", gap: 6, marginTop: 3, alignItems: "center", color: "rgba(255,255,255,0.9)" }}>
                    <span>{mk}</span><span style={{ textAlign: "center", wordBreak: "break-word" }}>{out}</span>
                    <b style={{ color: "#fff", textAlign: "right", fontSize: 12 }}>
                      {locked ? <span style={{ display: "inline-flex", background: "#25262c", borderRadius: 3, padding: "2px 6px" }}><LockIcon size={12} /></span> : <>{ch && <s style={{ opacity: 0.6, fontSize: 10, marginRight: 3 }}>{s.odds.toFixed(2)}</s>}{cur.toFixed(2)}{ch && <span style={{ color: up ? "#c8ffe0" : "#ffd0d0", fontSize: 9 }}>{up ? "▲" : "▼"}</span>}</>}
                    </b>
                  </div>
                </div>
              );
            })}
          </div>
          {(changed.length > 0 || lockedCount > 0) && (
            <div style={{ background: "#fff4d6", color: "#6b4e00", padding: "6px 8px", fontSize: 11 }}>
              {changed.length > 0 && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <span>Odds changed on {changed.length} pick{changed.length > 1 ? "s" : ""}.</span>
                <a className="curPointer" onClick={() => accept(Object.fromEntries(changed.map((x) => [x.s.key, x.cur])))} style={{ background: G, color: "#fff", padding: "3px 8px", borderRadius: 3 }}>ACCEPT CHANGES</a>
              </div>}
              {lockedCount > 0 && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginTop: changed.length ? 4 : 0 }}>
                <span>{lockedCount} pick{lockedCount > 1 ? "s are" : " is"} suspended.</span>
                <a className="curPointer" onClick={() => items.filter((x) => x.locked).forEach((x) => remove(x.s.key))} style={{ background: "#3d3f49", color: "#fff", padding: "3px 8px", borderRadius: 3 }}>REMOVE</a>
              </div>}
            </div>
          )}
          <div style={{ background: "#3d3f49", color: "#fff", padding: "8px 10px", lineHeight: 1.5, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>TOTAL ODDS</span><span>{fmt(total, 2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>STAKE</span><span>{fmt(stake)} UGX</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", color: UP }}><span>POSSIBLE WIN</span><span>{fmt(win)} UGX</span></div>
            {win >= TICKET_RULES.MAX_WIN && <div style={{ fontSize: 10, color: "#ffd27a" }}>Maximum win is {fmt(TICKET_RULES.MAX_WIN)} UGX</div>}
            <div style={{ textAlign: "right", fontSize: 11 }}>+{fmt(vip)} VIP PTS</div>
          </div>
          <div style={{ background: "#fff", padding: "6px 8px 8px", color: "#333" }}>
            <div style={{ textAlign: "center", marginBottom: 6 }}>STAKE</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <a className="curPointer" onClick={() => commitStake(Math.max(TICKET_RULES.MIN_STAKE, stake - 1000))} style={{ background: G, color: "#fff", width: 22, minWidth: 22, flexShrink: 0, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3 }}>-</a>
              <input type="text" inputMode="decimal" value={stakeText} aria-label="Stake"
                onChange={(e) => { const t = e.target.value.replace(/[^\d.]/g, ""); setStakeText(t); commitStake(Number(t) || 0); }}
                style={{ flex: 1, minWidth: 0, width: "100%", border: err ? "1px solid #d33" : 0, background: "#e9e9eb", color: "#333", padding: "4px 8px", textAlign: "right", fontSize: 13, borderRadius: 3 }} />
              <a className="curPointer" onClick={() => commitStake(Math.min(TICKET_RULES.MAX_STAKE, stake + 1000))} style={{ background: G, color: "#fff", width: 22, minWidth: 22, flexShrink: 0, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3 }}>+</a>
            </div>
            {err && <div style={{ color: "#c22", fontSize: 10, marginTop: 3, textAlign: "center" }}>{err}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, marginTop: 6 }}>
              {[10000, 50000, 250000].map((v) => <div key={v} style={btn} onClick={() => commitStake(v)}>{fmt(v)}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, marginTop: 6 }}>
              <div style={{ ...btn, background: G, color: "#fff" }}>UGX</div><div style={btn} onClick={() => setNotice("Paying with VIP points needs a Fortebet account.")}>VIP POINTS</div>
            </div>
            <div style={{ ...btn, background: "#3d3f49", color: "#fff", marginTop: 6 }} onClick={() => setPreview(true)}>TICKET PREVIEW</div>
            <div style={{ ...btn, background: "#cea642", color: "#fff", fontSize: 13, padding: "6px 0", marginTop: 5, borderRadius: 3 }} onClick={() => setNotice("Saving an i-Ticket needs a connection to Fortebet's betting system, which isn't set up yet. Your ticket is kept on this device.")}>SAVE i-TICKET</div>
            <div style={{ textAlign: "center", color: "#888", margin: "4px 0", fontSize: 11 }}>- OR -</div>
            <div style={{ ...btn, background: canPlace ? G : "#d0d0d2", color: canPlace ? "#fff" : "#999", fontSize: 13, padding: "6px 0", borderRadius: 3, cursor: canPlace ? "pointer" : "not-allowed" }}
              onClick={() => canPlace && setNotice("Placing real bets needs a logged-in Fortebet account, which this site can't do yet.")}>PLACE BET</div>
            {notice && <div style={{ marginTop: 6, fontSize: 11, color: "#333", background: "#f1f1f3", padding: 6, borderRadius: 3, display: "flex", gap: 6 }}><span style={{ flex: 1 }}>{notice}</span><a className="curPointer" onClick={() => setNotice(null)}>✕</a></div>}
          </div>
        </div>
      )}
      {preview && (() => {
        const lives = sels.filter((s) => s.live).length;
        const mode = lives === 0 ? "PREMATCH" : lives === sels.length ? "LIVE" : "PREMATCH + LIVE";
        const kind = sels.length > 1 ? "COMBO" : "SINGLE";
        return (
          <TicketSheet
            title={`${mode} | ${kind} ${sels.length} event${sels.length === 1 ? "" : "s"}`}
            status="PREPARING"
            relativeDays
            onClose={() => setPreview(false)}
            items={items.map(({ s, cur, locked, changed: ch }) => ({ key: s.key, time: s.start, match: s.match, market: s.market, outcome: s.outcome, odds: cur, oldOdds: ch ? s.odds : undefined, status: locked ? "LOCKED" : "PREPARING", league: s.league }))}
            rows={[
              { label: "TOTAL ODDS", value: fmt(total, 2) },
              { label: "STAKE", value: `${fmt(stake)} UGX` },
              { label: "POSSIBLE WIN", value: `${fmt(win)} UGX` },
            ]}
            note={vip > 0 ? <div>+{fmt(vip)} VIP PTS if the ticket wins</div> : null}
            actions={<>
              {err && <div style={{ color: "#ffb4b4", fontSize: 12 }}>{err}</div>}
              {lockedCount > 0 && <div style={{ color: "#c9cacf", fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}><LockIcon size={12} /> {lockedCount} pick{lockedCount > 1 ? "s are" : " is"} suspended</div>}
              <button style={sheetBtn} onClick={() => setPreview(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a3c44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 22, flexShrink: 0 }}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></svg>
                Back to bet slip
              </button>
            </>}
          />
        );
      })()}
    </div>
  );
}

// ---------- Statistics ----------
export function StatsModal({ id, onClose }: { id: string; live?: boolean; onClose: () => void }) {
  const num = id.replace(/\D/g, "");
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Statistics center" style={{ width: "min(520px, 100%)", height: "min(780px, 92vh)", display: "flex", flexDirection: "column", background: "#2a2b31", color: "#e6e6e8", borderRadius: 4, boxShadow: "0 10px 40px rgba(0,0,0,0.6)", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#1f2025", fontWeight: 700, fontSize: 13 }}>
          <span>STATISTICS CENTER</span>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: 0, color: "#e6e6e8", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <iframe title="Match statistics" src={`https://fortebet-ug.24liveresults.com/match-widget/${num}?displayMode=kiosk&utm_source=fortebet&utm_medium=web&utm_campaign=match_detail&language=en&lang=en`} style={{ flex: 1, width: "100%", border: 0, background: "#2a2b31" }} />
      </div>
    </div>
  );
}

// ---------- Live page ----------
function LiveRow({ e, o, slip, open, onOpen, onStats }: { e: OfferEvent; o: Offer; slip: Slip; open: boolean; onOpen: () => void; onStats: () => void }) {
  const ev = useLiveEvent(e.id, { sc: e.sc, st: e.st }, o.at);
  const sp = o.sports.find((s) => s.id === e.sp);
  const L = layout(e.c, sp?.cols ?? ["1", "X", "2"]);
  const tour = o.tournaments.find((t) => t.id === e.t);
  const league = [o.categories.find((c) => c.id === tour?.categoryId)?.name, tour?.name].filter(Boolean).join(" / ");
  if (ev.gone) return null;
  return (
    <div style={{ display: "contents" }}>
      <div className="data match [font-weight:700]">
        <div className="matchInfo curPointer" onClick={onOpen}>
          <div className="app-widget-event-set">
            <div className="starFavorite"><span className="ico chart h13 opa06 curPointer" role="button" aria-label="Match statistics" style={{ display: "inline-block", minWidth: 14, minHeight: 13 }} onClick={(x) => { x.preventDefault(); x.stopPropagation(); onStats(); }} /></div>
            <div className="teamsName"><span> {e.h} </span><span> {e.a} </span></div>
            <div className="teamsScore"><div>{ev.sc ?? "0 : 0"}</div><div /></div>
            <div className="status"><i>{ev.st ?? "Live"}</i></div>
          </div>
        </div>
        <div className="app-widget-market-set">
          {[0, 1].map((g) => (
            <div className="odds" key={g}>
              {L.cells.slice(g * 3, g * 3 + 3).map((c, j) => {
                const k = g * 3 + j;
                const [mk, out] = MAIN_NAMES(L.cols[k] ?? "", e.h, e.a, sp?.market ?? "Full Time Result");
                return L.cols[k] || c ? <OddBtn key={k} cell={c} at={o.at} mk={e.mk} sels={slip.sels} toggle={slip.toggle} info={{ eventId: e.id, match: `${e.h} - ${e.a}`, market: mk, outcome: out, live: true, start: e.s, league }} /> : <div key={k} />;
              })}
            </div>
          ))}
        </div>
        <div className="curPointer" onClick={onOpen}> +{Math.max(0, e.mc - 1)} </div>
      </div>
      {open && <MarketsDropdown id={e.id} live sels={slip.sels} toggle={slip.toggle} />}
    </div>
  );
}

export function LivePreviewList({ slip }: { slip: Slip }) {
  const q = useOffer(true);
  const [open, setOpen] = useState<string | null>(null);
  const [statsId, setStatsId] = useState<string | null>(null);
  const o = q.data;
  const groups = useMemo(() => {
    if (!o) return [];
    const tours = new Map(o.tournaments.map((t) => [t.id, t]));
    const cats = new Map(o.categories.map((c) => [c.id, c]));
    const out: { key: string; name: string; sp: string; evs: OfferEvent[] }[] = [];
    const sorted = [...o.events].sort((a, b) => (o.sports.findIndex((s) => s.id === a.sp) - o.sports.findIndex((s) => s.id === b.sp)) || a.s.localeCompare(b.s));
    for (const e of sorted) {
      const t = tours.get(e.t);
      const c = t ? cats.get(t.categoryId) : undefined;
      const g = out.find((x) => x.key === e.t);
      if (g) g.evs.push(e);
      else out.push({ key: e.t, name: [c?.name, t?.name].filter(Boolean).join(" - "), sp: e.sp, evs: [e] });
    }
    return out;
  }, [o]);
  return (
    <div className="live">
      <div className="live__head live__head--space" />
      <div data-ce="live-preview">
        <div className="match headOdds uppercase [font-weight:700]">
          <div><span className="ico soccer" /></div>
          <div>Live matches</div>
          <div className="matchOdds"> Full Time Result </div>
          <div className="matchOdds"> Double Chance </div>
          <div />
        </div>
        {q.isLoading && <div className="match tournament"><div /><div>Loading live matches…</div></div>}
        {q.isError && <div className="match tournament"><div /><div>Could not load live matches. Retrying…</div></div>}
        {o && groups.length === 0 && <div className="match tournament"><div /><div>No live matches right now.</div></div>}
        {o && groups.map((g) => {
          const sp = o.sports.find((s) => s.id === g.sp);
          const cols = layout([], sp?.cols ?? ["1", "X", "2"]).cols;
          return (
            <div key={g.key} style={{ display: "contents" }}>
              <div className="match tournament [font-weight:700]">
                <div><span className={`ico ${sp?.icon ?? "soccer"}`} /></div>
                <div><span>{g.name}</span><span> ({g.evs.length})</span></div>
                <div className="matchOdds">{cols.slice(0, 3).map((c, i) => <div key={i}>{c} </div>)}</div>
                <div className="matchOdds">{cols.slice(3, 6).map((c, i) => <div key={i}>{c} </div>)}</div>
                <div />
              </div>
              {g.evs.map((e) => <LiveRow key={e.id} e={e} o={o} slip={slip} open={open === e.id} onOpen={() => setOpen((x) => (x === e.id ? null : e.id))} onStats={() => setStatsId(e.id)} />)}
            </div>
          );
        })}
      </div>
      {statsId && <StatsModal id={statsId} live onClose={() => setStatsId(null)} />}
    </div>
  );
}

export function LiveEventHeader({ id, onBack }: { id: string; onBack: () => void }) {
  const q = useOffer(true);
  const m = q.data?.events.find((x) => x.id === id);
  const ev = useLiveEvent(id, { sc: m?.sc, st: m?.st }, q.data?.at ?? 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 12px", background: "rgba(255,255,255,0.08)", color: "#e6e6e8", fontWeight: 700, fontSize: 13 }}>
      <a className="curPointer" onClick={onBack} style={{ color: UP }}>← Back</a>
      <span style={{ flex: 1 }}>{m ? `${m.h} - ${m.a}` : "Live match"}</span>
      {m && <span><span style={{ color: UP }}>{ev.sc ?? "0:0"}</span> · {ev.st ?? "Live"}</span>}
    </div>
  );
}

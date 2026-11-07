import { createServerFn } from "@tanstack/react-start";
import { groupDetailMarkets } from "@/lib/live-markets";
import type { RawScoreboard } from "@/lib/live-scoreboard";

const BASE = "https://www.fortebet.ug/api/web/v1";
export const BANNER_BASE = "https://www.fortebet.ug/static/temp/cms/";

type Raw = any;
const cache = new Map<string, { at: number; data: Raw }>();

async function getJson(path: string, ttl = 30_000): Promise<{ at: number; data: Raw }> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttl) return hit;
  const res = await fetch(BASE + path, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Fortebet feed failed (${res.status})`);
  const data = await res.json();
  const entry = { at: Date.now(), data };
  cache.set(path, entry);
  return entry;
}

// ---------- Normalised offer ----------
/** One odds cell: oddsId, value, locked flag. */
export type Cell = { id: number; v: number; l?: 1 } | null;
export type OfferSport = { id: string; name: string; icon: string; order: number; count: number; market: string; cols: string[] };
export type OfferCategory = { id: string; sportId: string; name: string; icon: string; order: number; count: number };
export type OfferTournament = { id: string; categoryId: string; sportId: string; name: string; order: number; count: number };
export type OfferEvent = {
  id: string;
  sp: string; // sport id
  t: string; // tournament id
  h: string;
  a: string;
  s: string; // start ISO
  mc: number; // market count
  mk: number[]; // market db ids feeding the main cells (for lock updates)
  c: Cell[];
  sc?: string | undefined; // live score
  st?: string | undefined; // live status
  sb?: RawScoreboard; // live scoreboard (Fortebet status object)
};
export type QuickFilter = { key: string; marketId: number; spec: string; label: string; cols: string[]; outcomes: number[] };
export type Offer = {
  at: number;
  live: boolean;
  sports: OfferSport[];
  categories: OfferCategory[];
  tournaments: OfferTournament[];
  events: OfferEvent[];
  top: { name: string; ids: string[] }[];
  popularEvents: string[];
  popularTournaments: string[];
  quick: Record<string, QuickFilter[]>;
};

const DC_SHORTS = ["1X", "X2", "12"];

function fillName(s: string, home = "Home", away = "Away") {
  return s.replace(/\{\$competitor1\}/g, home).replace(/\{\$competitor2\}/g, away);
}

function scoreOf(e: Raw) {
  const st = e.scoreboard?.status;
  const sb = st?.scoreboard;
  const score = sb && sb.h != null ? `${sb.hg ?? sb.h}:${sb.ag ?? sb.a}` : undefined;
  const status = st?.status ? String(st.status).replace(/_/g, " ") + (st.time ? ` ${st.time}'` : "") : undefined;
  return { score, status };
}

function normalise(d: Raw, at: number, live: boolean): Offer {
  const ml = d.market_list ?? {};
  const mainDef: Record<string, { id: number; def: Raw; outs: [string, Raw][] }> = {};
  for (const sid of Object.keys(ml)) {
    const entry = Object.entries<Raw>(ml[sid]).find(([, v]) => v.main);
    if (!entry) continue;
    const outs = Object.entries<Raw>(entry[1].outcome ?? {}).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
    // Live soccer splits Double Chance into its own market (10): show it next to 1X2 like the real site.
    const dcDef = ml[sid]?.["10"];
    if (outs.length === 3 && entry[1].template === "3WAY" && dcDef?.outcome) {
      for (const short of DC_SHORTS) {
        const hit = Object.entries<Raw>(dcDef.outcome).find(([, o]) => o.short === short);
        if (hit) outs.push([`dc:${hit[0]}`, hit[1]]);
      }
    }
    mainDef[sid] = { id: Number(entry[0]), def: entry[1], outs };
  }

  const sports: OfferSport[] = Object.entries<Raw>(d.sport ?? {})
    .map(([id, s]) => {
      const md = mainDef[id];
      return { id, name: s.name, icon: s.icon, order: s.order ?? 99, count: s.eventCount ?? 0, market: md?.def.name ?? "Match Winner", cols: md ? md.outs.map(([, o]) => o.short ?? "") : ["1", "2"] };
    })
    .sort((a, b) => a.order - b.order);
  const categories: OfferCategory[] = Object.entries<Raw>(d.category ?? {})
    .map(([id, c]) => ({ id, sportId: String(c.sportId), name: c.name, icon: c.icon, order: c.order ?? 99, count: c.eventCount ?? 0 }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const catSport = new Map(categories.map((c) => [c.id, c.sportId]));
  const tournaments: OfferTournament[] = Object.entries<Raw>(d.tournament ?? {})
    .map(([id, t]) => ({ id, categoryId: String(t.categoryId), sportId: catSport.get(String(t.categoryId)) ?? "", name: t.name, order: t.order ?? 99, count: t.eventCount ?? 0 }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const tourSport = new Map(tournaments.map((t) => [t.id, t.sportId]));

  // index markets by event
  const byEvent = new Map<string, [string, Raw][]>();
  for (const [mid, m] of Object.entries<Raw>(d.markets ?? {})) {
    const arr = byEvent.get(m.eventId);
    if (arr) arr.push([mid, m]);
    else byEvent.set(m.eventId, [[mid, m]]);
  }

  const events: OfferEvent[] = [];
  for (const [id, e] of Object.entries<Raw>(d.event ?? {})) {
    const sp = tourSport.get(e.tournamentId) ?? "";
    const md = mainDef[sp];
    const mks = byEvent.get(id) ?? [];
    const main = md ? mks.find(([, m]) => m.marketId === md.id && !m.specifiers) : undefined;
    const dc = mks.find(([, m]) => m.marketId === 10 && !m.specifiers);
    const dcDef = ml[sp]?.["10"];
    const mk: number[] = [];
    if (main) mk.push(Number(main[0]));
    const cells: Cell[] = (md?.outs ?? []).map(([oid, od]) => {
      const pick = (m: Raw, outcomeId: number) => {
        const hit = Object.entries<Raw>(m.odds ?? {}).find(([, o]) => o.outcomeId === outcomeId);
        return hit ? ({ id: Number(hit[0]), v: Number(hit[1].odds), ...(hit[1].locked ? { l: 1 as const } : {}) }) : null;
      };
      if (oid.startsWith("dc:")) {
        const c = dc ? pick(dc[1], Number(oid.slice(3))) : null;
        if (c && dc && !mk.includes(Number(dc[0]))) mk.push(Number(dc[0]));
        return c;
      }
      let cell = main ? pick(main[1], Number(oid)) : null;
      if (!cell && dc && dcDef && DC_SHORTS.includes(od.short)) {
        const alt = Object.entries<Raw>(dcDef.outcome ?? {}).find(([, o]) => o.short === od.short);
        if (alt) {
          cell = pick(dc[1], Number(alt[0]));
          if (cell && !mk.includes(Number(dc[0]))) mk.push(Number(dc[0]));
        }
      }
      return cell;
    });
    const { score, status } = live ? scoreOf(e) : { score: undefined, status: undefined };
    events.push({
      id,
      sp,
      t: e.tournamentId,
      h: d.competitors?.[e.competitors?.[0]]?.name ?? "Home",
      a: d.competitors?.[e.competitors?.[1]]?.name ?? "Away",
      s: e.startTs,
      mc: e.marketCount ?? 1,
      mk,
      c: cells,
      sc: score,
      st: status,
      ...(live && e.scoreboard?.status ? { sb: e.scoreboard.status as RawScoreboard } : {}),
    });
  }
  events.sort((a, b) => a.s.localeCompare(b.s));

  const quick: Record<string, QuickFilter[]> = {};
  for (const sid of Object.keys(ml)) {
    const list: QuickFilter[] = [];
    for (const [mid, def] of Object.entries<Raw>(ml[sid]).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0))) {
      if (!def.quickFilter) continue;
      const outs = Object.entries<Raw>(def.outcome ?? {}).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
      const short = (o: Raw) => String(o.short ?? o.name ?? "").replace(/\{\$?total\}/g, "").trim();
      const label = (p?: string) => fillName(String(def.short ?? def.name), "Home", "Away").replace(/\{\$?total\}/g, "").trim() + (p ? ` ${p}` : "");
      if (def.spec?.params?.length) {
        for (const p of def.spec.params as string[]) {
          list.push({ key: `${mid}|${def.spec.type}=${p}`, marketId: Number(mid), spec: `${def.spec.type}=${p}`, label: label(p), cols: outs.map(([, o]) => short(o)), outcomes: outs.map(([o]) => Number(o)) });
        }
      } else {
        list.push({ key: mid, marketId: Number(mid), spec: "", label: label(), cols: outs.map(([, o]) => short(o)), outcomes: outs.map(([o]) => Number(o)) });
      }
    }
    if (list.length) quick[sid] = list;
  }

  return {
    at,
    live,
    sports,
    categories,
    tournaments,
    events,
    top: (d.top_tournaments ?? []).map((g: Raw) => ({ name: g.name, ids: g.tournaments ?? [] })),
    popularEvents: d.popular_events ?? [],
    popularTournaments: d.popular_tournaments ?? [],
    quick,
  };
}

export const getPrematchOffer = createServerFn({ method: "GET" }).handler(async () => {
  const r = await getJson("/offer/full-prematch-en", 30_000);
  return normalise(r.data.data, r.at, false);
});

export const getLiveOffer = createServerFn({ method: "GET" }).handler(async () => {
  const r = await getJson("/offer/full-live-en", 5_000);
  return normalise(r.data.data, r.at, true);
});

export const getBanners = createServerFn({ method: "GET" }).handler(async () => {
  const r = await getJson("/cms/banners?language=en&category=MAIN", 300_000).catch(() => null);
  const now = Date.now();
  return ((r?.data?.data ?? []) as Raw[])
    .flatMap((b: Raw) => b.banner_list ?? [])
    .filter((b: Raw) => b.image && (!b.valid_to || Date.parse(b.valid_to) > now))
    .map((b: Raw) => ({ label: b.label as string, image: BANNER_BASE + b.image }));
});

/** Odds for one market (e.g. Match Goals 2.5) across all events of a sport. */
export const getMarketOffer = createServerFn({ method: "GET" })
  .inputValidator((input: { sportId: string; marketId: number; spec: string; outcomes: number[] }) => {
    if (!/^\d+$/.test(input.sportId) || !Number.isInteger(input.marketId)) throw new Error("Invalid market");
    if (!/^[a-z_]*=?[\d.]*$/i.test(input.spec)) throw new Error("Invalid specifier");
    if (!Array.isArray(input.outcomes) || input.outcomes.length > 12) throw new Error("Invalid outcomes");
    return input;
  })
  .handler(async ({ data }) => {
    const q = `/offer/markets?sportId=${data.sportId}&marketId=${data.marketId}${data.spec ? `&specifiers=${encodeURIComponent(data.spec)}` : ""}&offerMode=prematch&lang=en`;
    const r = await getJson(q, 30_000);
    const out: Record<string, { mk: number; c: Cell[] }> = {};
    for (const [mid, m] of Object.entries<Raw>(r.data.data ?? {})) {
      if (data.spec && m.specifiers && m.specifiers !== data.spec) continue;
      const odds = Object.entries<Raw>(m.odds ?? {});
      out[m.eventId] = {
        mk: Number(mid),
        c: data.outcomes.map((oid) => {
          const hit = odds.find(([, o]) => o.outcomeId === oid);
          return hit ? { id: Number(hit[0]), v: Number(hit[1].odds), ...(hit[1].locked ? { l: 1 as const } : {}) } : null;
        }),
      };
    }
    return { at: r.at, events: out };
  });

export type MarketDTO = { id: number; name: string; outcomes: { id: number; name: string; odds: number | null; locked: boolean }[] };
/** One info tab Fortebet lists for a live event (TRACKER, TIMELINE, STATS, ...), Sportradar widget settings included. */
export type LiveWidget = { name: string; type: string; objectType: string | null; url: string | null; params: Record<string, unknown> };

export const getEventDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string; live?: boolean }) => {
    if (!/^[A-Z]{2}\d+$/.test(input.id)) throw new Error("Invalid event id");
    return input;
  })
  .handler(async ({ data }) => {
    const mode = data.live ? "live" : "prematch";
    const [detail, full] = await Promise.all([
      getJson(`/offer/event_detail?offerMode=${mode}&lang=en&id_event=${data.id}`, data.live ? 5_000 : 10_000),
      getJson(data.live ? "/offer/full-live-en" : "/offer/full-prematch-en", data.live ? 5_000 : 30_000),
    ]);
    const e = detail.data.data;
    const f = full.data.data;
    const home = f.competitors?.[e.competitors?.[0]]?.name ?? "Home";
    const away = f.competitors?.[e.competitors?.[1]]?.name ?? "Away";
    const t = f.tournament?.[e.tournamentId];
    const c = t ? f.category?.[t.categoryId] : null;
    const markets: (MarketDTO & { order: number })[] = Object.entries<Raw>(e.markets ?? {}).map(([mid, m]) => {
      const specs = Object.fromEntries(String(m.specifiers ?? "").split("|").filter(Boolean).map((p: string) => { const [k = "", v = ""] = p.split("="); return [k, v.replace(/^sr:[a-z_]+:/, "").replace(/_/g, " ")]; }));
      const fill = (s: string) => fillName(s, home, away).replace(/\{[$+-]?(\w+)\}/g, (_x: string, k: string) => specs[k] ?? k);
      const def = f.market_list?.[String(c?.sportId ?? 1)]?.[m.marketId] ?? {};
      const spec = m.specifiers ? ` (${String(m.specifiers).split("|").map((p: string) => (p.split("=")[1] ?? "").replace(/^sr:[a-z_]+:/, "").replace(/_/g, " ")).join(", ")})` : "";
      const outcomes = Object.entries<Raw>(m.odds)
        .map(([oid, o]) => {
          const od = def.outcome?.[o.outcomeId];
          return { id: Number(oid), name: fill(od?.name ?? String(o.outcomeId)), odds: Number(o.odds) || null, locked: !!o.locked || m.marketStatusId === 0, order: od?.order ?? 99 };
        })
        .sort((a, b) => a.order - b.order)
        .map(({ id, name, odds, locked }) => ({ id, name, odds, locked }));
      return { id: Number(mid), name: fill(def.name ?? `Market ${m.marketId}`).trim() + spec, outcomes, order: (def.order ?? 999) * 1000 };
    });
    markets.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const { score, status } = scoreOf(e);
    const sportId = String(c?.sportId ?? "");
    const widgets: LiveWidget[] = ((e.widgets ?? []) as Raw[])
      .filter((w) => w && w.active !== false && typeof w.name === "string")
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((w) => ({
        name: String(w.name),
        type: String(w.type ?? ""),
        objectType: w.objectType ? String(w.objectType) : null,
        url: typeof w.url === "string" && /^https:\/\//.test(w.url) ? w.url : null,
        params: w.params && typeof w.params === "object" ? w.params : {},
      }));
    return {
      at: Math.min(detail.at, full.at),
      id: data.id,
      home,
      away,
      sportId,
      sportIcon: String(f.sport?.[sportId]?.icon ?? "soccer"),
      league: [c?.name, t?.name].filter(Boolean).join(" / "),
      startTs: e.startTs as string,
      score: data.live ? score : undefined,
      status: data.live ? status : undefined,
      markets: markets.map(({ id, name, outcomes }) => ({ id, name, outcomes })),
      /** Fortebet detail blocks (grouped lines, grid template, suspended slots). */
      groups: groupDetailMarkets(e.markets ?? {}, f.market_list?.[sportId] ?? {}, home, away),
      /** Raw live scoreboard (status object) for the SCORE tab. */
      sb: data.live ? ((e.scoreboard?.status ?? null) as RawScoreboard | null) : null,
      widgets: data.live ? widgets : [],
      livestream: data.live && typeof e.livestream === "string" && /^https:\/\//.test(e.livestream) ? (e.livestream as string) : null,
    };
  });

// ---------- Ticket check (public /ticket/sbt-detail) ----------
export type TicketItemDTO = {
  time: string;
  match: string;
  sport: string;
  league: string;
  market: string;
  outcome: string;
  odds: number;
  result: string | null;
  status: string; // WIN | LOST | VOID | OPEN ...
  live: boolean;
  /** Match was still running when the ticket was cashed out. */
  cashedOut: boolean;
  /** Odds this pick counted at the cashout moment. */
  cashoutOdds: number | null;
};
export type TicketDTO = {
  number: string;
  status: string;
  type: string;
  mode: "PREMATCH" | "LIVE" | "MIXED" | "VIRTUAL";
  placedAt: string;
  settledAt: string | null;
  totalOdds: number;
  stake: number;
  win: number;
  taxRate: number;
  tax: number;
  payout: number;
  possible: number;
  /** Short number printed on the ticket (e.g. 609); 0 when none. */
  shortNumber: number;
  vipPoints: number;
  /** Set when the ticket was cashed out; type "FCO" means Fair Cashout. */
  cashout: { type: string; fee: number; feeRate: number; totalOdds: number | null } | null;
  items: TicketItemDTO[];
};
export type TicketResult = { ok: true; ticket: TicketDTO } | { ok: false; error: "SHORT" | "NOT_FOUND" | "UNAVAILABLE" };

export const checkTicket = createServerFn({ method: "POST" })
  .inputValidator((input: { number: string; type?: string }) => ({ number: String(input?.number ?? "").replace(/\D/g, "").slice(0, 30), type: input?.type === 'VSOCCER' || input?.type === 'KENO' ? input.type : undefined }))
  .handler(async ({ data }): Promise<TicketResult> => {
    const n = data.number;
    if (n.length < 14) return { ok: false, error: "SHORT" };
    const virtual = data.type === 'VSOCCER' || n[0] === "4" || n[0] === "5";
    try {
      const {getFortebetSessionCookieHeader} = await import('./account-session.server');
      const {setResponseHeader} = await import('@tanstack/react-start/server');
      setResponseHeader('Cache-Control','no-store');
      const cookie = getFortebetSessionCookieHeader();
      const res = await fetch(BASE + (data.type === 'KENO' ? '/keno/ticket-detail' : virtual ? "/virtual-soccer/ticket-detail" : "/ticket/sbt-detail"), {
        method: "POST",
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json", "Content-Type": "application/json", ...(cookie ? {Cookie:cookie} : {}) },
        body: JSON.stringify({ number: n }),
      });
      const j: Raw = await res.json().catch(() => null);
      if (!j || j.status !== "OK" || !j.data || !j.data.number) {
        return { ok: false, error: j?.code === "ERR_TICKET_NOT_FOUND" || res.status === 404 ? "NOT_FOUND" : j?.code === "ERR_INTERNAL" ? "NOT_FOUND" : "UNAVAILABLE" };
      }
      const d = j.data;
      const f = d.finance ?? {};
      const items: TicketItemDTO[] = (d.items ?? []).map((i: Raw) => ({
        time: String(i.time ?? ""),
        match: String(i.event ?? [i.t1, i.t2].filter(Boolean).join(" - ")).replace(/\s+/g, " ").trim(),
        sport: String(i.sport ?? ""),
        league: [i.category, i.tournament].filter(Boolean).join(" / "),
        market: String(i.market ?? "").replace(/\s+/g, " ").trim(),
        outcome: String(i.outcome ?? "").replace(/\s+/g, " ").trim(),
        odds: Number(i.odds ?? i.oddsPayout) || 0,
        result: i.result ? String(i.result) : null,
        status: String(i.statusReal ?? i.status ?? "OPEN").toUpperCase(),
        live: !!i.live || i.offer?.offerMode === "live",
        cashedOut: String(i.status ?? "").toUpperCase() === "CASHOUT",
        cashoutOdds: i.oddsInCashoutTime != null ? Number(i.oddsInCashoutTime) : null,
      }));
      const lives = items.filter((i) => i.live).length;
      const mode: TicketDTO["mode"] = virtual ? "VIRTUAL" : lives === 0 ? "PREMATCH" : lives === items.length ? "LIVE" : "MIXED";
      const stake = Number(f.stake ?? d.amountIn) || 0;
      const win = Number(f.win ?? f.btto_evk ?? d.amountPossible) || 0;
      return {
        ok: true,
        ticket: {
          number: String(d.number),
          status: String(d.status ?? "Open").toUpperCase(),
          type: String(d.type ?? (items.length > 1 ? "COMBI" : "SINGLE")).toUpperCase(),
          mode,
          placedAt: String(d.timestampIn ?? ""),
          settledAt: d.timestampOut ? String(d.timestampOut) : null,
          totalOdds: Number(d.totalOdds) || 0,
          stake,
          win,
          taxRate: Number(f.tax_out_rate) || 0,
          tax: Number(f.tax_out_value) || 0,
          payout: Number(f.to_pay ?? d.amountOut) || 0,
          possible: Number(d.amountPossible) || win,
          shortNumber: Number(d.shortNumber) || 0,
          vipPoints: Number(f.bonus_vip_points ?? d.bonuses?.vip_points?.value) || 0,
          cashout: f.cashout || String(d.status ?? "").toUpperCase() === "CASHOUT"
            ? { type: String(f.cashout_type ?? ""), fee: Number(f.cashout_fee) || 0, feeRate: Number(f.cashout_fee_rate ?? f.casouht_fee_rate ?? d.cashout?.fco?.feeRate) || 0, totalOdds: d.totalOddsInCashoutTime != null ? Number(d.totalOddsInCashoutTime) : null }
            : null,
          items,
        },
      };
    } catch (e) {
      console.error("ticket check failed", e);
      return { ok: false, error: "UNAVAILABLE" };
    }
  });

// ---------- Casino (All Games) ----------
export const CASINO_IMG = "https://fortebet.ug/static/temp/cms/_games_content/small/";
export const CASINO_ASSETS = "https://fortebet.ug/assets/img/casino/";

export type CasinoGame = {
  id: number;
  provider: string;
  name: string;
  ident: string;
  image: string;
  tags: string[];
  playReal: boolean;
  playFun: boolean;
  sortOrder: number;
  popular: number | null;
  portrait: boolean;
};
export type CasinoJackpot = { ident: string; value: number; speed: number; provider: string };

async function postJson(path: string, body: unknown, ttl = 0, sessionCookie = ""): Promise<Raw> {
  const key = "POST " + path + JSON.stringify(body);
  if (ttl) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.data;
  }
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    },
    body: JSON.stringify(body),
  });
  const data: Raw = await res.json().catch(() => null);
  if (!data) throw new Error(`Fortebet casino feed failed (${res.status})`);
  if (ttl && data.status === "OK") cache.set(key, { at: Date.now(), data });
  return data;
}

export const getCasinoGames = createServerFn({ method: "GET" }).handler(async (): Promise<{ games: CasinoGame[] }> => {
  try {
    const j = await postJson("/casino/games", {}, 600_000);
    const games: CasinoGame[] = (j?.data ?? []).map((g: Raw) => {
      const tags: string[] = (g.settings?.tags ?? []).map((t: unknown) => String(t));
      return {
        id: Number(g.id),
        provider: String(g.provider ?? ""),
        name: String(g.name ?? g.ident ?? ""),
        ident: String(g.identUrl ?? g.ident ?? ""),
        image: String(g.image ?? ""),
        tags,
        playReal: !!g.playReal,
        playFun: !!g.playFun,
        sortOrder: g.sortOrder == null ? 999 : Number(g.sortOrder),
        popular: g.settings?.web_preferred != null ? Number(g.settings.web_preferred) : null,
        portrait: tags.includes("view.portrait"),
      };
    });
    return { games };
  } catch (e) {
    console.error("casino games failed", e);
    return { games: [] };
  }
});

export const getCasinoJackpots = createServerFn({ method: "GET" }).handler(async (): Promise<{ at: number; jackpots: CasinoJackpot[] }> => {
  try {
    const j = await postJson("/casino/jackpots", {}, 30_000);
    return {
      at: Date.now(),
      jackpots: (j?.data ?? []).map((x: Raw) => ({ ident: String(x.ident), value: Number(x.value) || 0, speed: Number(x.speed) || 0, provider: String(x.provider ?? "") })),
    };
  } catch (e) {
    console.error("casino jackpots failed", e);
    return { at: Date.now(), jackpots: [] };
  }
});

export type CasinoWinner = { nickname: string; game: string; image: string; win: number };

/** Latest big casino wins (nicknames already masked by Fortebet). Fortebet caches this list for 60 s. */
export const getCasinoWinners = createServerFn({ method: "GET" }).handler(async (): Promise<{ winners: CasinoWinner[] }> => {
  try {
    const j = await postJson("/casino/winners", {}, 60_000);
    return {
      winners: (j?.data ?? []).map((x: Raw) => ({ nickname: String(x.nickname ?? ""), game: String(x.game ?? ""), image: String(x.image ?? ""), win: Number(x.win) || 0 })),
    };
  } catch (e) {
    console.error("casino winners failed", e);
    return { winners: [] };
  }
});

/** Starts a game exactly like Fortebet's "play-game" call. Without a signed-in Fortebet session only fun (demo) mode is allowed. */
export const playCasinoGame = createServerFn({ method: "POST" })
  .inputValidator((d: { gameId: number; mode: "fun" | "real"; backUrl: string }) => {
    const gameId = Number(d?.gameId);
    if (!Number.isInteger(gameId) || gameId <= 0) throw new Error("Invalid game");
    const mode = d?.mode === "real" ? "real" : "fun";
    const backUrl = typeof d?.backUrl === "string" && /^https?:\/\//.test(d.backUrl) ? d.backUrl.slice(0, 300) : "https://fortebet.ug/slots";
    return { gameId, mode, backUrl } as const;
  })
  .handler(async ({ data }): Promise<{ ok: true; url: string } | { ok: false; error: "LOGIN_REQUIRED" | "UNAVAILABLE" }> => {
    try {
      const { getFortebetSessionCookieHeader } = await import("./account-session.server");
      const sessionCookie = getFortebetSessionCookieHeader();
      const j = await postJson(
        "/casino/play-game",
        { gameId: data.gameId, mode: data.mode, lang: "en", lurl: data.backUrl, kioskName: null },
        0,
        sessionCookie,
      );
      if (j?.status === "OK" && j.data?.url) return { ok: true, url: String(j.data.url) };
      if (j?.code === "ERR_CLIENT_NOT_LOGGED") return { ok: false, error: "LOGIN_REQUIRED" };
      return { ok: false, error: "UNAVAILABLE" };
    } catch (e) {
      console.error("play game failed", e);
      return { ok: false, error: "UNAVAILABLE" };
    }
  });

// ---------- Live schedule (/live/calendar) ----------
export type CalendarRow = { id: string; start: string; sport: string; icon: string; home: string; away: string; league: string };

/** Fortebet's live schedule for one Uganda calendar day (YYYY-MM-DD), same feed as fortebet.ug's Schedule tab. */
export const getLiveCalendar = createServerFn({ method: "GET" })
  .inputValidator((d: { day: string }) => {
    if (typeof d?.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.day)) throw new Error("Invalid day");
    return { day: d.day };
  })
  .handler(async ({ data }): Promise<{ rows: CalendarRow[] }> => {
    const r = await getJson("/offer/live_calendar?lang=en", 60_000);
    const list: Raw[] = Array.isArray(r.data?.data) ? r.data.data : [];
    const rows = list
      .filter((x) => typeof x?.startTs === "string" && new Date(x.startTs).toLocaleDateString("en-CA", { timeZone: "Africa/Kampala" }) === data.day)
      .sort((a, b) => a.startTs.localeCompare(b.startTs) || (a.sportOrder ?? 0) - (b.sportOrder ?? 0))
      .map((x) => ({
        id: String(x.eventId),
        start: String(x.startTs),
        sport: String(x.sport ?? ""),
        icon: String(x.sportIcon ?? ""),
        home: String(x.home ?? ""),
        away: String(x.away ?? ""),
        league: [x.category, x.tournament].filter(Boolean).join(" - "),
      }));
    return { rows };
  });

// Browser-side real-time odds store fed by the public Fortebet live odds socket
// (Socket.IO v4, namespace /liveodds, room OFFER). Payloads are "ZB64 <base64 deflate JSON>".
import { useEffect, useState, useSyncExternalStore } from "react";

type OddsState = { v: number; l: boolean; at: number; prev?: number | undefined; changedAt?: number | undefined };
type EventState = { sc?: string | undefined; st?: string | undefined; at: number; gone?: boolean };

const odds = new Map<number, OddsState>();
const lockedMarkets = new Map<number, { l: boolean; at: number }>();
const events = new Map<string, EventState>();
const listeners = new Set<() => void>();
let version = 0;
let connected = false;

function emit() {
  version++;
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function setOdd(id: number, v: number | undefined, l: boolean | undefined, at: number) {
  const cur = odds.get(id);
  if (cur && cur.at > at) return false;
  const nv = v ?? cur?.v ?? 0;
  const next: OddsState = { v: nv, l: l ?? cur?.l ?? false, at, prev: cur?.prev, changedAt: cur?.changedAt };
  if (cur && v != null && v !== cur.v) {
    next.prev = cur.v;
    next.changedAt = Date.now();
  }
  odds.set(id, next);
  return !cur || cur.v !== next.v || cur.l !== next.l;
}

/** Seed store from a fresh snapshot; newer socket values win. */
export function seedOdds(cells: { id: number; v: number; l?: 1 | boolean }[], at: number) {
  let changed = false;
  for (const c of cells) if (setOdd(c.id, c.v, !!c.l, at)) changed = true;
  if (changed) emit();
}

function scoreOf(sb: any) {
  const st = sb?.status;
  const s = st?.scoreboard;
  const sc = s && s.h != null ? `${s.hg ?? s.h}:${s.ag ?? s.a}` : undefined;
  const status = st?.status ? String(st.status).replace(/_/g, " ") + (st.time ? ` ${st.time}'` : "") : undefined;
  return { sc, st: status };
}

/** Apply one decoded delta frame ({prematch, live}). Exported for tests. */
export function applyDelta(frame: any, at = Date.now()) {
  for (const mode of ["prematch", "live"]) {
    const m = frame?.[mode];
    if (!m) continue;
    for (const [id, o] of Object.entries<any>(m.update?.odds ?? {})) {
      setOdd(Number(id), o.odds != null ? Number(o.odds) : undefined, o.locked != null ? !!o.locked : undefined, at);
    }
    for (const mk of Object.values<any>(m.add?.markets ?? {})) {
      for (const [id, o] of Object.entries<any>(mk.odds ?? {})) setOdd(Number(id), Number(o.odds), !!o.locked || mk.marketStatusId === 0, at);
    }
    for (const [id, mk] of Object.entries<any>(m.update?.markets ?? {})) {
      if (mk.marketStatusId != null) lockedMarkets.set(Number(id), { l: mk.marketStatusId !== 1, at });
    }
    for (const id of (m.del?.markets ?? []) as number[]) lockedMarkets.set(Number(id), { l: true, at });
    for (const [id, e] of Object.entries<any>(m.update?.event ?? {})) {
      const cur = events.get(id) ?? { at };
      const next: EventState = { ...cur, at };
      if (e.scoreboard) Object.assign(next, scoreOf(e.scoreboard));
      if (e.eventStatusId != null && e.eventStatusId !== 1) next.gone = true;
      events.set(id, next);
    }
    for (const id of (m.del?.event ?? m.del?.events ?? []) as string[]) events.set(id, { ...(events.get(id) ?? {}), at, gone: true });
  }
  emit();
}

export function getOdd(id: number) {
  return odds.get(id);
}
export function isMarketLocked(ids: number[] | undefined, since: number) {
  return !!ids?.some((id) => {
    const s = lockedMarkets.get(id);
    return s && s.at >= since && s.l;
  });
}

/** Current odds for a cell: newest of snapshot and live feed, with change direction for ~6s. */
export function useLiveOdd(id: number | undefined, base: number | undefined, baseAt: number, baseLocked = false, marketIds?: number[]) {
  useSyncExternalStore(subscribe, () => version, () => 0);
  const [, tick] = useState(0);
  const s = id != null ? odds.get(id) : undefined;
  const fresh = s && s.at >= baseAt;
  const v = fresh ? s.v : base;
  const locked = (fresh ? s.l : baseLocked) || isMarketLocked(marketIds, baseAt);
  const recent = fresh && s.changedAt && Date.now() - s.changedAt < 6000 ? s : undefined;
  const dir = recent && recent.prev != null ? (recent.v > recent.prev ? "up" : recent.v < recent.prev ? "down" : undefined) : undefined;
  useEffect(() => {
    if (!dir) return;
    const t = setTimeout(() => tick((x) => x + 1), 6100 - (Date.now() - (recent?.changedAt ?? 0)));
    return () => clearTimeout(t);
  }, [dir, recent?.changedAt]);
  return { v, locked, dir: dir as "up" | "down" | undefined };
}

export function useLiveEvent(id: string, base: { sc?: string | undefined; st?: string | undefined }, baseAt: number) {
  useSyncExternalStore(subscribe, () => version, () => 0);
  const e = events.get(id);
  if (!e || e.at < baseAt) return { sc: base.sc, st: base.st, gone: false };
  return { sc: e.sc ?? base.sc, st: e.st ?? base.st, gone: !!e.gone };
}

export function useFeedVersion() {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}
export function useFeedConnected() {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return connected;
}

// ---------- Socket ----------
async function decode(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  for (const fmt of ["deflate", "deflate-raw", "gzip"] as const) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(fmt));
      return JSON.parse(await new Response(stream).text());
    } catch {
      /* try next format */
    }
  }
  return null;
}

let ws: WebSocket | null = null;
let users = 0;
let retry = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let chain: Promise<void> = Promise.resolve();

function open() {
  if (typeof window === "undefined" || ws) return;
  const sock = new WebSocket("wss://www.fortebet.ug/socket.io/?EIO=4&transport=websocket");
  ws = sock;
  sock.onmessage = (ev) => {
    const msg = String(ev.data);
    if (msg === "2") return sock.send("3");
    if (msg.startsWith("0")) return sock.send("40/liveodds,");
    if (msg.startsWith("40/liveodds")) {
      retry = 0;
      connected = true;
      sock.send('42/liveodds,["join",{"room":"OFFER"}]');
      emit();
      return;
    }
    if (msg.startsWith("42/liveodds,")) {
      let arr: any;
      try {
        arr = JSON.parse(msg.slice("42/liveodds,".length));
      } catch {
        return;
      }
      const payload = arr?.[1];
      if (typeof payload !== "string") return;
      const at = Date.now();
      chain = chain.then(async () => {
        const json = payload.startsWith("ZB64 ") ? await decode(payload.slice(5)) : JSON.parse(payload);
        if (json) applyDelta(json, at);
      }).catch(() => undefined);
    }
  };
  sock.onclose = () => {
    ws = null;
    connected = false;
    emit();
    if (users > 0) timer = setTimeout(open, Math.min(30_000, 1000 * 2 ** retry++));
  };
  sock.onerror = () => sock.close();
}

/** Keep the live odds socket open while any component using it is mounted. */
export function useOddsFeed() {
  useEffect(() => {
    users++;
    open();
    return () => {
      users--;
      if (users === 0) {
        clearTimeout(timer);
        ws?.close();
        ws = null;
      }
    };
  }, []);
}

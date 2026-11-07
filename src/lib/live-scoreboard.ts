// Live scoreboard rules mirrored from fortebet.ug's event detail (scoreboard types, columns,
// status labels and match time), so the SCORE tab and the live lists show what Fortebet shows.
import { STATUS_LABELS } from "@/lib/scoreboard-status";

export type RawScoreboard = {
  time?: number | string | null;
  type?: string;
  status?: string;
  subtype?: string;
  match_time?: string;
  remaining_time?: string;
  remaining_time_period?: string;
  scoreboard?: Record<string, number | string | null | undefined>;
};

type Icon = { href: string; color: string };
type Period = { h: string; a: string; name: string };
type Def = {
  periods: Period[];
  scoreName: string;
  serving?: boolean;
  goldenSet?: boolean;
  points?: boolean;
  special?: { h: string; a: string; icon: Icon }[];
  otName?: string;
  penName?: string;
  toPeriod: Record<string, number>;
  fromTotal: boolean;
};

const seq = (n: number, names: (i: number) => string, h = (i: number) => `h${i}`, a = (i: number) => `a${i}`): Period[] =>
  Array.from({ length: n }, (_, k) => ({ h: h(k + 1), a: a(k + 1), name: names(k + 1) }));
const SETS = (n: number) => seq(n, (i) => `S${i}`);
const HALVES = seq(2, (i) => `H${i}`, (i) => `h${i}p`, (i) => `a${i}p`);
const PERIODS = (n: number) => seq(n, (i) => String(i));
const sets = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, k) => [`${k + 1}SET`, k]));

const DEFS: Record<string, Def> = {
  volleyball: { periods: SETS(5), scoreName: "Sets", serving: true, goldenSet: true, fromTotal: false, toPeriod: { ...sets(5), PAUSE1: 0, PAUSE2: 1, PAUSE3: 2, PAUSE4: 3 } },
  beachvolley: { periods: SETS(3), scoreName: "Sets", serving: true, goldenSet: true, fromTotal: false, toPeriod: { ...sets(3), PAUSE1: 0, PAUSE2: 1 } },
  ttenis: { periods: SETS(7), scoreName: "Sets", serving: true, fromTotal: false, toPeriod: sets(7) },
  squash: { periods: PERIODS(5), scoreName: "Score", serving: true, fromTotal: false, toPeriod: {} },
  tennis: { periods: SETS(5), scoreName: "Sets", serving: true, points: true, fromTotal: false, toPeriod: sets(5) },
  futsal: { periods: HALVES, scoreName: "Score", fromTotal: true, special: [{ h: "hSC", a: "aSC", icon: { href: "icoCard", color: "yellow" } }], toPeriod: {} },
  handball: { periods: HALVES, scoreName: "Score", otName: "ET", penName: "7m", fromTotal: true, toPeriod: { FIRST_HALF: 0, PAUSED_HT: 0, SECOND_HALF: 1, ENDED: 1, AWAITING_OT: 1, FIRST_HALF_OT: 1, PAUSED_OT: 1, SECOND_HALF_OT: 1, AFTER_OT: 1, AWAITING_PEN: 1, PENALTIES: 1, AFTER_PENALTIES: 1 } },
  rugby: { periods: HALVES, scoreName: "Score", otName: "ET", fromTotal: true, toPeriod: {} },
  soccer: {
    periods: HALVES, scoreName: "Score", otName: "ET", fromTotal: true, toPeriod: { FIRST_HALF: 0, SECOND_HALF: 1 },
    special: [
      { h: "hYC", a: "aYC", icon: { href: "icoCard", color: "yellow" } },
      { h: "hRC", a: "aRC", icon: { href: "icoCard", color: "red" } },
      { h: "hCR", a: "aCR", icon: { href: "icoCorner", color: "white" } },
    ],
  },
  esoccer: { periods: HALVES, scoreName: "Score", fromTotal: true, toPeriod: { FIRST_HALF: 0, SECOND_HALF: 1 } },
  icehockey: { periods: seq(3, (i) => String(i), (i) => `h${i}p`, (i) => `a${i}p`), scoreName: "Score", fromTotal: true, toPeriod: { FIRST_PERIOD_THIRDS: 0, PAUSE1: 0, SECOND_PERIOD_THIRDS: 1, PAUSE2: 1, THIRD_PERIOD_THIRDS: 2, ENDED: 2, AWAITING_OT: 2, OVERTIME: 2, AFTER_OT: 2, AWAITING_PEN: 2, PENALTIES: 2, AFTER_PENALTIES: 2 } },
  basket: { periods: seq(4, (i) => `${i}Q`), scoreName: "Score", fromTotal: true, toPeriod: { "1QUARTER": 0, "2QUARTER": 1, "3QUARTER": 2, "4QUARTER": 3, PAUSE1: 0, PAUSE2: 1, PAUSE3: 2, FIRST_HALF: 0, SECOND_HALF: 1, PAUSED: 2 } },
  esports: { periods: PERIODS(7), scoreName: "Score", fromTotal: false, toPeriod: {} },
  baseball: { periods: PERIODS(9), scoreName: "Score", fromTotal: false, toPeriod: Object.fromEntries(Array.from({ length: 9 }, (_, k) => [[`${k + 1}INNINGB`, k], [`${k + 1}INNINGT`, k]]).flat()) },
  darts: { periods: [{ h: "h1", a: "a1", name: "Legs" }], scoreName: "Score", serving: true, fromTotal: false, toPeriod: {} },
  snooker: { periods: PERIODS(5), scoreName: "Score", fromTotal: false, toPeriod: {} },
};
const FALLBACK: Def = { periods: [], scoreName: "Score", fromTotal: true, toPeriod: {} };

const OUT_OF_PLAY = new Set(["NOT_STARTED", "ENDED", "PAUSE", "PAUSED", "PAUSED_HT", "PAUSED_OT", "PAUSED_ET", "BREAK", "PAUSE1", "PAUSE2", "PAUSE3", "PAUSE4", "PAUSE5", "PAUSE6", "PAUSE1QT", "PAUSE2QT", "PAUSE3QT", "AWAITING_OT", "AWAITING_PEN", "AWAITING_GS", "AWAITING_ET", "PENALTIES", "POSTPONED", "ABANDONED", "AET", "AFTER_GS", "AFTER_OT", "AFTER_ET", "AFTER_PENALTIES", "AP", "DEFAULTED1", "DEFAULTED2", "DELAYED", "INTERRUPTED", "RETIRED", "RETIRED1", "RETIRED2", "WALKOVER", "WALKOVER1", "WALKOVER2"]);
const isOutOfPlay = (s: string | undefined) => !s || OUT_OF_PLAY.has(s) || s.startsWith("BREAK_T");
const CLOCK_TYPES = new Set(["soccer", "esoccer", "basket", "futsal", "handball", "icehockey", "rugby"]);

/** Fortebet's status text, e.g. SECOND_HALF -> "2nd Half", 1QUARTER -> "1st Qtr.". */
export function statusLabel(status: string | undefined, type: string | undefined): string {
  if (!status) return "";
  const own = type ? STATUS_LABELS[type] : undefined;
  const text = (typeof own === "object" ? own[status] : undefined) ?? (typeof STATUS_LABELS[status] === "string" ? (STATUS_LABELS[status] as string) : status.replace(/_/g, " ").toLowerCase());
  const short = text.replace("quarter", "qtr.");
  return short.length > 2 ? short.charAt(0).toUpperCase() + short.slice(1) : short;
}

/** Match clock like fortebet.ug: soccer 46 in the 1st half is "45'+", 91 in the 2nd half is "90'+"; basketball shows "< N min. to play". */
export function timeLabel(sb: RawScoreboard | undefined): string {
  if (!sb || !sb.type || !CLOCK_TYPES.has(sb.type) || isOutOfPlay(sb.status)) return "";
  if (sb.type === "basket") {
    const rt = sb.remaining_time_period;
    if (!rt) return "";
    const min = parseInt(rt.split(":")[0] ?? "", 10);
    return Number.isFinite(min) ? `< ${min + 1} min. to play` : "";
  }
  const t = sb.time;
  if (t == null || t === "") return "";
  const ts = String(t);
  if (sb.type === "soccer") {
    if (sb.status === "FIRST_HALF" && ts === "46") return "45'+";
    if (sb.status === "SECOND_HALF" && ts === "91") return "90'+";
    if ((sb.status === "FIRST_HALF_OT" || sb.status === "FIRST_HALF_ET") && ts === "106") return "105'+";
    if ((sb.status === "SECOND_HALF_OT" || sb.status === "SECOND_HALF_ET") && ts === "121") return "120'+";
  }
  return `${ts}'`;
}

export type ScoreHeader = { label?: string; icon?: Icon };
export type ScoreRow = { cells: string[]; serving: boolean; winning: boolean };
export type Scoreboard = {
  type: string;
  status: string;
  time: string;
  headers: ScoreHeader[];
  home: ScoreRow;
  away: ScoreRow;
  serving: boolean;
  /** Total score, e.g. "1 : 0". */
  liveScore: string;
  /** Tennis / table tennis current-set text, e.g. "3:2 (15:30*)". */
  textScore: string;
  /** Extra score shown in the live list, e.g. first-half "(1:0)". */
  extra: string;
};

const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));
const show = (v: unknown) => {
  const n = num(v);
  return n == null || Number.isNaN(n) ? (v == null ? "" : String(v)) : String(n);
};

/** Build the SCORE table for one event from Fortebet's scoreboard payload. */
export function buildScoreboard(raw: RawScoreboard | undefined | null): Scoreboard | null {
  if (!raw || !raw.type) return null;
  const type = raw.type;
  const def = DEFS[type] ?? FALLBACK;
  const sb = raw.scoreboard ?? {};
  const g = (k: string) => sb[k];
  let cols = def.periods.length;
  if ((type === "tennis" || type === "ttenis") && raw.subtype === "basic") cols -= 2;
  const periods = def.periods.slice(0, Math.max(0, cols));

  let cur: number | null = null;
  if (raw.status && raw.status in def.toPeriod) cur = def.toPeriod[raw.status] ?? null;
  else for (let i = def.periods.length; i > 0; i--) {
    const p = def.periods[i - 1]!;
    if (num(g(p.h)) || num(g(p.a))) { cur = i - 1; break; }
  }
  const curP = cur != null ? def.periods[cur] : undefined;
  const hCur = curP ? num(g(curP.h)) : null;
  const aCur = curP ? num(g(curP.a)) : null;

  const ot = num(g("aOT")) != null && num(g("aOT"))! > -1 && num(g("hOT")) != null && num(g("hOT"))! > -1;
  const pen = num(g("aPen")) != null && num(g("aPen"))! > -1 && num(g("hPen")) != null && num(g("hPen"))! > -1;
  const gs = !!def.goldenSet && (raw.status === "GOLDENSET" || raw.status === "AFTER_GS" || (num(g("hG")) ?? 0) > 0 || (num(g("aG")) ?? 0) > 0);

  const headers: ScoreHeader[] = [{ label: def.scoreName }, ...periods.map((p) => ({ label: p.name }))];
  if (ot) headers.push({ label: def.otName ?? "OT" });
  if (pen) headers.push({ label: def.penName ?? "PEN" });
  if (gs) headers.push({ label: "GS" });
  for (const s of def.special ?? []) headers.push({ icon: s.icon });
  if (def.points) headers.push({ label: "Points" });

  const side = (s: "h" | "a"): string[] => {
    const cells = [show(g(s)) || "0"];
    periods.forEach((p, i) => cells.push(cur != null && i <= cur || ot ? show(g(s === "h" ? p.h : p.a)) : "-"));
    if (ot) {
      const split = (num(g(`${s}OT1p`)) ?? 0) + (num(g(`${s}OT2p`)) ?? 0);
      cells.push(split > 0 ? String(split) : show(g(`${s}OT`)));
    }
    if (pen) cells.push(show(g(`${s}Pen`)));
    if (gs) cells.push(String(num(g(`${s}G`)) ?? 0));
    for (const sp of def.special ?? []) {
      const v = g(s === "h" ? sp.h : sp.a);
      cells.push(v == null ? "-" : show(v));
    }
    if (def.points) {
      const v = g(`${s}g`);
      cells.push(v === 50 || v === "50" ? "Ad" : show(v ?? 0));
    }
    return cells;
  };

  let hw = num(g("h")) ?? 0;
  let aw = num(g("a")) ?? 0;
  if (hw === aw && !def.fromTotal) { hw = hCur ?? 0; aw = aCur ?? 0; }
  const serving = !!def.serving;
  const sr = num(g("sr"));
  const inPlay = !isOutOfPlay(raw.status);
  let textScore = "";
  if (inPlay && type === "tennis") textScore = `${hCur ?? 0}:${aCur ?? 0} (${sr === 1 ? "*" : ""}${show(g("hg") ?? 0)}:${show(g("ag") ?? 0)}${sr === 2 ? "*" : ""})`;
  if (inPlay && type === "ttenis") textScore = `${sr === 1 ? "*" : ""}${hCur ?? 0}:${aCur ?? 0}${sr === 2 ? "*" : ""}`;

  let extra = "";
  if (ot) extra = `(${periods.map((p) => `${show(g(p.h)) || 0}:${show(g(p.a)) || 0}`).join(", ")})`;
  else if (cur && (type === "soccer" || type === "esoccer")) extra = type === "soccer" ? `(${show(g("h1p")) || 0}:${show(g("a1p")) || 0})` : `(${hCur ?? 0}:${aCur ?? 0})`;

  return {
    type,
    status: statusLabel(raw.status, type),
    time: timeLabel(raw),
    headers,
    home: { cells: side("h"), serving: serving && sr === 1, winning: hw !== aw && hw > aw },
    away: { cells: side("a"), serving: serving && sr === 2, winning: hw !== aw && aw > hw },
    serving,
    liveScore: `${show(g("h")) || 0} : ${show(g("a")) || 0}`,
    textScore,
    extra,
  };
}

/** Merge a socket scoreboard delta into the last known scoreboard (deltas can be partial). */
export function mergeScoreboard(prev: RawScoreboard | undefined, delta: RawScoreboard | undefined): RawScoreboard | undefined {
  if (!delta) return prev;
  if (!prev) return delta;
  return { ...prev, ...delta, scoreboard: { ...(prev.scoreboard ?? {}), ...(delta.scoreboard ?? {}) } };
}

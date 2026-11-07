// Event-detail market layout mirrored from fortebet.ug: one block per market type, lines of the
// same market (e.g. Match Goals 1.5 / 2.5 / 3.5) stacked in one block, Fortebet's grid templates,
// suspended odds hidden (WEB.LIVE.SHOW_SUSPENDED = 0) while keeping each outcome's slot.

type Raw = any;

export type DetailOdd = { id: number; name: string; v: number; l: boolean };
export type DetailMarket = {
  key: string;
  name: string;
  /** Fortebet grid class: way1..way7, way2universal, way3universal, cs, gs. */
  tpl: string;
  /** Market ids feeding this block (live lock updates). */
  mk: number[];
  /** Rows of outcome slots; null keeps a suspended outcome's place. For "cs": [home wins, draws, away wins]. */
  rows: (DetailOdd | null)[][];
  order: number;
};

const TEMPLATE_CLASS: Record<string, string> = {
  "1WAY": "gs", GS: "gs", "2WAY": "way2", "3WAY": "way3", "32WAY": "way3", "4WAY": "way4", "5WAY": "way5", "6WAY": "way6", "7WAY": "way7",
  "2WAYUNIVERSAL": "way2universal", "3WAYUNIVERSAL": "way3universal", CS: "cs",
};
export const templateClass = (t: string | undefined) => (t && TEMPLATE_CLASS[t]) || "way3";

export function ordinal(n: string) {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v)) return n;
  const r = v % 100;
  const suf = r >= 11 && r <= 13 ? "th" : ["th", "st", "nd", "rd"][v % 10] ?? "th";
  return `${v}${v % 10 > 3 ? "th" : suf}`;
}

export function parseSpecifiers(spec: string | null | undefined): Record<string, string> {
  return Object.fromEntries(String(spec ?? "").split("|").filter(Boolean).map((p) => {
    const [k = "", v = ""] = p.split("=");
    return [k, v.replace(/^sr:[a-z_]+:/, "").replace(/_/g, " ")];
  }));
}

/** Fill Fortebet name templates: {$competitor1}, {!goalnr} (ordinal), {+hcp}/{-hcp} (signed), {total}. */
export function fillTemplate(s: string, specs: Record<string, string>, home: string, away: string) {
  return s
    .replace(/\{\$competitor1\}/g, home)
    .replace(/\{\$competitor2\}/g, away)
    .replace(/\{([!+-]?)(\w+)\}/g, (_m, mod: string, k: string) => {
      const v = specs[k];
      if (v == null) return k;
      if (mod === "!") return ordinal(v);
      const n = Number(v);
      if (mod === "+" && Number.isFinite(n)) return n > 0 ? `+${v}` : v;
      if (mod === "-" && Number.isFinite(n)) { const m = -n; return m > 0 ? `+${m}` : String(m); }
      return v;
    })
    .replace(/\s+/g, " ")
    .trim();
}

const lineValue = (spec: string | undefined) => {
  const m = String(spec ?? "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
};

/** Group one event's raw markets into Fortebet's detail blocks. */
export function groupDetailMarkets(markets: Record<string, Raw>, defs: Record<string, Raw>, home: string, away: string): DetailMarket[] {
  const groups = new Map<string, DetailMarket & { lines: { line: number; row: (DetailOdd | null)[] }[]; cs?: DetailOdd[][] }>();
  for (const [mid, m] of Object.entries<Raw>(markets ?? {})) {
    const def = defs?.[String(m.marketId)] ?? {};
    const specs = parseSpecifiers(m.specifiers);
    const name = fillTemplate(String(def.name ?? `Market ${m.marketId}`), specs, home, away);
    const tpl = templateClass(def.template);
    const key = `${m.marketId}|${name}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, name, tpl, mk: [], rows: [], order: Number(def.order ?? 999), lines: [] };
      groups.set(key, g);
    }
    g.mk.push(Number(mid));
    const shut = m.marketStatusId != null && m.marketStatusId !== 1;
    const outs = Object.entries<Raw>(m.odds ?? {})
      .map(([oid, o]) => {
        const od = def.outcome?.[String(o.outcomeId)] ?? {};
        return { order: Number(od.order ?? 99), odd: { id: Number(oid), name: fillTemplate(String(od.name ?? o.outcomeId), specs, home, away), v: Number(o.odds) || 0, l: shut || !!o.locked || !Number(o.odds) } };
      })
      .sort((a, b) => a.order - b.order)
      .map((x) => x.odd);
    if (tpl === "cs") {
      g.cs ??= [[], [], []];
      for (const o of outs) {
        if (o.l) continue;
        const [h, a] = o.name.split(":").map((x) => parseInt(x, 10));
        const col = h == null || a == null || Number.isNaN(h) || Number.isNaN(a) ? 1 : h > a ? 0 : h === a ? 1 : 2;
        g.cs[col]!.push(o);
      }
      continue;
    }
    if (tpl === "way2universal" || tpl === "way3universal") {
      if (outs.some((o) => o.l)) continue;
      g.lines.push({ line: lineValue(m.specifiers), row: outs });
      continue;
    }
    g.lines.push({ line: lineValue(m.specifiers), row: outs.map((o) => (o.l ? null : o)) });
  }
  const out: DetailMarket[] = [];
  for (const g of groups.values()) {
    const rows = g.cs ?? g.lines.sort((a, b) => a.line - b.line).map((l) => l.row);
    if (!rows.some((r) => r.some(Boolean))) continue;
    out.push({ key: g.key, name: g.name, tpl: g.tpl, mk: g.mk, rows, order: g.order });
  }
  return out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** Fortebet odds format: 1.07, 7.80, 55.0, 100. */
export function fmtOdd(v: number) {
  return v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0);
}

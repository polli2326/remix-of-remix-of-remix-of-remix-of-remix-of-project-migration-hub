import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkTicket, type TicketDTO, type TicketResult } from "@/lib/fortebet.functions";

const G = "rgb(0,166,90)";
const WIN_BG = "#3dff3c";
const LOST_BG = "#ff4a3d";
const DARK = "#2e3139";
const PANEL = "#3d3f49";
const LIST = "#2e3139";
const LINE = "rgba(255,255,255,0.08)";

/** Grey padlock used for suspended odds (same shape as Fortebet's lock). */
export function LockIcon({ size = 12, color = "#8b8d96" }: { size?: number; color?: string }) {
  return (
    <svg width={size * (16 / 21)} height={size} viewBox="0 0 16 21" aria-label="Suspended" role="img" style={{ display: "inline-block", verticalAlign: "middle" }}>
      <path fill={color} d="M5,7v-2c0,-1.66 1.34,-3 3,-3c1.66,0 3,1.34 3,3v2zM8,16c-1.1,0 -2,-0.9 -2,-2c0,-1.1 0.9,-2 2,-2c1.1,0 2,0.9 2,2c0,1.1 -0.9,2 -2,2zM14,7h-1v-2c0,-2.76 -2.24,-5 -5,-5c-2.76,0 -5,2.24 -5,5v2h-1c-1.1,0 -2,0.9 -2,2v10c0,1.1 0.9,2 2,2h12c1.1,0 2,-0.9 2,-2v-10c0,-1.1 -0.9,-2 -2,-2z" />
    </svg>
  );
}

/** Round result marker: filled circle with a thin dark mark, like Fortebet's ticket ticks. */
function StatusDot({ status }: { status: string }) {
  const wrap: CSSProperties = { display: "inline-block", flexShrink: 0, verticalAlign: "middle" };
  if (status === "LOCKED") return <span style={{ ...wrap, width: 19, height: 19, borderRadius: 99, background: "#25262c", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><LockIcon size={11} /></span>;
  const mark = (fill: string, label: string, d: string | null) => (
    <svg width="19" height="19" viewBox="0 0 20 20" role="img" aria-label={label} style={wrap}>
      <circle cx="10" cy="10" r="9.5" fill={fill} />
      {d && <path d={d} fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
  if (status === "WIN") return mark(WIN_BG, "Won", "M5.6 10.4l3 3 5.8-6.2");
  if (status === "LOST") return mark(LOST_BG, "Lost", "M6.8 6.8l6.4 6.4M13.2 6.8l-6.4 6.4");
  if (status === "VOID" || status === "CANCELED" || status === "CANCELLED") return mark("#8b8d96", "Void", "M6 10h8");
  if (status === "PREPARING") return (
    <svg width="19" height="19" viewBox="0 0 20 20" role="img" aria-label="Not played yet" style={wrap}>
      <circle cx="10" cy="10" r="9.5" fill="#d8d8d8" />
      <path d="M7.4 7.6a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 3.8" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="15.1" r="1.2" fill={DARK} />
    </svg>
  );
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" role="img" aria-label="Open" style={wrap}>
      <circle cx="10" cy="10" r="8.5" fill="none" stroke="#8b8d96" strokeWidth="2" />
    </svg>
  );
}

/** Green coin with a "C": pick that was still running when the ticket was cashed out. */
function CashoutCoin() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" role="img" aria-label="Cashed out" style={{ display: "inline-block", flexShrink: 0 }}>
      <circle cx="10" cy="10" r="9.5" fill={WIN_BG} />
      <path d="M13.3 7.2a4.2 4.2 0 1 0 0 5.6" fill="none" stroke={DARK} strokeWidth="1.9" strokeLinecap="round" />
      <path d="M10 3.6v12.8" stroke={DARK} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Result tick for a pick; cashed-out picks show a grey tick plus the cashout coin. */
function PickMarks({ it }: { it: Pick<SheetItem, "status" | "cashedOut"> }) {
  if (!it.cashedOut) return <StatusDot status={it.status} />;
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <svg width="19" height="19" viewBox="0 0 20 20" role="img" aria-label="Not counted" style={{ display: "inline-block" }}>
        <circle cx="10" cy="10" r="9.5" fill="#c9cacf" />
        <path d="M5.6 10.4l3 3 5.8-6.2" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <CashoutCoin />
    </span>
  );
}

/** Grey paper ticket with a torn stub on the left, as in the Fortebet ticket header. */
function TicketGlyph({ label }: { label?: string | undefined }) {
  return (
    <svg width="50" height="28" viewBox="0 0 50 28" aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label ? `Short number ${label}` : undefined}>
      <path fill="#d8d8d8" d="M2.5 0H9v28H2.5A2.5 2.5 0 0 1 0 25.5V17.5a3.5 3.5 0 0 0 0-7V2.5A2.5 2.5 0 0 1 2.5 0z" />
      <path fill="#d8d8d8" d="M11 0h36.5A2.5 2.5 0 0 1 50 2.5v23a2.5 2.5 0 0 1-2.5 2.5H11z" />
      <path fill="#b4b4b6" d="M0 23.5h9V28H2.5A2.5 2.5 0 0 1 0 25.5zM11 23.5h39v2a2.5 2.5 0 0 1-2.5 2.5H11z" />
      {label && <text x="30.5" y="17.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#222" fontFamily="inherit">{label}</text>}
    </svg>
  );
}

const RELATIVE_DAY = (d: Date) => {
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(new Date())) / 86400000);
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : null;
};

export const fmtMoney = (n: number, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtStamp = (ts: string) => {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-US", { month: "short", day: "2-digit" })} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
};
const fmtItemTime = (ts: string, relative = false) => {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const date = (relative && RELATIVE_DAY(d)) || d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  return `${date} | ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
};

export type SheetItem = { cashedOut?: boolean | undefined; key: string; time: string; match: string; market: string; outcome: string; odds: number; oldOdds?: number | undefined; result?: string | null; status: string; league?: string | undefined };
export type SheetRow = { label: ReactNode; value: string; accent?: boolean };

/** Shared ticket layout: header bar, picks on the left, status and totals on the right. */
export function TicketSheet({ title, items, status, rows, number, shortNumber, note, relativeDays = false, leftPanel, actions, onClose }: {
  title: string;
  items: SheetItem[];
  status: string;
  rows: SheetRow[];
  number?: string | undefined;
  /** Short ticket number printed on the ticket icon (e.g. 609). */
  shortNumber?: string | undefined;
  /** Small right-aligned notes under the totals. */
  note?: ReactNode;
  /** Show "Today" / "Tomorrow" instead of the date (bet slip preview). */
  relativeDays?: boolean;
  /** Replaces the pick list (e.g. the Fair Cashout calculation). */
  leftPanel?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
}) {
  const [byTime, setByTime] = useState(true);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const list = useMemo(() => (byTime ? [...items].sort((a, b) => a.time.localeCompare(b.time)) : items), [items, byTime]);
  const statusBg = status === "WIN" || status.includes("CASHOUT") ? WIN_BG : status === "LOST" ? LOST_BG : status === "OPEN" || status === "ACTIVE" ? "#f0b429" : status === "PREPARING" ? "#e9e9eb" : "#6b6d76";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ticket detail"
        style={{ width: "min(750px,100%)", height: "min(700px,92vh)", display: "flex", flexDirection: "column", background: PANEL, color: "#e6e6e8", borderRadius: 4, overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.6)", fontFamily: "inherit" }}>
        <div style={{ display: "flex", alignItems: "stretch", background: G, color: "#fff", fontWeight: 700, fontSize: 13 }}>
          <div style={{ flex: 1, padding: "8px 12px" }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: 0, borderLeft: "1px solid rgba(255,255,255,0.35)", color: "#fff", width: 30, fontSize: 18, fontWeight: 900, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)" }}>
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0, background: LIST, borderRight: "1px solid #1f2025" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", fontSize: 12, background: PANEL }}>
              <span>Sort by match start time</span>
              <button aria-label="Sort by match start time" onClick={() => setByTime((v) => !v)}
                style={{ width: 28, height: 16, borderRadius: 99, border: 0, background: byTime ? "#1f2025" : "#5a5c66", position: "relative", cursor: "pointer", padding: 0 }}>
                <span style={{ position: "absolute", top: 2, left: byTime ? 14 : 2, width: 12, height: 12, borderRadius: 99, background: byTime ? G : "#c9cacf", transition: "left .15s" }} />
              </button>
            </div>
            {leftPanel ?? <div style={{ flex: 1, overflowY: "auto", padding: "0 14px" }}>
              {list.map((it) => (
                <div key={it.key} style={{ padding: "10px 0", borderBottom: `1px solid ${LINE}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ whiteSpace: "nowrap" }}>{fmtItemTime(it.time, relativeDays)}</span>
                      <span className="ico soccer h12 opa06" style={{ display: "inline-block", flexShrink: 0 }} />
                      {it.league && <span style={{ fontSize: 12, color: "#b9bac0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.league.replace(/\s*\/\s*/g, " - ")}</span>}
                    </span>
                    <PickMarks it={it} />
                  </div>
                  <div style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 12, margin: "6px 0 5px" }}>{it.match}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                    <span>{it.market} : <b>{it.outcome}</b></span>
                    <b style={{ whiteSpace: "nowrap" }}>
                      {it.status === "LOCKED" ? <LockIcon size={12} /> : <>{it.oldOdds != null && <s style={{ opacity: 0.5, fontSize: 10, marginRight: 4 }}>{it.oldOdds.toFixed(2)}</s>}{it.odds.toFixed(2)}</>}
                    </b>
                  </div>
                  {it.result && <span style={{ display: "inline-block", marginTop: 6, background: "#d9d9dc", color: "#222", fontWeight: 700, fontSize: 11, padding: "1px 5px", borderRadius: 3 }}>{it.result}</span>}
                </div>
              ))}
            </div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "stretch", borderBottom: "2px solid #25272e", height: 50, flexShrink: 0 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 13px" }}>
                <TicketGlyph label={shortNumber} />
              </div>
              <div style={{ display: "flex", alignItems: "center", padding: "0 11px", fontWeight: 700, fontSize: 14, color: "#d8d8da" }}>STATUS:</div>
              <div style={{ minWidth: 80, display: "flex", alignItems: "center", justifyContent: "center", background: statusBg, color: "#333", fontSize: 20, fontWeight: 400, letterSpacing: 0.3, padding: "0 8px", whiteSpace: "nowrap" }}>{status}</div>
            </div>
            <div style={{ padding: "9px 13px 10px", background: LIST, borderBottom: "2px solid #25272e", lineHeight: "21px", fontSize: 13, fontWeight: 700, color: "#e3e3e5" }}>
              {rows.map((r, k) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: r.accent ? "#22d47e" : undefined }}><span style={{ display: "flex" }}>{r.label}</span><span>{r.value}</span></div>
              ))}
              {note && <div style={{ textAlign: "right", fontSize: 12, fontWeight: 400, lineHeight: "19px", marginTop: 3, color: "#d8d8da" }}>{note}</div>}
            </div>
            {actions && <div style={{ padding: "10px 13px", borderBottom: "2px solid #25272e", display: "grid", gap: 8 }}>{actions}</div>}
            {number && <div style={{ margin: "14px 13px", background: "#eaeaea", color: "#444", textAlign: "center", fontSize: 14, lineHeight: "24px", padding: "0 6px", letterSpacing: 0.1 }}>Ticket No. {number}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export const sheetBtn: CSSProperties = { display: "flex", alignItems: "center", gap: 0, height: 38, background: "#d7d7d9", color: "#3a3c44", border: 0, borderRadius: 3, padding: "0 16px", fontWeight: 700, fontSize: 15, cursor: "pointer", width: "100%", textAlign: "left" };

function ShareIcon() {
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" fill="none" stroke="#3a3c44" strokeWidth="1.6" aria-hidden="true" style={{ marginRight: 22, flexShrink: 0 }}>
      <circle cx="14.5" cy="3.5" r="2.4" /><circle cx="3.5" cy="10" r="2.4" /><circle cx="14.5" cy="16.5" r="2.4" />
      <path d="M5.6 8.8l6.8-4M5.6 11.2l6.8 4" />
    </svg>
  );
}

function TicketTag() {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true" style={{ marginRight: 20, flexShrink: 0 }}>
      <path fill="#fff" d="M1.5 0H5v14H1.5A1.5 1.5 0 0 1 0 12.5V9a2 2 0 0 0 0-4V1.5A1.5 1.5 0 0 1 1.5 0zM6.5 0h14A1.5 1.5 0 0 1 22 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-14z" />
    </svg>
  );
}

const ACC = "#22d47e";

/** Left-side "Fair Cashout calculation": matches still running at cashout time and how the amount was reached. */
function CashoutCalc({ ticket, fair, onClose }: { ticket: TicketDTO; fair: boolean; onClose: () => void }) {
  const open = ticket.items.filter((i) => i.cashedOut);
  const sep: CSSProperties = { borderBottom: `1px solid ${LINE}` };
  const accRow: CSSProperties = { display: "flex", justifyContent: "space-between", color: ACC, fontWeight: 700, fontSize: 13, lineHeight: "23px" };
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }} aria-label="Fair cashout calculation">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 14px", height: 50, background: PANEL, borderTop: "1px solid #25272e", borderBottom: "2px solid #25272e" }}>
        <span style={{ fontSize: 17, letterSpacing: 0.2, color: "#d8d8da" }}>{fair ? "FAIR CASHOUT" : "CASHOUT"} CALCULATION</span>
        <button onClick={onClose} aria-label="Close calculation" style={{ background: "transparent", border: 0, color: "#c9cacf", cursor: "pointer", padding: 4, display: "flex" }}>
          <svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2 2l14 14M16 2L2 16" /></svg>
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px" }}>
        <div style={{ ...sep, color: ACC, fontWeight: 700, fontSize: 13, padding: "13px 0 12px" }}>UNFINISHED MATCHES AT CASHOUT TIME</div>
        {open.length === 0 && <div style={{ ...sep, padding: "10px 0", fontSize: 12, color: "#b9bac0" }}>All matches had finished.</div>}
        {open.map((i, k) => (
          <div key={k} style={{ ...sep, padding: "12px 0 10px", fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ textTransform: "uppercase", fontSize: 12 }}>{i.match}</b>
              <PickMarks it={i} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span>{i.market} : <b>{i.outcome}</b></span><b>{i.odds.toFixed(2)}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, color: "#a9aab0" }}><span>Odds in cashout time</span><span style={{ color: ACC }}>{(i.cashoutOdds ?? i.odds).toFixed(2)}</span></div>
          </div>
        ))}
        <div style={{ ...sep, padding: "9px 0" }}>
          <div style={accRow}><span>ORIGINAL POSSIBLE WIN</span><span>{fmtMoney(ticket.possible)} UGX</span></div>
          <div style={accRow}><span>TOTAL ODDS IN CASHOUT TIME</span><span>{(ticket.cashout?.totalOdds ?? 1).toFixed(2)}</span></div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", fontWeight: 700, fontSize: 13, color: ACC }}>
          <CashoutBadge fair={fair} /><span>{fmtMoney(ticket.payout)} UGX</span>
        </div>
      </div>
    </div>
  );
}

function CalcIcon() {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" stroke="#fff" strokeWidth="1.5" aria-hidden="true" style={{ marginRight: 24, flexShrink: 0 }}>
      <rect x="1" y="1" width="14" height="18" rx="1.5" /><rect x="3.5" y="3.5" width="9" height="3.5" />
      {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={3.3 + c * 3.4} y={9.3 + r * 3.2} width="1.6" height="1.4" fill="#fff" stroke="none" />))}
    </svg>
  );
}

/** "FAIR | CASHOUT" label, white then green, as on Fortebet. */
function CashoutBadge({ fair }: { fair: boolean }) {
  return (
    <span style={{ display: "inline-flex", fontSize: 12, fontWeight: 900, lineHeight: "20px", borderRadius: 2, overflow: "hidden" }}>
      {fair && <span style={{ background: "#fff", color: "#222", padding: "0 5px" }}>FAIR</span>}
      <span style={{ background: G, color: "#fff", padding: "0 6px" }}>CASHOUT</span>
    </span>
  );
}

const MODE_LABEL: Record<TicketDTO["mode"], string> = { PREMATCH: "PREMATCH", LIVE: "LIVE", MIXED: "PREMATCH + LIVE", VIRTUAL: "VIRTUAL SOCCER" };

export function TicketDetailModal({ ticket, onClose }: { ticket: TicketDTO; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}/?ticket=${ticket.number}`;
    try {
      if (navigator.share) await navigator.share({ title: `Ticket ${ticket.number}`, url });
      else await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled */
    }
  };
  const [explain, setExplain] = useState(false);
  const type = ticket.type.replace(/^(LIVE|PREMATCH|MIXED)_/, "").replace(/^COMBI$/, "COMBO");
  const co = ticket.cashout;
  const fair = co?.type === "FCO";
  const rows: SheetRow[] = [
    { label: "TOTAL ODDS", value: fmtMoney(ticket.totalOdds, 2) },
    { label: "STAKE", value: `${fmtMoney(ticket.stake)} UGX` },
  ];
  let note: ReactNode = null;
  if (co) {
    rows.push({ label: "ORIGINAL POSSIBLE WIN", value: `${fmtMoney(ticket.possible)} UGX` });
    rows.push({ label: <CashoutBadge fair={fair} />, value: `${fmtMoney(ticket.payout)} UGX *`, accent: true });
    note = <>
      {co.fee > 0 && <div>* FEE of {fmtMoney(co.fee)} UGX applied</div>}
      {ticket.vipPoints <= 0 && <div>NO VIP PTS credited</div>}
    </>;
  } else {
    rows.push({ label: ticket.status === "WIN" ? "REAL WIN" : "POSSIBLE WIN", value: `${fmtMoney(ticket.status === "WIN" ? ticket.payout : ticket.possible)} UGX`, accent: true });
    if (ticket.taxRate > 0) rows.push({ label: `WIN TAX ${Math.round(ticket.taxRate * 100)}%`, value: `${fmtMoney(ticket.tax)} UGX` });
    rows.push({ label: "TOTAL PAYOUT", value: `${fmtMoney(ticket.payout)} UGX` });
  }
  return (
    <TicketSheet
      title={`${MODE_LABEL[ticket.mode]} | ${type} ${ticket.items.length} event${ticket.items.length === 1 ? "" : "s"} | ${fmtStamp(ticket.placedAt)}`}
      status={co ? (fair ? "FAIR CASHOUT" : "CASHOUT") : ticket.status}
      shortNumber={ticket.shortNumber ? String(ticket.shortNumber) : undefined}
      rows={rows}
      note={note}
      number={ticket.number}
      onClose={onClose}
      items={ticket.items.map((i, k) => ({ key: String(k), time: i.time, match: i.match, market: i.market, outcome: i.outcome, odds: i.odds, result: i.result, status: i.status, cashedOut: i.cashedOut }))}
      leftPanel={co && explain ? <CashoutCalc ticket={ticket} fair={fair} onClose={() => setExplain(false)} /> : undefined}
      actions={<>
        {co && (
          <button style={{ ...sheetBtn, background: G, color: "#fff" }} onClick={() => setExplain((v) => !v)}>
            {explain ? <><TicketTag /> Back to ticket detail</> : <><CalcIcon /> How we count it</>}
          </button>
        )}
        <button style={sheetBtn} onClick={share}><ShareIcon /> {copied ? "Link copied" : "Share ticket"}</button>
      </>}
    />
  );
}

const ERRORS: Record<Exclude<TicketResult, { ok: true }>["error"], string> = {
  SHORT: "The ticket number is at least 14 digits",
  NOT_FOUND: "Ticket number not found",
  UNAVAILABLE: "Ticket check is not available right now. Try again.",
};

/** Right-bar "Ticket search" box: checks a real Fortebet ticket and opens it. */
export function TicketSearch() {
  const check = useServerFn(checkTicket);
  const [num, setNum] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketDTO | null>(null);
  const run = async (n: string) => {
    setError(null);
    if (!n) return;
    if (n.length < 14) return setError(ERRORS.SHORT);
    setLoading(true);
    try {
      const r = await check({ data: { number: n } });
      if (r.ok) setTicket(r.ticket);
      else setError(ERRORS[r.error]);
    } catch {
      setError(ERRORS.UNAVAILABLE);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("ticket")?.replace(/\D/g, "");
    if (t) {
      setNum(t);
      void run(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div data-ce="sbticket-search" style={{ position: "relative" }}>
      <form className="ticketSearch" onSubmit={(e) => { e.preventDefault(); void run(num); }}>
        <h3>Ticket search</h3>
        <input className="w100p" type="text" placeholder="Insert ticket number ..." name="ticketSearch" inputMode="numeric" aria-label="Ticket number"
          value={num} onChange={(e) => { setNum(e.target.value.replace(/\D/g, "")); setError(null); }} />
        {error && <div className="error-message" role="alert" style={{ fontSize: 12 }}>⚠ {error}</div>}
        <div className="buttons uppercase [font-weight:700]">
          <a className="curPointer" role="button" onClick={() => void run(num)} style={{ opacity: loading ? 0.6 : 1 }}> {loading ? "Checking…" : "Check ticket"} </a>
        </div>
      </form>
      {ticket && <TicketDetailModal ticket={ticket} onClose={() => setTicket(null)} />}
    </div>
  );
}

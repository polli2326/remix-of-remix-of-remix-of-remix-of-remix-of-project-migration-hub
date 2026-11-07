import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeftRight,
  Mail,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Ticket,
  UserRound,
} from "lucide-react";
import { AccountHeader } from "@/components/account-header";
import { Button } from "@/components/ui/button";
import {
  getSignedInAccountActivity,
  type FortebetClientRecord,
  type SignedInAccountActivityResult,
} from "@/lib/account.functions";

type ActivitySectionKey =
  "profile" | "preferences" | "transactions" | "tickets" | "messages" | "session";

type ActivitySectionConfig = {
  key: ActivitySectionKey;
  title: string;
  description: string;
  icon: ReactNode;
};

const sections: ActivitySectionConfig[] = [
  {
    key: "profile",
    title: "Profile",
    description: "Account details on file",
    icon: <UserRound aria-hidden="true" />,
  },
  {
    key: "preferences",
    title: "Preferences",
    description: "Your account preferences",
    icon: <SlidersHorizontal aria-hidden="true" />,
  },
  {
    key: "transactions",
    title: "Transactions",
    description: "Wallet activity records",
    icon: <ArrowLeftRight aria-hidden="true" />,
  },
  {
    key: "tickets",
    title: "Tickets",
    description: "Your ticket records",
    icon: <Ticket aria-hidden="true" />,
  },
  {
    key: "messages",
    title: "Messages",
    description: "Account messages",
    icon: <Mail aria-hidden="true" />,
  },
  {
    key: "session",
    title: "Session",
    description: "Current account session status",
    icon: <Activity aria-hidden="true" />,
  },
];

function formatBalance(balance: number, currency: string) {
  try {
    return (
      new Intl.NumberFormat("en-UG", {
        maximumFractionDigits: 2,
      }).format(balance) + ` ${currency}`
    );
  } catch {
    return `${balance} ${currency}`;
  }
}

function displayValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  try {
    return JSON.stringify(value);
  } catch {
    return "Value unavailable";
  }
}

function ValueView({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) {
    return <span className="aad-null">{value === null ? "null" : "Not provided"}</span>;
  }

  if (typeof value !== "object") {
    return <span className="aad-scalar">{displayValue(value)}</span>;
  }

  if (depth >= 4) {
    return (
      <pre className="aad-compact-json">
        {typeof value === "object" ? JSON.stringify(value, null, 2) : displayValue(value)}
      </pre>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="aad-empty-value">No records returned</span>;
    }

    return (
      <ol className="aad-array">
        {value.map((item, index) => (
          <li className="aad-array-item" key={`item-${index}`}>
            <span className="aad-array-index">{String(index + 1).padStart(2, "0")}</span>
            <div className="aad-array-content">
              <ValueView value={item} depth={depth + 1} />
            </div>
          </li>
        ))}
      </ol>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return <span className="aad-empty-value">No details returned</span>;
  }

  return (
    <dl className="aad-fields">
      {entries.map(([key, item]) => (
        <div className="aad-field" key={key}>
          <dt>{key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ")}</dt>
          <dd>
            <ValueView value={item} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RecordSection({
  config,
  record,
}: {
  config: ActivitySectionConfig;
  record: FortebetClientRecord;
}) {
  return (
    <section className="aad-section" aria-labelledby={`aad-${config.key}-title`}>
      <header className="aad-section-header">
        <div className="aad-section-heading">
          <span className="aad-section-icon">{config.icon}</span>
          <div>
            <h2 id={`aad-${config.key}-title`}>{config.title}</h2>
            <p>{config.description}</p>
          </div>
        </div>
        <span className={`aad-record-status ${record.ok ? "is-ready" : "is-unavailable"}`}>
          <span aria-hidden="true" />
          {record.ok ? "Available" : "Unavailable"}
        </span>
      </header>

      <div className="aad-section-body">
        {record.ok ? (
          record.data === null || record.data === undefined ? (
            <div className="aad-section-empty">
              No {config.title.toLowerCase()} records returned.
            </div>
          ) : (
            <ValueView value={record.data} />
          )
        ) : (
          <div className="aad-section-error" role="status">
            <AlertCircle aria-hidden="true" />
            <span>{record.message}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="aad-loading" aria-label="Loading account activity" role="status">
      <div className="aad-skeleton aad-skeleton-summary" />
      <div className="aad-skeleton-grid">
        {sections.map((section) => (
          <div className="aad-skeleton aad-skeleton-section" key={section.key}>
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading your account records…</span>
    </div>
  );
}

export function AccountActivityDashboard() {
  const [result, setResult] = useState<Extract<SignedInAccountActivityResult, { ok: true }> | null>(
    null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getSignedInAccountActivity();
      if (!response.ok) {
        setResult(null);
        setError(response.message);
      } else {
        setResult(response);
      }
    } catch {
      setResult(null);
      setError("Account activity could not be reached. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity, refreshCount]);

  const reload = () => setRefreshCount((count) => count + 1);

  return (
    <main className="aad-dashboard">
      <div className="aad-topbar">
        <div className="aad-brand-lockup" aria-label="Fortebet account center">
          <span className="aad-brand-mark" aria-hidden="true">
            F
          </span>
          <span>
            <strong>FORTEBET</strong>
            <small>ACCOUNT CENTER</small>
          </span>
        </div>
        <AccountHeader />
      </div>

      <div className="aad-content">
        <div className="aad-page-heading">
          <div>
            <div className="aad-eyebrow">PERSONAL RECORDS</div>
            <h1>Account activity</h1>
            <p>Review the information and activity linked to your Fortebet account.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="aad-reload"
            onClick={reload}
            disabled={loading}
            aria-label="Reload account activity"
          >
            <RefreshCw aria-hidden="true" className={loading ? "aad-refreshing" : ""} />
            <span>{loading ? "Loading" : "Reload"}</span>
          </Button>
        </div>

        <aside className="aad-scope-notice" aria-label="Account data scope">
          <ShieldCheck aria-hidden="true" />
          <p>
            <strong>Your account only.</strong> These records belong to the currently signed-in
            Fortebet user. Site-wide administration and access to other users’ data are unavailable
            here.
          </p>
        </aside>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <section className="aad-error-state" role="alert">
            <span className="aad-error-icon">
              <AlertCircle aria-hidden="true" />
            </span>
            <div>
              <h2>Account activity unavailable</h2>
              <p>{error}</p>
              <Button type="button" className="aad-retry" onClick={reload}>
                <RefreshCw aria-hidden="true" />
                Try again
              </Button>
            </div>
          </section>
        ) : result ? (
          <>
            <section className="aad-account-summary" aria-label="Signed-in account">
              <div className="aad-account-identity">
                <span className="aad-account-avatar" aria-hidden="true">
                  {(result.account.displayName || result.account.nickname)
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("") || "U"}
                </span>
                <div>
                  <span className="aad-summary-label">SIGNED-IN ACCOUNT</span>
                  <strong>{result.account.displayName || result.account.nickname}</strong>
                  <span className="aad-nickname">@{result.account.nickname}</span>
                </div>
              </div>
              <div className="aad-balance">
                <span>Available balance</span>
                <strong>{formatBalance(result.account.balance, result.account.currency)}</strong>
              </div>
              <div className="aad-record-count">
                <span className="aad-count-icon">
                  <Activity aria-hidden="true" />
                </span>
                <span>
                  <strong>{sections.length}</strong>
                  <small>account sections</small>
                </span>
              </div>
            </section>

            <div className="aad-section-intro">
              <h2>Your records</h2>
              <span>Read-only account data</span>
            </div>
            <div className="aad-section-grid">
              {sections.map((config) => (
                <RecordSection key={config.key} config={config} record={result[config.key]} />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <style>{`
        .aad-dashboard {
          --aad-bg: #272936;
          --aad-panel: #30323f;
          --aad-panel-raised: #373a47;
          --aad-line: rgba(207, 209, 218, .15);
          --aad-text: #e2e2e5;
          --aad-muted: #a5a7b0;
          --aad-green: #9bef00;
          --aad-green-deep: #426d15;
          --aad-gold: #e7c456;
          min-height: 100dvh;
          background: var(--aad-bg);
          color: var(--aad-text);
          font-family: inherit;
          padding-bottom: 44px;
        }
        .aad-dashboard * { box-sizing: border-box; }
        .aad-topbar {
          position: relative;
          display: flex;
          min-height: 58px;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 9px clamp(14px, 3vw, 42px);
          border-bottom: 1px solid rgba(255,255,255,.08);
          background: #222430;
        }
        .aad-brand-lockup { display: flex; align-items: center; gap: 9px; }
        .aad-brand-mark {
          display: grid;
          width: 32px;
          height: 32px;
          place-items: center;
          border-radius: 7px 7px 7px 2px;
          background: var(--aad-green);
          color: #17210b;
          font-size: 20px;
          font-weight: 950;
          font-style: italic;
          line-height: 1;
        }
        .aad-brand-lockup > span:last-child { display: grid; gap: 1px; }
        .aad-brand-lockup strong { color: #f3f3f4; font-size: 12px; letter-spacing: .08em; }
        .aad-brand-lockup small { color: #999ba5; font-size: 8px; font-weight: 800; letter-spacing: .15em; }
        .aad-content { width: min(1180px, 100%); margin: 0 auto; padding: 27px clamp(14px, 3vw, 34px) 0; }
        .aad-page-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
        }
        .aad-eyebrow { color: var(--aad-green); font-size: 10px; font-weight: 850; letter-spacing: .16em; }
        .aad-page-heading h1 { margin: 5px 0 4px; color: #f1f1f2; font-size: clamp(25px, 4vw, 34px); font-weight: 800; letter-spacing: -.035em; line-height: 1.1; }
        .aad-page-heading p { margin: 0; color: var(--aad-muted); font-size: 13px; line-height: 1.5; }
        .aad-reload, .aad-retry {
          display: inline-flex;
          height: 35px;
          flex: 0 0 auto;
          align-items: center;
          gap: 7px;
          border: 1px solid rgba(255,255,255,.17);
          border-radius: 5px;
          background: #373a47;
          color: #e6e7eb;
          font-size: 12px;
          font-weight: 700;
        }
        .aad-reload:hover { background: #414451; color: white; }
        .aad-reload svg, .aad-retry svg { width: 14px; height: 14px; }
        .aad-reload:disabled { opacity: .62; }
        .aad-refreshing { animation: aad-spin 1.15s linear infinite; }
        @keyframes aad-spin { to { transform: rotate(360deg); } }
        .aad-scope-notice {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 18px;
          padding: 11px 13px;
          border: 1px solid rgba(155,239,0,.28);
          border-left: 3px solid var(--aad-green);
          border-radius: 5px;
          background: rgba(155,239,0,.07);
        }
        .aad-scope-notice svg { width: 17px; height: 17px; flex: 0 0 auto; margin-top: 1px; color: var(--aad-green); }
        .aad-scope-notice p { margin: 0; color: #c9cbd1; font-size: 12px; line-height: 1.55; }
        .aad-scope-notice strong { color: #eff3e8; }
        .aad-account-summary {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 25px;
          min-height: 93px;
          margin-bottom: 22px;
          padding: 15px 19px;
          border: 1px solid var(--aad-line);
          border-radius: 7px;
          background: linear-gradient(105deg, #343744, #30323f 66%);
        }
        .aad-account-identity { display: flex; min-width: 0; align-items: center; gap: 12px; }
        .aad-account-avatar {
          display: grid;
          width: 43px;
          height: 43px;
          flex: 0 0 auto;
          place-items: center;
          border-radius: 9px;
          background: #a2e43f;
          color: #18220c;
          font-size: 13px;
          font-weight: 900;
        }
        .aad-account-identity > div { display: grid; min-width: 0; gap: 2px; }
        .aad-summary-label { color: #9699a4; font-size: 9px; font-weight: 850; letter-spacing: .11em; }
        .aad-account-identity strong { overflow: hidden; color: #f1f1f2; font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }
        .aad-nickname { color: #a9abb4; font-size: 11px; }
        .aad-balance { display: grid; gap: 4px; padding-left: 21px; border-left: 1px solid var(--aad-line); }
        .aad-balance > span { color: #a9abb4; font-size: 10px; }
        .aad-balance strong { color: var(--aad-gold); font-size: 19px; font-variant-numeric: tabular-nums; letter-spacing: -.02em; white-space: nowrap; }
        .aad-record-count { display: flex; align-items: center; gap: 9px; padding-left: 20px; border-left: 1px solid var(--aad-line); }
        .aad-count-icon { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 6px; background: rgba(155,239,0,.1); color: var(--aad-green); }
        .aad-count-icon svg { width: 15px; height: 15px; }
        .aad-record-count > span:last-child { display: grid; gap: 1px; }
        .aad-record-count strong { font-size: 14px; font-variant-numeric: tabular-nums; }
        .aad-record-count small { color: var(--aad-muted); font-size: 10px; white-space: nowrap; }
        .aad-section-intro { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 1px 10px; }
        .aad-section-intro h2 { margin: 0; color: #ececef; font-size: 15px; font-weight: 800; }
        .aad-section-intro > span { color: #9799a3; font-size: 10px; }
        .aad-section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .aad-section {
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--aad-line);
          border-radius: 6px;
          background: var(--aad-panel);
        }
        .aad-section-header { display: flex; min-height: 58px; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 13px; border-bottom: 1px solid var(--aad-line); background: rgba(255,255,255,.018); }
        .aad-section-heading { display: flex; min-width: 0; align-items: center; gap: 9px; }
        .aad-section-icon { display: grid; width: 29px; height: 29px; flex: 0 0 auto; place-items: center; border: 1px solid rgba(155,239,0,.18); border-radius: 6px; background: rgba(155,239,0,.07); color: #b5e979; }
        .aad-section-icon svg { width: 15px; height: 15px; }
        .aad-section-heading h2 { margin: 0; color: #e9e9ec; font-size: 12px; font-weight: 800; }
        .aad-section-heading p { overflow: hidden; max-width: 260px; margin: 2px 0 0; color: #9699a4; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
        .aad-record-status { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 5px; color: #aaaeb7; font-size: 9px; font-weight: 700; }
        .aad-record-status > span { width: 6px; height: 6px; border-radius: 50%; background: #737681; }
        .aad-record-status.is-ready { color: #b9dc8d; }
        .aad-record-status.is-ready > span { background: #9bef00; }
        .aad-record-status.is-unavailable { color: #e5b5a8; }
        .aad-record-status.is-unavailable > span { background: #e18770; }
        .aad-section-body { max-height: 410px; min-height: 78px; overflow: auto; padding: 10px 13px 12px; scrollbar-color: #5b5e69 transparent; scrollbar-width: thin; }
        .aad-fields { display: grid; gap: 0; margin: 0; }
        .aad-field { display: grid; grid-template-columns: minmax(90px, 34%) minmax(0, 1fr); gap: 10px; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,.055); }
        .aad-field:last-child { border-bottom: 0; }
        .aad-field dt { overflow-wrap: anywhere; color: #9fa2ac; font-size: 10px; font-weight: 700; text-transform: capitalize; }
        .aad-field dd { min-width: 0; margin: 0; color: #dedfe3; font-size: 11px; line-height: 1.45; overflow-wrap: anywhere; }
        .aad-scalar { white-space: pre-wrap; }
        .aad-null, .aad-empty-value { color: #858894; font-size: 10px; font-style: italic; }
        .aad-array { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
        .aad-array-item { display: grid; grid-template-columns: 25px minmax(0, 1fr); gap: 8px; padding: 8px; border: 1px solid rgba(255,255,255,.07); border-radius: 4px; background: rgba(255,255,255,.025); }
        .aad-array-index { padding-top: 2px; color: #a7ce70; font-size: 9px; font-weight: 850; font-variant-numeric: tabular-nums; }
        .aad-array-content { min-width: 0; }
        .aad-array-content > .aad-fields .aad-field:first-child { padding-top: 0; }
        .aad-compact-json { max-width: 100%; margin: 0; overflow: auto; color: #c6c8d0; font: 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
        .aad-section-empty { display: grid; min-height: 54px; place-items: center; color: #9fa1aa; font-size: 11px; text-align: center; }
        .aad-section-error { display: flex; align-items: flex-start; gap: 7px; color: #e7b8ac; font-size: 11px; line-height: 1.5; }
        .aad-section-error svg { width: 14px; height: 14px; flex: 0 0 auto; margin-top: 1px; }
        .aad-error-state { display: flex; max-width: 620px; align-items: flex-start; gap: 14px; margin: 42px auto; padding: 22px; border: 1px solid rgba(225,135,112,.3); border-radius: 7px; background: #32313a; }
        .aad-error-icon { display: grid; width: 35px; height: 35px; flex: 0 0 auto; place-items: center; border-radius: 50%; background: rgba(225,135,112,.12); color: #e99a84; }
        .aad-error-icon svg { width: 18px; height: 18px; }
        .aad-error-state h2 { margin: 0 0 4px; color: #f0e8e6; font-size: 15px; }
        .aad-error-state p { margin: 0 0 13px; color: #bab7bd; font-size: 12px; line-height: 1.5; }
        .aad-retry { border-color: rgba(255,255,255,.18); background: #41424e; }
        .aad-loading { display: grid; gap: 13px; }
        .aad-skeleton { position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,.06); border-radius: 6px; background: #30323f; }
        .aad-skeleton::after { position: absolute; inset: 0; background: linear-gradient(100deg, transparent 20%, rgba(255,255,255,.055) 48%, transparent 76%); content: ""; transform: translateX(-100%); animation: aad-shimmer 1.6s ease-in-out infinite; }
        @keyframes aad-shimmer { to { transform: translateX(100%); } }
        .aad-skeleton-summary { height: 93px; }
        .aad-skeleton-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .aad-skeleton-section { display: grid; gap: 10px; min-height: 126px; padding: 15px; }
        .aad-skeleton-section span { display: block; width: 46%; height: 8px; border-radius: 4px; background: rgba(255,255,255,.08); }
        .aad-skeleton-section span:nth-child(2) { width: 84%; }
        .aad-skeleton-section span:nth-child(3) { width: 65%; }
        @media (max-width: 680px) {
          .aad-topbar { min-height: 52px; padding-inline: 12px; }
          .aad-brand-mark { width: 29px; height: 29px; }
          .aad-content { padding: 21px 12px 0; }
          .aad-page-heading { align-items: flex-start; }
          .aad-page-heading p { max-width: 390px; font-size: 12px; }
          .aad-reload { width: 35px; justify-content: center; padding: 0; }
          .aad-reload span { display: none; }
          .aad-account-summary { grid-template-columns: minmax(0, 1fr) auto; gap: 14px 10px; padding: 13px; }
          .aad-balance { grid-column: 1 / -1; grid-row: 2; padding: 10px 0 0; border-top: 1px solid var(--aad-line); border-left: 0; }
          .aad-balance strong { font-size: 17px; }
          .aad-record-count { grid-column: 2; grid-row: 1; padding-left: 0; border-left: 0; }
          .aad-record-count small { display: none; }
          .aad-section-grid, .aad-skeleton-grid { grid-template-columns: minmax(0, 1fr); gap: 9px; }
          .aad-section-body { max-height: 360px; }
          .aad-section-heading p { max-width: 190px; }
        }
        @media (max-width: 380px) {
          .aad-brand-lockup strong { font-size: 10px; }
          .aad-brand-lockup small { font-size: 7px; }
          .aad-scope-notice { padding: 9px; }
          .aad-scope-notice p { font-size: 11px; }
          .aad-record-count { gap: 5px; }
          .aad-count-icon { width: 26px; height: 26px; }
          .aad-field { grid-template-columns: minmax(72px, 31%) minmax(0, 1fr); gap: 7px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .aad-refreshing, .aad-skeleton::after { animation: none; }
        }
      `}</style>
    </main>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CircleUserRound,
  Minus,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getFortebetAccount,
  getPendingMobileMoney,
  logoutFromFortebet,
  requestMobileMoneyDeposit,
  requestMobileMoneyPayout,
  type MobileMoneyPendingRequest,
} from "@/lib/account.functions";
import { setAccountSession, useAccountSession } from "@/lib/account-state";
import { openLogin, openRegister } from "@/lib/login-modal";

type WalletPanel = "dashboard" | "deposit" | "withdraw" | null;

function formatBalance(balance: number) {
  return new Intl.NumberFormat("en-UG", {
    maximumFractionDigits: 2,
  }).format(balance);
}

function formatRequestDate(value: string) {
  if (!value) return "Pending";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleString("en-UG", { dateStyle: "medium", timeStyle: "short" });
}

function initialsFor(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function SiteIcon({ href, className }: { href: string; className: string }) {
  return (
    <icon {...({ href, classname: className } as Record<string, string>)}>
      <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
        <use xlinkHref={href} />
      </svg>
    </icon>
  );
}

export function AccountHeader() {
  const session = useAccountSession();
  const [walletPanel, setWalletPanel] = useState<WalletPanel>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [pendingRequests, setPendingRequests] = useState<MobileMoneyPendingRequest[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [pendingRefreshKey, setPendingRefreshKey] = useState(0);

  useEffect(() => {
    if (session.checked) return;
    let active = true;

    void getFortebetAccount()
      .then((result) => {
        if (active) setAccountSession(result.ok ? result.account : null);
      })
      .catch(() => {
        if (active) setAccountSession(null);
      });

    return () => {
      active = false;
    };
  }, [session.checked]);

  useEffect(() => {
    if (walletPanel !== "deposit" && walletPanel !== "withdraw") return;
    let active = true;
    const kind = walletPanel === "deposit" ? "payin" : "payout";
    setPendingLoading(true);
    setPendingError("");
    setPendingRequests([]);
    void getPendingMobileMoney({ data: { kind } })
      .then((result) => {
        if (!active) return;
        if (result.ok) setPendingRequests(result.requests);
        else setPendingError(result.message);
      })
      .catch(() => {
        if (active) setPendingError("Unable to load pending mobile money requests.");
      })
      .finally(() => {
        if (active) setPendingLoading(false);
      });
    return () => {
      active = false;
    };
  }, [walletPanel, pendingRefreshKey]);

  useEffect(() => {
    setPaymentAmount("");
    setPaymentMessage("");
    setPaymentInstructions("");
    setPaymentError("");
  }, [walletPanel]);

  async function refreshBalance() {
    const result = await getFortebetAccount().catch(() => null);
    if (result?.ok) setAccountSession(result.account);
  }

  async function handleLogout() {
    setLogoutPending(true);
    setLogoutError("");
    try {
      const result = await logoutFromFortebet();
      if (result.ok) {
        setAccountSession(null);
        setWalletPanel(null);
      } else {
        setLogoutError(result.message);
        setWalletPanel("dashboard");
      }
    } catch {
      setLogoutError("Unable to reach the account service. Please try again.");
      setWalletPanel("dashboard");
    } finally {
      setLogoutPending(false);
    }
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (walletPanel !== "deposit" && walletPanel !== "withdraw") return;
    setPaymentPending(true);
    setPaymentError("");
    setPaymentMessage("");
    setPaymentInstructions("");
    try {
      const amount = Number(paymentAmount);
      const result =
        walletPanel === "deposit"
          ? await requestMobileMoneyDeposit({ data: { amount } })
          : await requestMobileMoneyPayout({ data: { amount } });
      if (!result.ok) {
        setPaymentError(result.message);
        return;
      }
      setPaymentMessage(result.message);
      setPaymentInstructions(
        result.instructions ||
          (walletPanel === "deposit"
            ? "Approve the payment prompt on your registered mobile money phone. The deposit is credited after confirmation."
            : "Your withdrawal request has been submitted for processing."),
      );
      setPaymentAmount("");
      setPendingRefreshKey((current) => current + 1);

      const refreshedAccount = await getFortebetAccount().catch(() => null);
      if (refreshedAccount?.ok) setAccountSession(refreshedAccount.account);
    } catch {
      setPaymentError("The mobile money request could not be completed. Please try again.");
    } finally {
      setPaymentPending(false);
    }
  }

  if (!session.account) {
    return (
      <div className="account-header-entry">
        <div className="buttons hover">
          <a href="/client/deposit" aria-label="Deposits and withdrawals">
            <span className="ico h14 deposit" aria-hidden="true" />
            Deposits &amp; Withdrawals
          </a>
        </div>
        <div className="buttons hover">
          <a href="/doc/how_to_register" aria-label="How to register">
            <span className="ico h14 info" aria-hidden="true" />
            HOW TO REGISTER
          </a>
        </div>
        <div className="buttons register">
          <Button variant="ghost" className="account-header-button" onClick={openRegister}>
            Register
          </Button>
        </div>
        <div className="buttons login">
          <Button variant="ghost" className="account-header-button" onClick={openLogin}>
            <CircleUserRound aria-hidden="true" />
            Login
          </Button>
        </div>
      </div>
    );
  }

  const account = session.account;
  const displayName = account.displayName || account.nickname;
  const balance = formatBalance(account.balance);

  return (
    <div className="account-header-entry account-header-authenticated">
      <div className="buttons hover">
        <a
          href="/client/account/deposit"
          onClick={(event) => {
            event.preventDefault();
            setWalletPanel("dashboard");
          }}
        >
          DEPOSITS &amp; WITHDRAWALS
        </a>
      </div>
      <div className="user">
        <a href="/admin" aria-label="My tickets">
          <SiteIcon href="#icoClientTicket" className="current h30" />
          <span> My tickets </span>
        </a>
        <div>
          <input id="showBalance" type="checkbox" />
          <span className="separator" />
          <div className="balanceVisible">
            <svg
              viewBox="0 0 16 16"
              className="curPointer reload"
              style={{ verticalAlign: "text-top" }}
              role="button"
              aria-label="Refresh balance"
              onClick={() => void refreshBalance()}
            >
              <path
                fill="currentColor"
                d="M13.65 2.35A7.958 7.958 0 0 0 8 0C3.58 0 .01 3.58.01 8S3.58 16 8 16c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 8 14c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z"
              />
            </svg>
            <a> {balance} {account.currency}</a> &nbsp;
            <label htmlFor="showBalance" aria-label="Hide balance">
              <SiteIcon href="#icoEyeOff" className="curPointer current h22" />
            </label>
          </div>
          <div className="balanceHidden">
            <label htmlFor="showBalance">
              Show balance &nbsp;
              <SiteIcon href="#icoEye" className="curPointer current h22" />
            </label>
          </div>
          <span className="separator" />
          <SiteIcon href="#icoClientPersona" className="current h13" /> {account.nickname}
          <div className="secretMenu">
            <div>
              <h3>Your current balance</h3>
              <ul>
                <li>
                  <span className="flRight textWhite">
                    {" "}
                    {balance} {account.currency}{" "}
                  </span>{" "}
                  Account balance:
                </li>
              </ul>
            </div>
            <div>
              <h3>Account</h3>
              <ul>
                <li>
                  <a role="menuitem" onClick={() => setWalletPanel("deposit")}>
                    Deposit
                  </a>
                </li>
                <li>
                  <a role="menuitem" onClick={() => setWalletPanel("withdraw")}>
                    Withdraw
                  </a>
                </li>
                <li>
                  <a href="/admin">My Transactions</a>
                </li>
                <li>
                  <a href="/admin">My Tickets</a>
                </li>
                <li>
                  <a role="menuitem" onClick={() => setWalletPanel("dashboard")}>
                    My Profile
                  </a>
                </li>
                <li className="separator" />
                <li>
                  <a role="menuitem" onClick={() => void handleLogout()}>
                    {logoutPending ? "Signing out…" : "Logout"}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <a href="/admin" className="header__messages" aria-label="My messages">
        <SiteIcon href="#icoMessages" className="current h30" />
        <span> My messages </span>
      </a>
      <div className="buttons logout">
        <a role="button" aria-label="Logout" onClick={() => void handleLogout()}>
          <span className="ico login h15" />
        </a>
      </div>

      <Dialog open={walletPanel !== null} onOpenChange={(open) => !open && setWalletPanel(null)}>
        <DialogContent className="account-dialog account-wallet-dialog">
          <DialogHeader>
            <DialogTitle>
              {walletPanel === "deposit"
                ? "Deposit"
                : walletPanel === "withdraw"
                  ? "Withdraw"
                  : "Account dashboard"}
            </DialogTitle>
            <DialogDescription>Manage your Fortebet wallet and account.</DialogDescription>
          </DialogHeader>

          <div className="account-dashboard-summary">
            <span className="account-profile-avatar account-dashboard-avatar" aria-hidden="true">
              {initialsFor(displayName)}
            </span>
            <div>
              <strong>{displayName}</strong>
              <span>@{account.nickname}</span>
            </div>
          </div>
          <div className="account-dashboard-balance">
            <span>Available balance</span>
            <strong>
              {balance} <small>{account.currency}</small>
            </strong>
          </div>

          {walletPanel === "dashboard" ? (
            <div className="account-dashboard-actions">
              <Button className="account-action" onClick={() => setWalletPanel("deposit")}>
                <Plus aria-hidden="true" />
                Deposit
              </Button>
              <Button
                variant="outline"
                className="account-action account-action-secondary"
                onClick={() => setWalletPanel("withdraw")}
              >
                <Minus aria-hidden="true" />
                Withdraw
              </Button>
            </div>
          ) : (
            <div className="account-cashier-instructions">
              <Button
                type="button"
                variant="outline"
                className="account-secondary account-payment-back"
                onClick={() => setWalletPanel("dashboard")}
              >
                <ArrowLeft aria-hidden="true" />
                Back to wallet
              </Button>
              <p>
                {walletPanel === "deposit"
                  ? "Request a mobile money deposit to your registered number."
                  : "Request a mobile money withdrawal to your registered number."}
              </p>
              <form
                className="account-payment-form"
                onSubmit={(event) => void handlePaymentSubmit(event)}
              >
                <label htmlFor="account-payment-amount">Amount ({account.currency})</label>
                <input
                  id="account-payment-amount"
                  type="number"
                  inputMode="numeric"
                  min={walletPanel === "deposit" ? 1000 : 1}
                  max={walletPanel === "deposit" ? 5_000_000 : account.balance}
                  step={1}
                  required
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  disabled={paymentPending}
                />
                {walletPanel === "deposit" ? (
                  <small>Deposit limit: 1,000–5,000,000 UGX per request.</small>
                ) : (
                  <small>
                    Available balance: {balance} {account.currency}. Fortebet applies its withdrawal
                    limits.
                  </small>
                )}
                {pendingRequests.length > 0 && (
                  <small>
                    A request is already pending. Wait for it to finish before submitting another.
                  </small>
                )}
                {pendingError && (
                  <small>
                    Pending status could not be checked, so new requests are temporarily disabled.
                  </small>
                )}
                {paymentError && (
                  <p className="account-payment-error" role="alert">
                    {paymentError}
                  </p>
                )}
                {paymentMessage && (
                  <div className="account-payment-success" role="status">
                    <strong>{paymentMessage}</strong>
                    {paymentInstructions && <span>{paymentInstructions}</span>}
                  </div>
                )}
                <Button
                  type="submit"
                  className="account-action"
                  disabled={
                    paymentPending ||
                    pendingLoading ||
                    pendingRequests.length > 0 ||
                    Boolean(pendingError)
                  }
                >
                  {paymentPending
                    ? "Submitting…"
                    : walletPanel === "deposit"
                      ? "Request deposit"
                      : "Request withdrawal"}
                </Button>
              </form>
              <section className="account-pending-section" aria-live="polite">
                <div className="account-pending-heading">
                  <strong>Pending {walletPanel === "deposit" ? "deposits" : "withdrawals"}</strong>
                  <Button
                    type="button"
                    variant="outline"
                    className="account-secondary account-refresh-button"
                    aria-label="Refresh pending requests"
                    disabled={pendingLoading}
                    onClick={() => setPendingRefreshKey((current) => current + 1)}
                  >
                    <RefreshCw aria-hidden="true" />
                  </Button>
                </div>
                {pendingLoading ? (
                  <p className="account-pending-empty">Loading requests…</p>
                ) : pendingError ? (
                  <p className="account-payment-error" role="alert">
                    {pendingError}
                  </p>
                ) : pendingRequests.length === 0 ? (
                  <p className="account-pending-empty">There are no pending requests.</p>
                ) : (
                  <ul className="account-pending-list">
                    {pendingRequests.map((request, index) => (
                      <li key={`${request.reference}-${request.requestTimestamp}-${index}`}>
                        <span>{request.reference || "Mobile money request"}</span>
                        <span>{formatRequestDate(request.requestTimestamp)}</span>
                        <strong>
                          {formatBalance(request.amount)} {account.currency}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
          {logoutError && (
            <p className="account-logout-error" role="alert">
              {logoutError}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

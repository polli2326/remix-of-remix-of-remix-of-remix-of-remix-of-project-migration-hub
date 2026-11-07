import { useEffect, useState } from "react";
import { CircleUserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFortebetAccount, logoutFromFortebet } from "@/lib/account.functions";
import { setAccountSession, useAccountSession } from "@/lib/account-state";
import { openLogin, openRegister } from "@/lib/login-modal";

function formatBalance(balance: number) {
  return new Intl.NumberFormat("en-UG", {
    maximumFractionDigits: 2,
  }).format(balance);
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
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState("");

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
      } else {
        setLogoutError(result.message);
      }
    } catch {
      setLogoutError("Unable to reach the account service. Please try again.");
    } finally {
      setLogoutPending(false);
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
  const balance = formatBalance(account.balance);

  return (
    <div className="account-header-entry account-header-authenticated">
      <div className="buttons hover">
        <a
          href="/client/account/deposit"
        >
          DEPOSITS &amp; WITHDRAWALS
        </a>
      </div>
      <div className="user">
        <a href="/client/account/bets/all" aria-label="My tickets">
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
                  <a role="menuitem" href="/client/account/deposit">
                    Deposits &amp; withdrawals
                  </a>
                </li>
                <li>
                  <a href="/client/account/transactions/money">My Transactions</a>
                </li>
                <li>
                  <a href="/client/account/bets/all">My Tickets</a>
                </li>
                <li>
                  <a role="menuitem" href="/client/account/profile">
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
      <a href="/client/account/messages" className="header__messages" aria-label="My messages">
        <SiteIcon href="#icoMessages" className="current h30" />
        <span> My messages </span>
      </a>
      <div className="buttons logout">
        <a role="button" aria-label="Logout" onClick={() => void handleLogout()}>
          <span className="ico login h15" />
        </a>
      </div>


    </div>
  );
}

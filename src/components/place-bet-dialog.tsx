import { useEffect, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkFortebetBetAuthorization, placeFortebetBet } from "@/lib/bet-placement.functions";
import { UNCONFIRMED_BET_MESSAGE, type BetPlacementResult, type PlaceBetSelection } from "@/lib/bet-placement";
import { setAccountSession, useAccountSession } from "@/lib/account-state";

export type PlaceBetSnapshot = {
  stake: number;
  totalOdds: number;
  possibleWin: number;
  picks: Array<PlaceBetSelection & { key: string; match: string; market: string; outcome: string }>;
};

const money = (value: number) => `${new Intl.NumberFormat("en-UG", { maximumFractionDigits: 2 }).format(value)} UGX`;
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function PlaceBetDialog({
  snapshot,
  onClose,
  onAccepted,
}: {
  snapshot: PlaceBetSnapshot | null;
  onClose: () => void;
  onAccepted: () => void;
}) {
  const session = useAccountSession();
  const placeBet = useServerFn(placeFortebetBet);
  const checkAuthorization = useServerFn(checkFortebetBetAuthorization);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BetPlacementResult | null>(null);

  useEffect(() => {
    if (snapshot) setResult(null);
  }, [snapshot]);

  async function confirmBet() {
    if (!snapshot || busy) return;
    setBusy(true);
    setResult(null);
    try {
      let current = await placeBet({
        data: {
          confirmed: true,
          stake: snapshot.stake,
          selections: snapshot.picks.map(({ oddsId, eventId, odds, live }) => ({ oddsId, eventId, odds, live })),
        },
      });
      setResult(current);

      // A pending ticket is polled by its Fortebet reference. Never resubmit it.
      for (let attempt = 0; current.status === "pending" && attempt < 8; attempt += 1) {
        await wait(2000);
        current = await checkAuthorization({ data: { idTicket: current.idTicket } });
        setResult(current);
      }
      if (current.status === "pending") {
        current = {
          status: "unknown",
          idTicket: current.idTicket,
          message: "Fortebet has not confirmed this bet yet. Check My Tickets before placing this slip again.",
        };
        setResult(current);
      }
      if (current.status === "accepted") {
        if (current.account) setAccountSession(current.account);
        onAccepted();
      }
    } catch {
      setResult({ status: "unknown", message: UNCONFIRMED_BET_MESSAGE });
    } finally {
      setBusy(false);
    }
  }

  const accepted = result?.status === "accepted";
  const uncertain = result?.status === "unknown" || result?.status === "pending";
  const rejected = result?.status === "rejected";

  return (
    <AlertDialog.Root
      open={snapshot !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[1100] bg-account-overlay" />
        <AlertDialog.Content
          className="fixed left-1/2 top-1/2 z-[1101] max-h-[92dvh] w-[calc(100%-24px)] max-w-[430px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-account-line bg-account-surface text-account-ink shadow-account outline-none"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <header className="bg-brand-600 px-5 py-4 text-primary-foreground">
            <AlertDialog.Title className="text-base font-black uppercase">
              {accepted ? "Bet accepted" : uncertain ? "Check your ticket" : rejected ? "Bet not placed" : "Confirm real bet"}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-1 text-xs opacity-90">
              {accepted ? "Fortebet confirmed this ticket." : uncertain ? "Do not place the same slip again until you check its status." : rejected ? "Fortebet did not confirm a ticket." : "This will use money from your Fortebet account."}
            </AlertDialog.Description>
          </header>

          {snapshot && <div className="space-y-4 p-5 text-sm">
            {!accepted && <div className="max-h-44 space-y-2 overflow-y-auto rounded border border-account-line bg-account-field p-3 text-xs">
              {snapshot.picks.map((pick) => <div key={pick.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                <div><strong className="block">{pick.match}</strong><span>{pick.market}: {pick.outcome}</span></div>
                <strong>{pick.odds.toFixed(2)}</strong>
              </div>)}
            </div>}

            <dl className="space-y-2 rounded border border-account-line p-3">
              <div className="flex justify-between gap-4"><dt>Total odds</dt><dd className="font-bold">{snapshot.totalOdds.toFixed(2)}</dd></div>
              <div className="flex justify-between gap-4"><dt>Real-money stake</dt><dd className="font-bold">{money(snapshot.stake)}</dd></div>
              <div className="flex justify-between gap-4"><dt>Possible win</dt><dd className="font-bold">{money(snapshot.possibleWin)}</dd></div>
              {session.account && <div className="flex justify-between gap-4 border-t border-account-line pt-2 text-xs"><dt>Account</dt><dd>{session.account.nickname} · {money(session.account.balance)}</dd></div>}
            </dl>

            {result && <div role={rejected || uncertain ? "alert" : "status"} className={`flex gap-2 rounded border border-account-line p-3 text-xs leading-5 ${rejected ? "text-destructive" : ""}`}>
              {accepted ? <CheckCircle2 className="mt-0.5 shrink-0 text-brand-600" size={18} /> : <TriangleAlert className="mt-0.5 shrink-0" size={18} />}
              <div><p>{result.message}</p>{accepted && result.ticket.shortNumber && <p className="mt-1 font-bold">Short ticket number: {result.ticket.shortNumber}</p>}</div>
            </div>}
            {busy && <p role="status" className="flex items-center justify-center gap-2 text-xs"><LoaderCircle className="animate-spin" size={16} /> Waiting for Fortebet’s answer. Do not close or submit again.</p>}

            <div className="flex flex-wrap justify-end gap-2">
              {accepted ? <>
                <Button asChild variant="outline" className="border-account-line bg-account-field text-account-ink"><a href="/client/account/bets/all">My Tickets</a></Button>
                <Button className="bg-brand-600 text-primary-foreground hover:bg-brand-700" onClick={onClose}>Done</Button>
              </> : uncertain ? <>
                <Button asChild className="bg-brand-600 text-primary-foreground hover:bg-brand-700"><a href="/client/account/bets/all">Check My Tickets</a></Button>
                <Button variant="outline" className="border-account-line bg-account-field text-account-ink" onClick={onClose}>Close</Button>
              </> : rejected ? <Button className="bg-brand-600 text-primary-foreground hover:bg-brand-700" onClick={onClose}>Back to bet slip</Button> : <>
                <Button variant="outline" disabled={busy} className="border-account-line bg-account-field text-account-ink" onClick={onClose}>Cancel</Button>
                <Button disabled={busy} className="bg-brand-600 text-primary-foreground hover:bg-brand-700" onClick={() => void confirmBet()}>{busy ? "Placing bet…" : `Confirm ${money(snapshot.stake)} bet`}</Button>
              </>}
            </div>
          </div>}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

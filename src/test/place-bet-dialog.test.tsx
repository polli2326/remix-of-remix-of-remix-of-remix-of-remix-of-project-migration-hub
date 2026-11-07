import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlaceBetDialog, type PlaceBetSnapshot } from "@/components/place-bet-dialog";
import { setAccountSession } from "@/lib/account-state";

const api = vi.hoisted(() => ({ place: vi.fn(), check: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/bet-placement.functions", () => ({
  placeFortebetBet: api.place,
  checkFortebetBetAuthorization: api.check,
}));

const account = { nickname: "sample", displayName: "Sample User", balance: 25000, currency: "UGX" };
const snapshot: PlaceBetSnapshot = {
  stake: 2000,
  totalOdds: 1.85,
  possibleWin: 3700,
  picks: [{ key: "123456", oddsId: 123456, eventId: "MA76515564", odds: 1.85, live: false, match: "Home - Away", market: "Full Time Result", outcome: "Home" }],
};

beforeEach(() => {
  api.place.mockReset();
  api.check.mockReset();
  setAccountSession(account);
});

describe("Place Bet confirmation", () => {
  it("submits the exact confirmed snapshot and clears only an accepted ticket", async () => {
    api.place.mockResolvedValue({ status: "accepted", message: "Fortebet accepted your bet. Ticket T-1.", ticket: { number: "T-1", shortNumber: "1" }, account: { ...account, balance: 23000 } });
    const onAccepted = vi.fn();
    render(<PlaceBetDialog snapshot={snapshot} onClose={vi.fn()} onAccepted={onAccepted} />);

    expect(screen.getByText("Real-money stake")).toBeInTheDocument();
    expect(screen.getAllByText("2,000 UGX").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Confirm 2,000 UGX bet" }));

    await screen.findByText("Fortebet accepted your bet. Ticket T-1.");
    expect(api.place).toHaveBeenCalledWith({ data: { confirmed: true, stake: 2000, selections: [{ oddsId: 123456, eventId: "MA76515564", odds: 1.85, live: false }] } });
    expect(onAccepted).toHaveBeenCalledTimes(1);
    expect(api.check).not.toHaveBeenCalled();
  });

  it("keeps the slip when Fortebet rejects changed odds", async () => {
    api.place.mockResolvedValue({ status: "rejected", code: "SB_ITEM_ODDS_CHANGED", message: "Odds changed before Fortebet accepted the ticket. Review the new odds and confirm again." });
    const onAccepted = vi.fn();
    render(<PlaceBetDialog snapshot={snapshot} onClose={vi.fn()} onAccepted={onAccepted} />);

    fireEvent.click(screen.getByRole("button", { name: "Confirm 2,000 UGX bet" }));
    await screen.findByText("Odds changed before Fortebet accepted the ticket. Review the new odds and confirm again.");
    expect(onAccepted).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Back to bet slip" })).toBeInTheDocument();
  });

  it("does not offer a success state while authorization is pending", async () => {
    api.place.mockResolvedValue({ status: "pending", idTicket: "P-1", message: "Fortebet is authorising this bet. Do not submit it again." });
    api.check.mockResolvedValue({ status: "unknown", idTicket: "P-1", message: "Check My Tickets before placing this slip again." });
    const onAccepted = vi.fn();
    render(<PlaceBetDialog snapshot={snapshot} onClose={vi.fn()} onAccepted={onAccepted} />);

    fireEvent.click(screen.getByRole("button", { name: "Confirm 2,000 UGX bet" }));
    await screen.findByText("Check My Tickets before placing this slip again.", { exact: false }, { timeout: 5000 });
    await waitFor(() => expect(api.check).toHaveBeenCalledWith({ data: { idTicket: "P-1" } }));
    expect(api.place).toHaveBeenCalledTimes(1);
    expect(onAccepted).not.toHaveBeenCalled();
    expect(screen.queryByText("Bet accepted")).not.toBeInTheDocument();
  });
});

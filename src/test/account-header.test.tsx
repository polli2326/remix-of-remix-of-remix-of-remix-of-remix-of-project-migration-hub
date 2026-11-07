import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const accountApi = vi.hoisted(() => ({
  getAccount: vi.fn(),
  pending: vi.fn(),
  logout: vi.fn(),
  deposit: vi.fn(),
  payout: vi.fn(),
}));

vi.mock("@/lib/account.functions", () => ({
  getFortebetAccount: accountApi.getAccount,
  getPendingMobileMoney: accountApi.pending,
  logoutFromFortebet: accountApi.logout,
  requestMobileMoneyDeposit: accountApi.deposit,
  requestMobileMoneyPayout: accountApi.payout,
}));

import { AccountHeader } from "@/components/account-header";
import { setAccountSession } from "@/lib/account-state";

const account = {
  nickname: "sample-user",
  displayName: "Sample User",
  balance: 25_000,
  currency: "UGX",
};

afterEach(() => {
  cleanup();
  setAccountSession(null);
  vi.clearAllMocks();
});

it("opens the authenticated dropdown and submits a deposit through the server action", async () => {
  accountApi.pending.mockResolvedValue({ ok: true, requests: [] });
  accountApi.deposit.mockResolvedValue({ ok: true, message: "Deposit request accepted." });
  accountApi.getAccount.mockResolvedValue({ ok: true, account });
  setAccountSession(account);

  render(<AccountHeader />);
  fireEvent.keyDown(screen.getByRole("button", { name: "Account menu for Sample User" }), {
    key: "Enter",
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Deposit" }));

  fireEvent.change(await screen.findByLabelText("Amount (UGX)"), { target: { value: "5000" } });
  fireEvent.submit(screen.getByLabelText("Amount (UGX)").closest("form") as HTMLFormElement);

  await waitFor(() => {
    expect(accountApi.deposit).toHaveBeenCalledWith({ data: { amount: 5000 } });
  });
  expect(await screen.findByText("Deposit request accepted.")).toBeTruthy();
  expect(accountApi.pending).toHaveBeenCalledWith({ data: { kind: "payin" } });
});

it("submits a withdrawal request from the authenticated dropdown", async () => {
  accountApi.pending.mockResolvedValue({ ok: true, requests: [] });
  accountApi.payout.mockResolvedValue({ ok: true, message: "Withdrawal request accepted." });
  accountApi.getAccount.mockResolvedValue({ ok: true, account });
  setAccountSession(account);

  render(<AccountHeader />);
  fireEvent.keyDown(screen.getByRole("button", { name: "Account menu for Sample User" }), {
    key: "Enter",
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Withdraw" }));

  fireEvent.change(await screen.findByLabelText("Amount (UGX)"), { target: { value: "5000" } });
  fireEvent.submit(screen.getByLabelText("Amount (UGX)").closest("form") as HTMLFormElement);

  await waitFor(() => {
    expect(accountApi.payout).toHaveBeenCalledWith({ data: { amount: 5000 } });
  });
  expect(await screen.findByText("Withdrawal request accepted.")).toBeTruthy();
  expect(accountApi.pending).toHaveBeenCalledWith({ data: { kind: "payout" } });
});

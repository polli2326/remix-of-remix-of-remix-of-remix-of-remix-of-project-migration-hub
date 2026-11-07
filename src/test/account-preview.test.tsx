import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const accountApi = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  countries: vi.fn(),
  guide: vi.fn(),
}));

vi.mock("@/lib/account.functions", () => ({
  loginWithFortebet: accountApi.login,
  registerWithFortebet: accountApi.register,
  getRegistrationCountries: accountApi.countries,
  getRegistrationGuide: accountApi.guide,
}));

import { LoginModal } from "@/components/login-modal";
import { closeLogin, openLogin, openRegister } from "@/lib/login-modal";

afterEach(() => {
  cleanup();
  closeLogin();
  vi.clearAllMocks();
});

it("sends login credentials to the server action without storing them in browser storage", async () => {
  accountApi.login.mockResolvedValue({ ok: true, message: "You’re now logged in." });
  const storageSpy = vi.spyOn(Storage.prototype, "setItem");
  openLogin();
  render(<LoginModal />);
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "sample-user" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "sample-password" } });
  fireEvent.submit(screen.getByLabelText("Password").closest("form") as HTMLFormElement);
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("You’re now logged in."));
  expect(accountApi.login).toHaveBeenCalledWith({
    data: { nickname: "sample-user", password: "sample-password" },
  });
  expect(storageSpy).not.toHaveBeenCalled();
});

it("loads live registration resources and sends registration details to the server action", async () => {
  accountApi.countries.mockResolvedValue({
    ok: true,
    countries: [{ name: "Uganda", code: "UG" }, { name: "Kenya", code: "KE" }],
  });
  accountApi.guide.mockResolvedValue({ ok: true, html: "<p>Register with your details.</p>" });
  accountApi.register.mockResolvedValue({ ok: true, message: "Registration complete. You can now log in." });
  const storageSpy = vi.spyOn(Storage.prototype, "setItem");
  openRegister();
  render(<LoginModal />);
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Nationality" }).querySelectorAll("option").length).toBe(2));
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "Sample" } });
  fireEvent.change(screen.getByLabelText("Surname"), { target: { value: "User" } });
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "sample-user" } });
  fireEvent.change(screen.getByLabelText("Mobile/GSM"), { target: { value: "700000000" } });
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "sample@example.com" } });
  fireEvent.change(screen.getByLabelText("Birth day"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Birth month"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Birth year"), { target: { value: "1990" } });
  fireEvent.change(screen.getByLabelText("NIN number"), { target: { value: "SAMPLE-ONLY" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.submit(screen.getByRole("button", { name: "Confirm registration" }).closest("form") as HTMLFormElement);
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Registration complete. You can now log in."));
  expect(accountApi.register).toHaveBeenCalledWith({
    data: {
      firstName: "Sample",
      lastName: "User",
      nickname: "sample-user",
      phone: "700000000",
      email: "sample@example.com",
      birthdate: "1990-01-01",
      nationality: "UG",
      recordNumber: "SAMPLE-ONLY",
      promo: "",
      termsAccepted: true,
    },
  });
  expect(accountApi.countries).toHaveBeenCalledOnce();
  expect(accountApi.guide).toHaveBeenCalledOnce();
  expect(storageSpy).not.toHaveBeenCalled();
});
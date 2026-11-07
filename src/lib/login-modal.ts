import { useSyncExternalStore } from "react";

/** Tiny open/close store so any header button can open the single login window. */
export type AccountWindow = "login" | "register" | "forgot";
let open: AccountWindow | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function openLogin() {
  open = "login";
  emit();
}

export function openRegister() {
  open = "register";
  emit();
}

export function openForgot() {
  open = "forgot";
  emit();
}

export function closeLogin() {
  open = null;
  emit();
}

export function useLoginOpen() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => open,
    () => null,
  );
}

/** Pure form check, kept separate so the rules are testable. */
export function validateLogin(username: string, password: string): { username?: string; password?: string } {
  const errors: { username?: string; password?: string } = {};
  if (!username.trim()) errors.username = "Enter your phone number or username";
  if (!password) errors.password = "Enter your password";
  return errors;
}

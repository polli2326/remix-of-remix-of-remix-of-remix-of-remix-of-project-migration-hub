import { useSyncExternalStore } from "react";
import type { FortebetAccount } from "@/lib/account.functions";

export type AccountSessionSnapshot = {
  account: FortebetAccount | null;
  checked: boolean;
};

const initialSnapshot: AccountSessionSnapshot = { account: null, checked: false };
let snapshot = initialSnapshot;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function emit() {
  for (const listener of listeners) listener();
}

export function setAccountSession(account: FortebetAccount | null) {
  snapshot = { account, checked: true };
  emit();
}

export function useAccountSession() {
  return useSyncExternalStore(subscribe, getSnapshot, () => initialSnapshot);
}

import { useCallback, useMemo, useState } from "react";

export type CheckoutState =
  | "IDLE"
  | "LOGIN_PI"
  | "SYNC_PROFILE"
  | "LOAD_ADDRESS"
  | "READY"
  | "CREATE_INTENT"
  | "OPEN_PI"
  | "AUTHORIZE"
  | "SUBMIT"
  | "SUCCESS"
  | "ERROR";

export function useCheckoutState() {
  const [state, setState] =
    useState<CheckoutState>("IDLE");

  const isBusy = useMemo(
    () =>
      ![
        "IDLE",
        "READY",
        "SUCCESS",
        "ERROR",
      ].includes(state),
    [state]
  );

  const reset = useCallback(() => {
    setState("IDLE");
  }, []);

  return {
    state,
    setState,
    reset,
    isBusy,
  };
}

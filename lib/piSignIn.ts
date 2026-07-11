/* =========================================================
   Pi Sign-In Utility
   OAuth Login
========================================================= */

type PiSignInOptions = {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
};

type PiBrowser = {
  signIn(options: {
    clientId: string;
    redirectUri: string;
    scopes?: string[];
    state?: string;
  }): void;
};

declare global {
  interface Window {
    Pi?: PiBrowser;
  }
}

/* =========================================================
   START PI SIGN-IN
========================================================= */

export function piSignIn({
  clientId,
  redirectUri,
  scopes = ["username"],
}: PiSignInOptions): void {

  if (typeof window === "undefined") {
    throw new Error("PI_BROWSER_REQUIRED");
  }

  if (!window.Pi) {
    throw new Error("PI_SDK_NOT_AVAILABLE");
  }

  const state = crypto.randomUUID();

  sessionStorage.setItem(
    "pi_oauth_state",
    state
  );

  console.log("[PI SIGN-IN] START");

  console.log("[PI SIGN-IN] CLIENT ID", clientId);

  console.log(
    "[PI SIGN-IN] REDIRECT URI",
    redirectUri
  );

  console.log(
    "[PI SIGN-IN] SCOPES",
    scopes
  );

  console.log(
    "[PI SIGN-IN] STATE",
    state
  );

  window.Pi.signIn({
    clientId,
    redirectUri,
    scopes,
    state,
  });
}

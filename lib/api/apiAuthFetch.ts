export async function apiAuthFetch(
  input: RequestInfo,
  init?: RequestInit
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("pi_token")
      : null;

  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

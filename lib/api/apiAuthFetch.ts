export async function apiAuthFetch(
  input: RequestInfo,
  init?: RequestInit
) {
  const token = await getPiAccessToken();

  return fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

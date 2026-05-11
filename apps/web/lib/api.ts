import { getApiBaseUrl } from "@/lib/apiBaseUrl";

const API_BASE_URL = getApiBaseUrl();

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? `API request failed for ${path}.`);
  }

  return payload;
}

export { API_BASE_URL };

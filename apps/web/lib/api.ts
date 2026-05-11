import { getApiBaseUrl } from "@/lib/apiBaseUrl";

const API_BASE_URL = getApiBaseUrl();

function getRequestUrl(path: string) {
  // Keep browser requests same-origin so auth cookies continue to flow in prod.
  if (typeof window !== "undefined") {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(getRequestUrl(path), {
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

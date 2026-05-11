function normalizeBaseUrl(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized.replace(/\/+$/, "") : undefined;
}

export function getApiBaseUrl() {
  return (
    normalizeBaseUrl(process.env.API_BASE_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL) ??
    "http://localhost:4000"
  );
}

function normalizeBaseUrl(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized.replace(/\/+$/, "") : undefined;
}

export function getApiBaseUrl() {
  return normalizeBaseUrl(process.env.API_BASE_URL);
}

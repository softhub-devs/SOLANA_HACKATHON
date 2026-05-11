const ORGANIZER_ORG_ID_KEY = "organizerOrgId";

export function persistOrganizerOrgId(orgId: string | null | undefined) {
  if (typeof window === "undefined" || !orgId) {
    return;
  }

  window.localStorage.setItem(ORGANIZER_ORG_ID_KEY, orgId);
}

export function readOrganizerOrgId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ORGANIZER_ORG_ID_KEY);
}

export function clearOrganizerOrgId() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ORGANIZER_ORG_ID_KEY);
}

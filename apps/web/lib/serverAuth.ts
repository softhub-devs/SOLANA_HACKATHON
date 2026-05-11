import type { NextRequest } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";

export type BackendSessionUser = {
  id: string;
  orgId: string;
  walletAddress: string;
  username: string | null;
  displayName: string | null;
  role: "player" | "organizer" | "admin";
  organizerStatus: "none" | "pending" | "approved" | "rejected";
};

export type BackendSession = {
  user: BackendSessionUser;
  session: {
    expiresAt: string;
  };
};

const API_BASE_URL = getApiBaseUrl();

export async function readBackendSessionFromCookie(cookieHeader: string) {
  const response = await fetch(`${API_BASE_URL}/auth/session`, {
    headers: {
      cookie: cookieHeader,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  return JSON.parse(text) as BackendSession;
}

async function readBackendSession(request: NextRequest) {
  return readBackendSessionFromCookie(request.headers.get("cookie") ?? "");
}

export async function requireAuthenticatedSession(request: NextRequest) {
  const session = await readBackendSession(request);
  if (!session) {
    return {
      error: Response.json({ error: "Sign in first." }, { status: 401 }),
      session: null,
    };
  }

  if (!session.user.username || !session.user.displayName) {
    return {
      error: Response.json(
        { error: "Finish onboarding before using protected actions." },
        { status: 403 }
      ),
      session: null,
    };
  }

  return { error: null, session };
}

export async function requireOrganizerSession(request: NextRequest) {
  const result = await requireAuthenticatedSession(request);
  if (result.error || !result.session) {
    return result;
  }

  if (
    result.session.user.role !== "organizer" &&
    result.session.user.role !== "admin"
  ) {
    return {
      error: Response.json(
        { error: "Organizer access required." },
        { status: 403 }
      ),
      session: null,
    };
  }

  return result;
}

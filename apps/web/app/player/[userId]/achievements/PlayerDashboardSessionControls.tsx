"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { SessionResponse, SessionUser } from "@/lib/apiTypes";

function formatWallet(wallet: string) {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function PlayerDashboardSessionControls({
  userId,
}: {
  userId: string;
}) {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function syncSession() {
      try {
        const payload = await apiFetch<SessionResponse>("/auth/session");

        if (cancelled) {
          return;
        }

        if (payload.user.walletAddress !== userId) {
          router.replace(
            `/${encodeURIComponent(payload.user.walletAddress)}/achivement`
          );
          return;
        }

        setSessionUser(payload.user);
      } catch {
        if (!cancelled) {
          router.replace("/login/player");
        }
      }
    }

    void syncSession();

    return () => {
      cancelled = true;
    };
  }, [router, userId]);

  async function handleLogout() {
    setError(null);
    setLoggingOut(true);

    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed.");
      setLoggingOut(false);
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm text-slate-300">Active player session</p>
        <p className="mt-2 text-sm font-semibold text-white">
          {sessionUser?.displayName ?? formatWallet(userId)}
        </p>
      </div>

      <div className="flex flex-col items-start gap-3 sm:items-end">
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}

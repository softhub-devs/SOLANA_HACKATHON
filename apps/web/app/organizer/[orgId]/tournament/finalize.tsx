"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  SessionResponse,
  SessionUser,
  TournamentRegistration,
  TournamentSummary,
} from "@/lib/apiTypes";

type TournamentDetail = TournamentSummary & {
  registrations: TournamentRegistration[];
};

type FinalizeResponse = {
  tournament: TournamentDetail;
  distribution: {
    winnerWallet: string;
    winnerTokenName: string;
    participationTokenName: string;
    participantCount: number;
  };
};

function canManageTournaments(user: SessionUser | null) {
  return user?.role === "organizer" || user?.role === "admin";
}

export default function FinalizeTournamentPage() {
  const router = useRouter();
  const params = useParams<{ orgId: string }>();
  const searchParams = useSearchParams();
  const orgId = params.orgId;
  const requestedTournamentId = searchParams.get("tournamentId") ?? "";
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState(requestedTournamentId);
  const [selectedTournament, setSelectedTournament] = useState<TournamentDetail | null>(null);
  const [winnerWallet, setWinnerWallet] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const syncSession = useCallback(async () => {
    try {
      const payload = await apiFetch<SessionResponse>("/auth/session");
      if (!canManageTournaments(payload.user)) {
        router.replace("/login/organizer");
        return null;
      }

      setSessionUser(payload.user);
      return payload.user;
    } catch {
      router.replace("/login/organizer");
      return null;
    }
  }, [router]);

  const loadTournaments = useCallback(async (user?: SessionUser | null) => {
    const response = await fetch("/api/tournaments", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as {
      tournaments?: TournamentSummary[];
      error?: string;
    };

    if (!response.ok || !payload.tournaments) {
      throw new Error(payload.error ?? "Failed to load tournaments.");
    }

    const activeUser = user ?? sessionUser;
    const filtered =
      activeUser?.role === "admin"
        ? payload.tournaments
        : payload.tournaments.filter(
            (tournament) => tournament.organizerWallet === activeUser?.walletAddress
          );

    setTournaments(filtered);

    const nextTournamentId =
      requestedTournamentId && filtered.some((tournament) => tournament.id === requestedTournamentId)
        ? requestedTournamentId
        : filtered[0]?.id ?? "";

    setSelectedTournamentId(nextTournamentId);
    return nextTournamentId;
  }, [requestedTournamentId, sessionUser]);

  const loadTournament = useCallback(async (tournamentId: string) => {
    if (!tournamentId) {
      setSelectedTournament(null);
      setWinnerWallet("");
      return;
    }

    const response = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}`, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as
      | TournamentDetail
      | { error?: string };

    if (!response.ok) {
      throw new Error("error" in payload ? payload.error : "Failed to load tournament.");
    }

    const tournament = payload as TournamentDetail;
    setSelectedTournament(tournament);
    setWinnerWallet(tournament.winnerWallet ?? tournament.registrations[0]?.wallet ?? "");
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const user = await syncSession();
        if (!user) {
          return;
        }

        const nextTournamentId = await loadTournaments(user);
        await loadTournament(nextTournamentId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load finalize flow.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [loadTournament, loadTournaments, syncSession]);

  useEffect(() => {
    if (!selectedTournamentId) {
      return;
    }

    router.replace(
      `/organizer/${encodeURIComponent(orgId)}/tournament/finalize?tournamentId=${encodeURIComponent(selectedTournamentId)}`
    );
  }, [orgId, router, selectedTournamentId]);

  async function handleTournamentChange(tournamentId: string) {
    setSelectedTournamentId(tournamentId);
    setError(null);
    setSuccess(null);

    try {
      await loadTournament(tournamentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tournament.");
    }
  }

  async function finalizeTournament() {
    if (!selectedTournamentId || !winnerWallet.trim()) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/tournaments/${encodeURIComponent(selectedTournamentId)}/finalize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ winnerWallet: winnerWallet.trim() }),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as
        | FinalizeResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Finalization failed.");
      }

      const result = payload as FinalizeResponse;
      setSelectedTournament(result.tournament);
      setWinnerWallet(result.distribution.winnerWallet);
      setSuccess(`Finalized ${result.tournament.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Finalization failed.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          {success}
        </div>
      ) : null}

      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
              Tournament Finalization
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              {selectedTournament?.name ?? "Select a tournament"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Choose a registered player and write the winner to the tournament record.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(`/organizer/${encodeURIComponent(orgId)}/tournament`)
            }
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
          >
            Back to tournaments
          </button>
        </div>

        <label className="mt-6 block text-sm font-medium text-slate-300">
          Tournament
          <select
            value={selectedTournamentId}
            onChange={(event) => void handleTournamentChange(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">Select a tournament</option>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold">Select Winner</h2>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-5 py-4 text-sm text-slate-400">
              Loading tournament details...
            </div>
          ) : selectedTournament?.registrations.length ? (
            selectedTournament.registrations.map((registration) => {
              const selected = winnerWallet === registration.wallet;

              return (
                <button
                  key={registration.wallet}
                  type="button"
                  onClick={() => setWinnerWallet(registration.wallet)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition ${
                    selected
                      ? "border-cyan-400 bg-cyan-400/10"
                      : "border-white/10 bg-slate-950/50 hover:border-cyan-400"
                  }`}
                >
                  <div>
                    <p className="font-medium text-white">
                      {registration.wallet}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Registered competitor
                    </p>
                  </div>

                  <div className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                    {selected ? "Selected" : "Select"}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-5 py-4 text-sm text-slate-400">
              No registered players yet. Use the gate page first.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={finalizeTournament}
          disabled={
            actionLoading ||
            !selectedTournamentId ||
            !winnerWallet.trim() ||
            !selectedTournament?.registrations.length ||
            selectedTournament.status === "completed"
          }
          className="mt-6 w-full rounded-2xl bg-emerald-400 px-4 py-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {selectedTournament?.status === "completed"
            ? "Tournament Completed"
            : actionLoading
              ? "Finalizing..."
              : "Finalize Tournament"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  SessionResponse,
  SessionUser,
  TournamentEligibility,
  TournamentRegistration,
  TournamentSummary,
} from "@/lib/apiTypes";

type TournamentDetail = TournamentSummary & {
  registrations: TournamentRegistration[];
};

type RegisterResponse = {
  tournament: TournamentDetail;
  registration: TournamentRegistration;
  eligibility: TournamentEligibility;
};

function canManageTournaments(user: SessionUser | null) {
  return user?.role === "organizer" || user?.role === "admin";
}

export default function GatePlayersPage() {
  const router = useRouter();
  const params = useParams<{ orgId: string }>();
  const searchParams = useSearchParams();
  const orgId = params.orgId;
  const requestedTournamentId = searchParams.get("tournamentId") ?? "";
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState(requestedTournamentId);
  const [selectedTournament, setSelectedTournament] = useState<TournamentDetail | null>(null);
  const [wallet, setWallet] = useState("");
  const [eligibility, setEligibility] = useState<TournamentEligibility | null>(null);
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

    setSelectedTournament(payload as TournamentDetail);
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
        setError(err instanceof Error ? err.message : "Failed to load gate flow.");
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
      `/organizer/${encodeURIComponent(orgId)}/tournament/gate?tournamentId=${encodeURIComponent(selectedTournamentId)}`
    );
  }, [orgId, router, selectedTournamentId]);

  async function handleTournamentChange(tournamentId: string) {
    setSelectedTournamentId(tournamentId);
    setEligibility(null);
    setError(null);
    setSuccess(null);

    try {
      await loadTournament(tournamentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tournament.");
    }
  }

  async function checkEligibility() {
    if (!selectedTournamentId || !wallet.trim()) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/tournaments/${encodeURIComponent(selectedTournamentId)}/eligibility/${encodeURIComponent(wallet.trim())}`,
        { cache: "no-store" }
      );
      const payload = (await response.json().catch(() => ({}))) as
        | TournamentEligibility
        | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Eligibility check failed.");
      }

      setEligibility(payload as TournamentEligibility);
      setSuccess(`Eligibility checked for ${wallet.trim()}.`);
    } catch (err) {
      setEligibility(null);
      setError(err instanceof Error ? err.message : "Eligibility check failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function registerPlayer() {
    if (!selectedTournamentId || !wallet.trim()) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/organizers/tournaments/${encodeURIComponent(selectedTournamentId)}/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ wallet: wallet.trim() }),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as
        | RegisterResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Registration failed.");
      }

      const result = payload as RegisterResponse;
      setEligibility(result.eligibility);
      setSelectedTournament(result.tournament);
      setSuccess(`Registered ${result.registration.wallet}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Player Verification</h2>
              <p className="mt-2 text-sm text-slate-400">
                Verify credentials and write registrations to the tournament record.
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

          <div className="mt-6">
            <label className="text-sm font-medium text-slate-300">
              Wallet Address
            </label>
            <input
              value={wallet}
              onChange={(event) => setWallet(event.target.value)}
              placeholder="Enter player wallet..."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={checkEligibility}
              disabled={actionLoading || !selectedTournamentId || !wallet.trim()}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading ? "Working..." : "Check Eligibility"}
            </button>

            <button
              type="button"
              onClick={registerPlayer}
              disabled={
                actionLoading ||
                !selectedTournamentId ||
                !wallet.trim() ||
                !eligibility?.eligible
              }
              className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Register Player
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Credential Status</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                {eligibility ? (eligibility.eligible ? "Eligible" : "Not eligible") : "Pending"}
              </h3>
            </div>

            {eligibility ? (
              <div
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  eligibility.eligible
                    ? "bg-emerald-400/10 text-emerald-300"
                    : "bg-red-400/10 text-red-300"
                }`}
              >
                {eligibility.eligible ? "VERIFIED" : "REJECTED"}
              </div>
            ) : null}
          </div>

          {eligibility ? (
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Credential</span>
                <span>{eligibility.credential.credentialValue}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Game</span>
                <span>{eligibility.credential.gameId}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Issuer</span>
                <span>{eligibility.credential.issuer}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Reason</span>
                <span className="text-right">{eligibility.reason}</span>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-400">
              Run eligibility to inspect the DB-backed credential record for this player.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Registered Players</h2>
            <p className="mt-2 text-sm text-slate-400">
              Live tournament roster
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
            {loading ? "Loading..." : `${selectedTournament?.registrations.length ?? 0} Players`}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {selectedTournament?.registrations.length ? (
            selectedTournament.registrations.map((registration) => (
              <div
                key={registration.wallet}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-4"
              >
                <div>
                  <p className="font-medium">{registration.wallet}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {registration.credentialValue}
                  </p>
                </div>

                <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                  Registered
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-4 text-sm text-slate-400">
              No registered players yet for this tournament.
            </div>
          )}
        </div>

        {selectedTournamentId ? (
          <button
            type="button"
            onClick={() =>
              router.push(
                `/organizer/${encodeURIComponent(orgId)}/tournament/finalize?tournamentId=${encodeURIComponent(selectedTournamentId)}`
              )
            }
            className="mt-6 w-full rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Go To Finalize
          </button>
        ) : null}
      </div>
    </div>
  );
}

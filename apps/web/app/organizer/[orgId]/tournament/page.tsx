"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Plus, Trophy, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type {
  SessionResponse,
  SessionUser,
  TournamentSummary,
} from "@/lib/apiTypes";

type CreateTournamentResponse = TournamentSummary & {
  onchain?: {
    synced: boolean;
    skipped?: boolean;
    mode?: string;
    error?: string;
  };
};

function canManageTournaments(user: SessionUser | null) {
  return user?.role === "organizer" || user?.role === "admin";
}

function formatTournamentStatus(status: TournamentSummary["status"]) {
  return status === "in_progress"
    ? "In Progress"
    : status.charAt(0).toUpperCase() + status.slice(1);
}

export default function TournamentPage() {
  const router = useRouter();
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    winnerTokenName: "",
    participationTokenName: "",
  });

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

  const loadTournaments = useCallback(async (user: SessionUser) => {
    setLoading(true);

    try {
      const response = await fetch("/api/tournaments", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as {
        tournaments?: TournamentSummary[];
        error?: string;
      };

      if (!response.ok || !payload.tournaments) {
        throw new Error(payload.error ?? "Failed to load tournaments.");
      }

      const filtered =
        user.role === "admin"
          ? payload.tournaments
          : payload.tournaments.filter(
              (tournament) => tournament.organizerWallet === user.walletAddress
            );

      setTournaments(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tournaments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function load() {
      const user = await syncSession();
      if (user) {
        await loadTournaments(user);
      }
    }

    void load();
  }, [loadTournaments, syncSession]);

  async function createTournament() {
    setCreateLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createForm),
      });
      const payload = (await response.json().catch(() => ({}))) as
        | CreateTournamentResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Failed to create tournament.");
      }

      const tournament = payload as CreateTournamentResponse;
      setCreateForm({
        name: "",
        winnerTokenName: "",
        participationTokenName: "",
      });
      setSuccess(`Created ${tournament.name}.`);
      if (sessionUser) {
        await loadTournaments(sessionUser);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tournament.");
    } finally {
      setCreateLoading(false);
    }
  }

  function goToFinalize(tournamentId: string) {
    router.push(
      `/organizer/${encodeURIComponent(orgId)}/tournament/finalize?tournamentId=${encodeURIComponent(tournamentId)}`
    );
  }

  function goToGate(tournamentId: string) {
    router.push(
      `/organizer/${encodeURIComponent(orgId)}/tournament/gate?tournamentId=${encodeURIComponent(tournamentId)}`
    );
  }

  const stats = useMemo(() => {
    const activeCount = tournaments.filter(
      (tournament) =>
        tournament.status === "open" || tournament.status === "in_progress"
    ).length;
    const playerCount = tournaments.reduce(
      (sum, tournament) => sum + tournament.participantCount,
      0
    );
    const completedCount = tournaments.filter(
      (tournament) => tournament.status === "completed"
    ).length;

    return [
      {
        label: "Active Tournaments",
        value: String(activeCount),
        icon: Clock3,
      },
      {
        label: "Registered Players",
        value: playerCount.toLocaleString(),
        icon: Users,
      },
      {
        label: "Completed Events",
        value: String(completedCount),
        icon: CheckCircle2,
      },
    ];
  }, [tournaments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
            Tournament Infrastructure
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Tournaments</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Create events, review organizer-owned tournaments, and finalize
            outcomes directly from stored tournament records.
          </p>
        </div>
      </div>

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

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
          <div className="flex items-center gap-3">
            <Plus className="h-5 w-5 text-cyan-300" />
            <h2 className="text-xl font-semibold">Create tournament</h2>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              Tournament name
              <input
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="MLBB Spring Championship"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />
            </label>

            <label className="block text-sm font-medium text-slate-300">
              Winner token
              <input
                value={createForm.winnerTokenName}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    winnerTokenName: event.target.value,
                  }))
                }
                placeholder="Winner badge"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />
            </label>

            <label className="block text-sm font-medium text-slate-300">
              Participation token
              <input
                value={createForm.participationTokenName}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    participationTokenName: event.target.value,
                  }))
                }
                placeholder="Participation badge"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={createTournament}
            disabled={createLoading || !createForm.name.trim()}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createLoading ? "Creating..." : "Create tournament"}
          </button>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">
              {sessionUser?.displayName ?? "Organizer"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {sessionUser?.walletAddress ?? "Loading organizer wallet..."}
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-3xl border border-white/10 bg-slate-900/60 p-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">{stat.label}</p>
                    <Icon className="h-5 w-5 text-cyan-300" />
                  </div>
                  <p className="mt-4 text-3xl font-semibold">{stat.value}</p>
                </div>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50">
            <div className="border-b border-white/10 px-0 py-5">
              <h2 className="text-lg mx-4 font-semibold">Your tournaments</h2>
            </div>

            <div className="max-h-[20rem] overflow-y-auto ">
              <table className="w-full px-0 mx-0">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/95 text-left text-sm text-slate-400 backdrop-blur">
                    <th className="px-6 py-4 font-medium">Tournament</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Players</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-0 py-5 text-sm text-slate-400" colSpan={4}>
                        Loading tournaments...
                      </td>
                    </tr>
                  ) : tournaments.length > 0 ? (
                    tournaments.map((tournament) => (
                      <tr
                        key={tournament.id}
                        className="border-b border-white/5 transition hover:bg-white/[0.03]"
                      >
                        <td className="px-6 py-2">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10">
                              <Trophy className="h-5 w-5 text-cyan-300" />
                            </div>

                            <div>
                              <p className="font-medium text-white">
                                {tournament.name}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {tournament.entryRuleLabel}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                            {formatTournamentStatus(tournament.status)}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-sm text-slate-300">
                          {tournament.participantCount}
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => goToGate(tournament.id)}
                              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                            >
                              Gate Player
                            </button>

                            <button
                              type="button"
                              onClick={() => goToFinalize(tournament.id)}
                              className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                                tournament.status === "completed"
                                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                                  : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                              }`}
                            >
                              {tournament.status === "completed" ? "Completed" : "Finalize"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-6 py-5 text-sm text-slate-400" colSpan={4}>
                        No tournaments created for this organizer yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

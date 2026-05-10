"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  SessionResponse,
  SessionUser,
} from "@/lib/apiTypes";

type TournamentStatus = "open" | "in_progress" | "completed";

type TournamentSummary = {
  id: string;
  name: string;
  organizerName: string;
  organizerWallet: string;
  entryCredentialType: number;
  entryCredentialScopeId: string;
  entryRuleLabel: string;
  winnerTokenName: string;
  participationTokenName: string;
  status: TournamentStatus;
  participantCount: number;
  createdAt: string;
  completedAt: string | null;
  winnerWallet: string | null;
};

type TournamentRegistration = {
  wallet: string;
  credentialType: number;
  credentialInstanceId: string;
  credentialScopeId: string;
  credentialValue: string;
  issuer: string;
  expiresAt: string;
  registeredAt: string;
};

type TournamentDetail = TournamentSummary & {
  registrations: TournamentRegistration[];
};

type EligibilityPayload = {
  tournamentId: string;
  tournamentName: string;
  wallet: string;
  credentialType: number;
  ruleLabel: string;
  eligible: boolean;
  expired: boolean;
  checkedAt: string;
  trustModel: "issuer-backed";
  reason: string;
  credential: {
    credentialValue: string;
    credentialType: number;
    credentialInstanceId: string;
    credentialScopeId: string;
    issuer: string;
    issuedAt: string;
    expiresAt: string;
    metadataUri: string;
    gameLevel: number;
    gameId: string;
  };
};

type RegisterResponse = {
  tournament: TournamentDetail;
  registration: TournamentRegistration;
  eligibility: EligibilityPayload;
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

const DEFAULT_CREATE_FORM = {
  name: "",
  winnerTokenName: "",
  participationTokenName: "",
};

type FlowStepState = "active" | "locked" | "complete";
type DemoPage = "tournament" | "gate-player" | "finalize";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  return JSON.parse(text) as T;
}

function canManageTournaments(user: SessionUser | null) {
  return user?.role === "organizer" || user?.role === "admin";
}

function stepCardClassName(state: FlowStepState) {
  if (state === "complete") {
    return "border-emerald-400/30 bg-emerald-400/8";
  }

  if (state === "active") {
    return "border-cyan-400/40 bg-cyan-400/8 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]";
  }

  return "border-white/10 bg-white/5 opacity-80";
}

function stepBadgeClassName(state: FlowStepState) {
  if (state === "complete") {
    return "bg-emerald-400/15 text-emerald-200";
  }

  if (state === "active") {
    return "bg-cyan-400/15 text-cyan-200";
  }

  return "bg-white/10 text-slate-300";
}

function formatWallet(wallet: string) {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function pageButtonClassName(active: boolean, locked: boolean) {
  if (active) {
    return "border-cyan-400 bg-cyan-400/12 text-cyan-100";
  }

  if (locked) {
    return "border-white/10 bg-white/5 text-slate-500";
  }

  return "border-white/10 bg-slate-950/40 text-slate-200 hover:border-white/20";
}

export function OrganizerDemoClient({
  initialWallet,
}: {
  initialWallet: string;
}) {
  const router = useRouter();

  const [wallet, setWallet] = useState(initialWallet);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [selectedTournament, setSelectedTournament] =
    useState<TournamentDetail | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityPayload | null>(null);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [winnerWallet, setWinnerWallet] = useState("");
  const [currentPage, setCurrentPage] = useState<DemoPage>("tournament");
  const [createLoading, setCreateLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const organizerAuthenticated = canManageTournaments(sessionUser);
  const hasRegisteredPlayers = Boolean(selectedTournament?.registrations.length);
  const tournamentCompleted = selectedTournament?.status === "completed";
  const hasSelectedTournament = Boolean(selectedTournament);
  const createStepState: FlowStepState = hasSelectedTournament ? "complete" : "active";
  const gateStepState: FlowStepState = tournamentCompleted
    ? "complete"
    : hasSelectedTournament
      ? "active"
      : "locked";
  const finalizeStepState: FlowStepState = tournamentCompleted
    ? "complete"
    : hasRegisteredPlayers
      ? "active"
      : "locked";

  const syncSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      const payload = await apiFetch<SessionResponse>("/auth/session");
      if (!canManageTournaments(payload.user)) {
        setSessionUser(null);
        router.replace("/login/organizer");
        return;
      }

      setSessionUser(payload.user);
    } catch {
      setSessionUser(null);
      router.replace("/login/organizer");
    } finally {
      setSessionLoading(false);
    }
  }, [router]);

  const loadTournaments = useCallback(async (preferredTournamentId?: string) => {
    setLoadingTournaments(true);

    try {
      const response = await fetch("/api/tournaments", { cache: "no-store" });
      const payload = (await readJsonResponse<{
        tournaments?: TournamentSummary[];
        error?: string;
      }>(response)) ?? {};

      if (!response.ok || !payload.tournaments) {
        throw new Error(payload.error ?? "Failed to load tournaments.");
      }

      setTournaments(payload.tournaments);

      if (preferredTournamentId) {
        setSelectedTournamentId(preferredTournamentId);
      } else if (!selectedTournamentId && payload.tournaments[0]) {
        setSelectedTournamentId(payload.tournaments[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tournaments.");
    } finally {
      setLoadingTournaments(false);
    }
  }, [selectedTournamentId]);

  const loadTournament = useCallback(async (tournamentId: string) => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(
          `/api/tournaments/${encodeURIComponent(tournamentId)}`,
          {
            cache: "no-store",
          }
        );
        const payload =
          (await readJsonResponse<TournamentDetail | { error: string }>(response)) ??
          { error: "Failed to load tournament." };

        if (!response.ok) {
          throw new Error("error" in payload ? payload.error : "Failed to load tournament.");
        }

        const detail = payload as TournamentDetail;
        setSelectedTournament(detail);
        setWinnerWallet(detail.winnerWallet ?? "");
        return;
      } catch (err) {
        lastError =
          err instanceof Error ? err : new Error("Failed to load tournament.");

        if (attempt < 2) {
          await delay(450 * (attempt + 1));
        }
      }
    }

    setSelectedTournament(null);
    setError(lastError?.message ?? "Failed to load tournament.");
  }, []);

  const refreshTournamentState = useCallback(
    async (tournamentId: string) => {
      await loadTournaments(tournamentId);
      await loadTournament(tournamentId);
    },
    [loadTournament, loadTournaments]
  );

  useEffect(() => {
    void syncSession();
  }, [syncSession]);

  useEffect(() => {
    void loadTournaments();
  }, [loadTournaments]);

  useEffect(() => {
    if (!selectedTournamentId && tournaments[0]) {
      setSelectedTournamentId(tournaments[0].id);
      return;
    }

    if (
      selectedTournamentId &&
      tournaments.length > 0 &&
      !tournaments.some((tournament) => tournament.id === selectedTournamentId)
    ) {
      setSelectedTournamentId(tournaments[0]?.id ?? "");
    }
  }, [selectedTournamentId, tournaments]);

  useEffect(() => {
    if (!selectedTournamentId) {
      setSelectedTournament(null);
      return;
    }

    void loadTournament(selectedTournamentId);
  }, [loadTournament, selectedTournamentId]);

  async function handleLogout() {
    setError(null);
    setSuccess(null);
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
      setSessionUser(null);
      router.push("/login/organizer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed.");
    }
  }

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
        body: JSON.stringify({
          ...createForm,
        }),
      });

      const payload =
        (await readJsonResponse<TournamentDetail | { error: string }>(response)) ??
        { error: "Failed to create tournament." };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Failed to create tournament.");
      }

      const tournament = payload as TournamentDetail;
      await refreshTournamentState(tournament.id);
      setSuccess(`Created ${tournament.name}.`);
      setCurrentPage("gate-player");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tournament.");
    } finally {
      setCreateLoading(false);
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

      const payload =
        (await readJsonResponse<EligibilityPayload | { error: string }>(response)) ??
        { error: "Organizer check failed." };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Organizer check failed.");
      }

      setEligibility(payload as EligibilityPayload);
      setSuccess(`Eligibility checked for ${wallet.trim()}.`);
    } catch (err) {
      setEligibility(null);
      setError(err instanceof Error ? err.message : "Organizer check failed.");
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

      const payload =
        (await readJsonResponse<RegisterResponse | { error: string }>(response)) ??
        { error: "Registration failed." };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Registration failed.");
      }

      const result = payload as RegisterResponse;
      setEligibility(result.eligibility);
      setWinnerWallet(result.tournament.winnerWallet ?? result.registration.wallet);
      await refreshTournamentState(result.tournament.id);
      setSuccess(`Registered ${result.registration.wallet} for ${result.tournament.name}.`);
      setCurrentPage("finalize");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function finalizeSelectedTournament() {
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

      const payload =
        (await readJsonResponse<FinalizeResponse | { error: string }>(response)) ??
        { error: "Finalization failed." };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Finalization failed.");
      }

      const result = payload as FinalizeResponse;
      await refreshTournamentState(result.tournament.id);
      setSuccess(
        `Finalized ${result.tournament.name}. Winner saved as ${result.distribution.winnerWallet}.`
      );
      router.push(`/${encodeURIComponent(result.distribution.winnerWallet)}/achivement`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Finalization failed.");
    } finally {
      setActionLoading(false);
    }
  }

  function goToPage(page: DemoPage) {
    if (page === "gate-player" && !hasSelectedTournament) {
      return;
    }

    if (page === "finalize" && !hasRegisteredPlayers && !tournamentCompleted) {
      return;
    }

    setCurrentPage(page);
  }

  function statusClassName(status: TournamentStatus) {
    if (status === "completed") {
      return "bg-emerald-400/15 text-emerald-200";
    }

    if (status === "in_progress") {
      return "bg-cyan-400/15 text-cyan-200";
    }

    return "bg-amber-300/15 text-amber-100";
  }

  if (sessionLoading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#164e63_0,#0f172a_45%,#020617_100%)] px-6 py-10 text-slate-50">
        <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
          Checking organizer session...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#164e63_0,#0f172a_45%,#020617_100%)] px-6 py-10 text-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_rgba(3,7,18,0.28)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">
                Organizer dashboard
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-white">
                Tournament workflow
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                MVP flow is DB-backed: create the tournament, gate players, then
                finalize the result.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Signed in
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {sessionUser?.displayName ?? "Organizer"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {sessionUser?.walletAddress
                  ? formatWallet(sessionUser.walletAddress)
                  : "No session wallet"}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => goToPage("tournament")}
            className={`rounded-3xl border p-5 text-left transition ${pageButtonClassName(
              currentPage === "tournament",
              false
            )}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Page 1
            </p>
            <h2 className="mt-2 text-xl font-semibold">Tournament</h2>
            <p className="mt-2 text-sm text-slate-300">
              Create or select the event record in the database.
            </p>
          </button>
          <button
            type="button"
            onClick={() => goToPage("gate-player")}
            className={`rounded-3xl border p-5 text-left transition ${pageButtonClassName(
              currentPage === "gate-player",
              !hasSelectedTournament
            )}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Page 2
            </p>
            <h2 className="mt-2 text-xl font-semibold">Gate Player</h2>
            <p className="mt-2 text-sm text-slate-300">
              Check eligibility and store registrations for this tournament.
            </p>
          </button>
          <button
            type="button"
            onClick={() => goToPage("finalize")}
            className={`rounded-3xl border p-5 text-left transition ${pageButtonClassName(
              currentPage === "finalize",
              !hasRegisteredPlayers && !tournamentCompleted
            )}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Page 3
            </p>
            <h2 className="mt-2 text-xl font-semibold">Finalize</h2>
            <p className="mt-2 text-sm text-slate-300">
              Save the winner and close the tournament workflow.
            </p>
          </button>
        </section>

        {error ? (
          <div className="rounded-[18px] border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-[18px] border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            {success}
          </div>
        ) : null}

        {currentPage === "tournament" ? (
          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className={`rounded-3xl border p-6 ${stepCardClassName(createStepState)}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Step 1
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Create tournament</h2>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Organizer identity
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-slate-400">Signed-in user</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {sessionUser?.displayName ?? "Unknown organizer"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {sessionUser?.username
                          ? `@${sessionUser.username}`
                          : "Username not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Wallet</p>
                      <p className="mt-1 font-mono text-xs text-slate-200">
                        {sessionUser?.walletAddress
                          ? formatWallet(sessionUser.walletAddress)
                          : "No session wallet"}
                      </p>
                      <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                        {sessionUser?.walletAddress ?? ""}
                      </p>
                    </div>
                  </div>
                </div>

                <label className="text-sm font-medium text-slate-200">
                  Tournament name
                  <input
                    value={createForm.name}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                    placeholder="MLBB Championship 2024"
                  />
                </label>

                <label className="text-sm font-medium text-slate-200">
                  Winner token
                  <input
                    value={createForm.winnerTokenName}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        winnerTokenName: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                    placeholder="Winner badge"
                  />
                </label>

                <label className="text-sm font-medium text-slate-200 sm:col-span-2">
                  Participation token
                  <input
                    value={createForm.participationTokenName}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        participationTokenName: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                    placeholder="Participation badge"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={createTournament}
                  disabled={!organizerAuthenticated || createLoading || !createForm.name.trim()}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createLoading ? "Creating..." : "Create tournament"}
                </button>
                <button
                  type="button"
                  onClick={() => goToPage("gate-player")}
                  disabled={!hasSelectedTournament}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next: Gate player
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Active events
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Select a tournament</h2>
                </div>
                <span className="text-sm text-slate-400">
                  {loadingTournaments ? "Loading..." : `${tournaments.length} tournaments`}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {tournaments.map((tournament) => (
                  <button
                    key={tournament.id}
                    type="button"
                    onClick={() => setSelectedTournamentId(tournament.id)}
                    className={`w-full rounded-[20px] border px-4 py-4 text-left transition ${
                      selectedTournamentId === tournament.id
                        ? "border-cyan-400 bg-cyan-400/10"
                        : "border-white/10 bg-slate-950/40 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-white">
                          {tournament.name}
                        </p>
                        <p className="mt-1 text-sm text-slate-300">
                          {tournament.organizerName} · {tournament.entryRuleLabel}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(
                          tournament.status
                        )}`}
                      >
                        {tournament.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                      <span>{tournament.participantCount} players</span>
                      <span>{tournament.winnerTokenName}</span>
                      <span>{tournament.participationTokenName}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {currentPage === "gate-player" ? (
          <section className="space-y-6">
            <div className={`rounded-3xl border p-6 ${stepCardClassName(gateStepState)}`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Step 2
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Gate players</h2>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stepBadgeClassName(gateStepState)}`}>
                  {gateStepState === "complete"
                    ? "Completed"
                    : gateStepState === "active"
                      ? "Active"
                      : "Locked"}
                </span>
              </div>

              {selectedTournament ? (
                <div className="mt-5 space-y-5">
                  <div className="rounded-[18px] border border-white/10 bg-slate-950/50 p-4">
                    <p className="text-sm uppercase tracking-[0.16em] text-slate-400">
                      Active tournament
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      {selectedTournament.name}
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {selectedTournament.entryRuleLabel} · Winner token:{" "}
                      {selectedTournament.winnerTokenName} · Participation token:{" "}
                      {selectedTournament.participationTokenName}
                    </p>
                  </div>

                  <label className="block text-sm font-medium text-slate-200">
                    Player wallet
                    <input
                      value={wallet}
                      onChange={(event) => setWallet(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                      placeholder="Player wallet address"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={checkEligibility}
                      disabled={
                        !organizerAuthenticated ||
                        actionLoading ||
                        !wallet.trim() ||
                        tournamentCompleted
                      }
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionLoading ? "Working..." : "Check eligibility"}
                    </button>

                    <button
                      type="button"
                      onClick={registerPlayer}
                      disabled={
                        !organizerAuthenticated ||
                        actionLoading ||
                        !wallet.trim() ||
                        tournamentCompleted
                      }
                      className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Register player
                    </button>
                  </div>

                  {eligibility ? (
                    <div className="rounded-[18px] border border-white/10 bg-slate-950/50 p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm text-slate-300">{eligibility.ruleLabel}</p>
                          <p className="mt-2 text-3xl font-semibold text-white">
                            {eligibility.eligible ? "Eligible" : "Not eligible"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            eligibility.eligible
                              ? "bg-emerald-400/15 text-emerald-200"
                              : "bg-red-400/15 text-red-200"
                          }`}
                        >
                          {eligibility.eligible ? "Approve entry" : "Reject entry"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {eligibility.reason}
                      </p>

                      <dl className="mt-4 grid gap-3 text-sm text-slate-200">
                        <div className="flex justify-between gap-4">
                          <dt>Credential value</dt>
                          <dd>{eligibility.credential.credentialValue}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt>Game ID</dt>
                          <dd>{eligibility.credential.gameId}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt>Game level</dt>
                          <dd>{eligibility.credential.gameLevel}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt>Expires</dt>
                          <dd>{new Date(eligibility.credential.expiresAt).toLocaleString()}</dd>
                        </div>
                      </dl>
                    </div>
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm leading-6 text-slate-300">
                      Run an eligibility check to inspect the player credential
                      before registration. Register eligible players here, then move
                      to tournament finalization after at least one player is in the roster.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => goToPage("tournament")}
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                    >
                      Back: Tournament
                    </button>
                    <button
                      type="button"
                      onClick={() => goToPage("finalize")}
                      disabled={!hasRegisteredPlayers && !tournamentCompleted}
                      className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Next: Finalize
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[18px] border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm leading-6 text-slate-300">
                  Create or select a tournament to start managing registrations.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {currentPage === "finalize" ? (
          <section className="space-y-6">
            <div className={`rounded-3xl border p-6 ${stepCardClassName(finalizeStepState)}`}>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                Step 3
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold">Finalize tournament</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${stepBadgeClassName(finalizeStepState)}`}>
                  {finalizeStepState === "complete"
                    ? "Completed"
                    : finalizeStepState === "active"
                      ? "Active"
                      : "Locked"}
                </span>
              </div>

              {selectedTournament ? (
                <div className="mt-5 space-y-5">
                  {!hasRegisteredPlayers && !tournamentCompleted ? (
                    <div className="rounded-[18px] border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                      Gate and register at least one player before tournament finalization
                      becomes available.
                    </div>
                  ) : null}

                  <label className="block text-sm font-medium text-slate-200">
                    Winner wallet
                    <input
                      value={winnerWallet}
                      onChange={(event) => setWinnerWallet(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                      placeholder="Select a registered player wallet"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={finalizeSelectedTournament}
                    disabled={
                      !organizerAuthenticated ||
                      actionLoading ||
                      !winnerWallet.trim() ||
                      !hasRegisteredPlayers ||
                      tournamentCompleted
                    }
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {tournamentCompleted
                      ? "Tournament completed"
                      : !hasRegisteredPlayers
                        ? "Gate players first"
                      : "Finalize tournament"}
                  </button>

                  <div className="rounded-[18px] border border-white/10 bg-slate-950/50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Registered players
                    </p>
                    <div className="mt-4 space-y-3">
                      {selectedTournament.registrations.length > 0 ? (
                        selectedTournament.registrations.map((registration) => (
                          <button
                            key={registration.wallet}
                            type="button"
                            onClick={() => setWinnerWallet(registration.wallet)}
                            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-white/20"
                          >
                            <div>
                              <p className="font-medium text-white">{registration.wallet}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {registration.credentialValue}
                              </p>
                            </div>
                            <span className="text-xs text-slate-400">
                              {new Date(registration.registeredAt).toLocaleString()}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="text-sm leading-6 text-slate-300">
                          No players registered yet. Check a credential and register an
                          eligible wallet first.
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedTournament.status === "completed" &&
                  selectedTournament.winnerWallet ? (
                    <div className="rounded-[18px] border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                      Winner recorded: {selectedTournament.winnerWallet}. Participation
                      records are marked complete for{" "}
                      {selectedTournament.participantCount} registered players.
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => goToPage("gate-player")}
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                    >
                      Back: Gate player
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Complete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[18px] border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm leading-6 text-slate-300">
                  Tournament finalization becomes available after you select an event and
                  gate registered players.
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  OrganizerApplicationReviewItem,
  SessionResponse,
  SessionUser,
} from "@/lib/apiTypes";

type OrganizerApplicationsResponse = {
  applications: OrganizerApplicationReviewItem[];
};

function formatWallet(wallet: string) {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function AdminOrganizerPanelClient() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [applications, setApplications] = useState<OrganizerApplicationReviewItem[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const syncSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      const payload = await apiFetch<SessionResponse>("/auth/session");
      if (payload.user.role !== "admin") {
        setSessionUser(null);
        router.replace("/login/admin");
        return;
      }

      setSessionUser(payload.user);
    } catch {
      setSessionUser(null);
      router.replace("/login/admin");
    } finally {
      setSessionLoading(false);
    }
  }, [router]);

  const loadApplications = useCallback(async () => {
    setApplicationsLoading(true);
    try {
      const payload = await apiFetch<OrganizerApplicationsResponse>(
        "/admin/organizer-applications"
      );
      setApplications(payload.applications);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load organizer applications."
      );
    } finally {
      setApplicationsLoading(false);
    }
  }, []);

  useEffect(() => {
    void syncSession();
  }, [syncSession]);

  useEffect(() => {
    if (!sessionUser || sessionUser.role !== "admin") {
      return;
    }

    void loadApplications();
  }, [loadApplications, sessionUser]);

  async function handleReview(applicationId: string, action: "approve" | "reject") {
    setActionLoadingId(applicationId);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch<{ application: OrganizerApplicationReviewItem }>(
        `/admin/organizer-applications/${encodeURIComponent(applicationId)}/${action}`,
        { method: "POST" }
      );
      await loadApplications();
      setSuccess(
        action === "approve"
          ? "Organizer application approved."
          : "Organizer application rejected."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review action failed.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleLogout() {
    setError(null);
    setSuccess(null);

    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
      router.push("/login/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed.");
    }
  }

  if (sessionLoading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#040612] px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl rounded-[28px] border border-white/10 bg-slate-950/50 p-6 text-sm text-slate-300 backdrop-blur">
          Checking admin session...
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#040612] text-white">
      <Image
        src="/Landing page background.jpeg"
        alt="GameChain background"
        fill
        priority
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.66)_0%,rgba(2,6,23,0.82)_45%,rgba(2,6,23,0.92)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(107,33,168,0.24),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(37,99,235,0.2),transparent_24%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#7dd3fc]">
              GameChain
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              Admin organizer review panel
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Review organizer requests, verify wallet ownership context, and approve
              or reject access.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {sessionUser ? (
              <span className="inline-flex rounded-full border border-white/10 bg-slate-950/50 px-4 py-2 text-sm text-slate-200 backdrop-blur">
                {sessionUser.displayName ?? formatWallet(sessionUser.walletAddress)}
              </span>
            ) : null}
            <Link
              href="/"
              className="inline-flex rounded-full border border-cyan-300/20 bg-slate-950/55 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-slate-900/70"
            >
              Back home
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              End session
            </button>
          </div>
        </header>

        {error ? (
          <section className="mt-6 rounded-[22px] border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
            {error}
          </section>
        ) : null}

        {success ? (
          <section className="mt-6 rounded-[22px] border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            {success}
          </section>
        ) : null}

        <section className="mt-8 rounded-[30px] border border-white/10 bg-slate-950/50 p-6 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#7dd3fc]">
                Organizer requests
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Pending and reviewed applications
              </h2>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
              {applications.length} total
            </span>
          </div>

          {applicationsLoading ? (
            <div className="mt-6 rounded-[22px] border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
              Loading organizer applications...
            </div>
          ) : applications.length === 0 ? (
            <div className="mt-6 rounded-[22px] border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
              No organizer applications yet.
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {applications.map((application) => (
                <article
                  key={application.id}
                  className="rounded-[24px] border border-white/10 bg-black/20 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold text-white">
                          {application.displayName ?? application.username ?? "Unnamed user"}
                        </h3>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                          {application.status}
                        </span>
                        <span className="rounded-full border border-cyan-300/15 px-3 py-1 text-xs font-semibold text-cyan-100">
                          {application.organizerStatus}
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-xs text-slate-300">
                        {application.walletAddress}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        Username: {application.username ?? "Not set"} · Role: {application.role}
                      </p>
                    </div>

                    <div className="text-right text-xs text-slate-400">
                      <p>Applied {new Date(application.createdAt).toLocaleString()}</p>
                      <p className="mt-1">
                        Reviewed{" "}
                        {application.reviewedAt
                          ? new Date(application.reviewedAt).toLocaleString()
                          : "Not yet"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[18px] border border-white/10 bg-slate-950/45 p-4 text-sm leading-7 text-slate-200">
                    {application.reason}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleReview(application.id, "approve")}
                      disabled={actionLoadingId === application.id}
                      className="inline-flex rounded-full bg-[linear-gradient(90deg,#8b5cf6_0%,#38bdf8_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(56,189,248,0.28)] transition hover:scale-[1.02] disabled:opacity-50"
                    >
                      {actionLoadingId === application.id ? "Working..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReview(application.id, "reject")}
                      disabled={actionLoadingId === application.id}
                      className="inline-flex rounded-full border border-rose-400/30 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15 disabled:opacity-50"
                    >
                      {actionLoadingId === application.id ? "Working..." : "Reject"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

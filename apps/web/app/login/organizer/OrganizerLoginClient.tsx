"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  OrganizerApplication,
  SessionResponse,
  SessionUser,
} from "@/lib/apiTypes";
import { persistOrganizerOrgId } from "@/lib/organizerStorage";

type OrganizerRegistrationResponse = SessionResponse & {
  application: OrganizerApplication;
  isNewUser: boolean;
  needsOnboarding: boolean;
};

function canManageTournaments(user: SessionUser | null) {
  return user?.role === "organizer" || user?.role === "admin";
}

export function OrganizerLoginClient() {
  const router = useRouter();

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [application, setApplication] = useState<OrganizerApplication | null>(null);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [walletAddress, setWalletAddress] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [applicationReason, setApplicationReason] = useState(
    "I organize competitive gaming events and need organizer access to create tournaments, verify players, and run bracket operations."
  );

  const [authLoading, setAuthLoading] = useState(false);
  const [applicationSaving, setApplicationSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const syncSession = useCallback(async () => {
    try {
      const payload = await apiFetch<SessionResponse>("/auth/session");
      setSessionUser(payload.user);
      setUsername(payload.user.username ?? "");
      setDisplayName(payload.user.displayName ?? "");

      if (canManageTournaments(payload.user)) {
        persistOrganizerOrgId(payload.user.orgId);
        router.replace(`/organizer/${payload.user.orgId}`);
      }
    } catch {
      setSessionUser(null);
    }
  }, [router]);

  useEffect(() => {
    void syncSession();
  }, [syncSession]);

  async function handleLogin() {
    setError(null);
    setSuccess(null);
    setAuthLoading(true);

    try {
      const payload = await apiFetch<SessionResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });

      setSessionUser(payload.user);

      if (canManageTournaments(payload.user)) {
        persistOrganizerOrgId(payload.user.orgId);
        router.push(`/organizer/${payload.user.orgId}`);
        return;
      }

      setSuccess("Signed in. Your organizer access is still under review.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid username or password.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleApply() {
    setError(null);
    setSuccess(null);
    setApplicationSaving(true);

    try {
      const payload = await apiFetch<OrganizerRegistrationResponse>(
        "/auth/register-organizer",
        {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            username,
            displayName,
            password,
            reason: applicationReason,
          }),
        }
      );

      setSessionUser(payload.user);
      setApplication(payload.application);
      setLoginUsername(payload.user.username ?? username);
      setLoginPassword("");
      setSuccess(
        payload.user.organizerStatus === "approved"
          ? "Organizer account is ready. Redirecting to the dashboard."
          : "Organizer request submitted. An admin will review it before dashboard access is enabled."
      );

      if (canManageTournaments(payload.user)) {
        persistOrganizerOrgId(payload.user.orgId);
        router.push(`/organizer/${payload.user.orgId}/tournament`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Organizer signup failed.");
    } finally {
      setApplicationSaving(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#040612] text-white">
      <Image
        src="/Landing page background.jpeg"
        alt="background"
        fill
        priority
        className="object-cover"
      />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="flex justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-300">
              GameChain
            </p>
            <p className="text-sm text-slate-300">Organizer portal</p>
          </div>

          <Link href="/" className="text-sm text-white">
            Back home
          </Link>
        </header>

        <div className="mx-auto mt-10 grid w-full max-w-5xl gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-black/40 p-6">
            <h1 className="text-2xl font-semibold">Organizer login</h1>
            <p className="mt-3 text-sm text-slate-300">
              Admin-approved organizers sign in with username and password.
            </p>

            {error ? <p className="mt-4 text-red-400">{error}</p> : null}
            {success ? <p className="mt-4 text-green-400">{success}</p> : null}

            {!sessionUser ? (
              <div className="mt-6 space-y-3">
                <input
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full rounded-xl bg-black/40 p-3"
                />

                <input
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  type="password"
                  placeholder="Password"
                  className="w-full rounded-xl bg-black/40 p-3"
                />

                <button
                  onClick={handleLogin}
                  disabled={authLoading}
                  className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-cyan-400 p-3 font-semibold"
                >
                  {authLoading ? "Logging in..." : "Login"}
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-white/5 p-4">
                <p>Logged in as: {sessionUser.username}</p>
                <p>Role: {sessionUser.role}</p>
                <p>Status: {sessionUser.organizerStatus}</p>
                {canManageTournaments(sessionUser) ? (
                  <p className="mt-4 text-sm text-slate-300">
                    Redirecting to the organizer dashboard.
                  </p>
                ) : null}
              </div>
            )}

            {sessionUser && !canManageTournaments(sessionUser) ? (
              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                {sessionUser.organizerStatus === "pending"
                  ? "Your organizer request is pending admin approval."
                  : sessionUser.organizerStatus === "rejected"
                    ? "Your previous organizer request was rejected. Update the details on the right and resubmit if needed."
                    : "Your organizer profile is saved, but access has not been approved yet."}
              </div>
            ) : null}

            {application ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                Latest application status: {application.status}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/40 p-6">
            <h2 className="text-2xl font-semibold">Request organizer access</h2>
            <p className="mt-3 text-sm text-slate-300">
              New organizers can register with their wallet address, then use username
              and password after admin approval.
            </p>

            <div className="mt-6 space-y-3">
              <input
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Solana wallet address"
                className="w-full rounded-xl bg-black/40 p-3"
              />
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                className="w-full rounded-xl bg-black/40 p-3"
              />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full rounded-xl bg-black/40 p-3"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Password"
                className="w-full rounded-xl bg-black/40 p-3"
              />
              <textarea
                value={applicationReason}
                onChange={(e) => setApplicationReason(e.target.value)}
                rows={5}
                className="w-full rounded-xl bg-black/40 p-3"
              />
              <button
                onClick={handleApply}
                disabled={applicationSaving}
                className="w-full rounded-xl bg-white/10 p-3 font-semibold"
              >
                {applicationSaving ? "Submitting..." : "Apply for organizer access"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

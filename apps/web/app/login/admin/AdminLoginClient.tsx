"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { SessionResponse, SessionUser } from "@/lib/apiTypes";

export function AdminLoginClient() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const syncSession = useCallback(async () => {
    try {
      const payload = await apiFetch<SessionResponse>("/auth/session");
      setSessionUser(payload.user);

      if (payload.user.role === "admin") {
        router.replace("/admin/organizers");
      }
    } catch {
      setSessionUser(null);
    }
  }, [router]);

  useEffect(() => {
    void syncSession();
  }, [syncSession]);

  async function handleSignIn() {
    setError(null);
    setSuccess(null);
    setAuthLoading(true);

    try {
      const payload = await apiFetch<SessionResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (payload.user.role !== "admin") {
        throw new Error("Admin access required for this portal.");
      }

      setSessionUser(payload.user);
      setSuccess("Admin session verified. Redirecting to the admin panel.");
      router.push("/admin");
    } catch (err) {
      setSessionUser(null);
      setError(err instanceof Error ? err.message : "Admin sign-in failed.");
    } finally {
      setAuthLoading(false);
    }
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
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.62)_0%,rgba(2,6,23,0.78)_48%,rgba(2,6,23,0.9)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(107,33,168,0.24),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(37,99,235,0.2),transparent_24%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#7dd3fc]">
              GameChain
            </p>
            <p className="mt-2 text-sm text-slate-300">Admin login portal</p>
          </div>

          <Link
            href="/"
            className="inline-flex rounded-full border border-cyan-300/20 bg-slate-950/55 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-slate-900/70"
          >
            Back home
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-slate-950/50 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
            <div className="mt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#7dd3fc]">
                Identity
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Username and password
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Use the admin credentials to review organizer applications and manage access.
              </p>
            </div>

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

            {!sessionUser ? (
              <div className="mt-6 space-y-3">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Admin username"
                  className="w-full rounded-xl bg-black/40 p-3"
                />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Admin password"
                  className="w-full rounded-xl bg-black/40 p-3"
                />
                <button
                  onClick={handleSignIn}
                  disabled={authLoading}
                  className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-cyan-400 p-3 font-semibold"
                >
                  {authLoading ? "Logging in..." : "Login"}
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-white/10 bg-slate-950/45 p-5">
                <p className="text-sm text-slate-300">Active admin session</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {sessionUser.displayName ?? sessionUser.username}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Signed in as `{sessionUser.role}`. Redirecting to the admin panel.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

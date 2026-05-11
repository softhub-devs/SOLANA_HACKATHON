"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import { apiFetch } from "@/lib/api";
import type {
  AuthChallengeResponse,
  AuthVerifyResponse,
  SessionResponse,
  SessionUser,
} from "@/lib/apiTypes";

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}

function formatWallet(wallet: string) {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function PlayerLoginClient() {
  const router = useRouter();
  const { connectors, connect, disconnect, wallet, status, isReady } =
    useWalletConnection();
  const walletAddress = wallet?.account.address?.toString() ?? "";
  const walletConnected = status === "connected";
  const connecting = status === "connecting";
  const preferredConnector =
    connectors.find((connector) => {
      const id = connector.id.toLowerCase();
      const name = connector.name.toLowerCase();
      return id.includes("phantom") || name.includes("phantom");
    }) ?? connectors[0];

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onboardingRequired = sessionUser
    ? !sessionUser.username || !sessionUser.displayName
    : false;

  const clearActiveSession = useCallback(async () => {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } catch {
      // Best effort: local state still gets cleared even if the stale session cookie is gone.
    }
  }, []);

  const syncSession = useCallback(async () => {
    try {
      const payload = await apiFetch<SessionResponse>("/auth/session");

      if (
        walletConnected &&
        walletAddress &&
        payload.user.walletAddress !== walletAddress
      ) {
        await clearActiveSession();
        setSessionUser(null);
        setUsername("");
        setDisplayName("");
        setError("Connected wallet does not match the active session. Sign in with this wallet to continue.");
        return;
      }

      setSessionUser(payload.user);
      setUsername(payload.user.username ?? "");
      setDisplayName(payload.user.displayName ?? "");

      if (payload.user.username && payload.user.displayName) {
        router.push(`/${encodeURIComponent(payload.user.walletAddress)}`);
      }
    } catch {
      setSessionUser(null);
    }
  }, [clearActiveSession, router, walletAddress, walletConnected]);

  useEffect(() => {
    void syncSession();
  }, [syncSession]);

  useEffect(() => {
    if (!walletConnected || !walletAddress || !sessionUser) {
      return;
    }

    if (sessionUser.walletAddress !== walletAddress) {
      void clearActiveSession();
      setSessionUser(null);
      setUsername("");
      setDisplayName("");
      setError("Connected wallet changed. Sign in again to start a new player session.");
    }
  }, [clearActiveSession, walletAddress, walletConnected, sessionUser]);

  async function handleConnect() {
    setError(null);
    setSuccess(null);

    if (!isReady || !preferredConnector?.id) {
      setError("Install Phantom or wait for wallet connectors to finish loading.");
      return;
    }

    try {
      await connect(preferredConnector.id, {
        allowInteractiveFallback: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed.");
    }
  }

  async function handleSignIn() {
    setError(null);
    setSuccess(null);
    setAuthLoading(true);

    try {
      if (!walletConnected || !walletAddress || !wallet?.signMessage) {
        throw new Error("Connect a wallet with message signing support first.");
      }

      const challenge = await apiFetch<AuthChallengeResponse>("/auth/challenge", {
        method: "POST",
        body: JSON.stringify({ walletAddress, authIntent: "player" }),
      });

      const signature = await wallet.signMessage(
        new TextEncoder().encode(challenge.message)
      );
      const signatureBase64 = bytesToBase64(signature);

      const payload = await apiFetch<AuthVerifyResponse>("/auth/verify", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          nonce: challenge.nonce,
          message: challenge.message,
          signature: signatureBase64,
          authIntent: "player",
        }),
      });

      setSessionUser(payload.user);
      setUsername(payload.user.username ?? "");
      setDisplayName(payload.user.displayName ?? "");

      if (payload.needsOnboarding) {
        setSuccess("Wallet verified. Finish your profile to enter the player dashboard.");
      } else {
        router.push(`/player/${encodeURIComponent(payload.user.walletAddress)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSaveProfile() {
    setError(null);
    setSuccess(null);
    setProfileSaving(true);

    try {
      const payload = await apiFetch<{ user: SessionUser }>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ username, displayName }),
      });
      setSessionUser(payload.user);
      router.push(`/player/${encodeURIComponent(payload.user.walletAddress)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profile update failed.");
    } finally {
      setProfileSaving(false);
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
            <p className="mt-2 text-sm text-slate-300">Player login portal</p>
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
                Connect and sign
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Use your wallet to verify player identity and enter GameChain.
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

            <div className="mt-6 rounded-[24px] border border-white/10 bg-slate-950/45 p-5">
              <p className="text-sm text-slate-300">Connected wallet</p>
              <p className="mt-2 break-all font-mono text-sm text-white">
                {walletConnected ? walletAddress : "No wallet connected yet."}
              </p>

              {sessionUser ? (
                <p className="mt-3 text-sm text-slate-300">
                  Active session: {formatWallet(sessionUser.walletAddress)}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                {!walletConnected ? (
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={!isReady || connecting || !preferredConnector?.id}
                    className="inline-flex rounded-full bg-[linear-gradient(90deg,#8b5cf6_0%,#38bdf8_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(56,189,248,0.28)] transition hover:scale-[1.02] disabled:opacity-50"
                  >
                    {connecting ? "Connecting..." : "Connect wallet"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => disconnect()}
                    className="inline-flex rounded-full border border-cyan-300/20 bg-slate-950/55 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-slate-900/70"
                  >
                    Disconnect
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={!walletConnected || authLoading || !wallet?.signMessage}
                  className="inline-flex rounded-full border border-cyan-300/20 bg-slate-950/55 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-slate-900/70 disabled:opacity-50"
                >
                  {authLoading ? "Waiting for signature..." : "Sign in"}
                </button>

                {sessionUser ? (
                  <p className="inline-flex items-center text-sm text-slate-300">
                    Active session detected. Redirecting to your dashboard.
                  </p>
                ) : null}
              </div>
            </div>

            {onboardingRequired ? (
              <div className="mt-6 rounded-[24px] border border-white/10 bg-slate-950/45 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#7dd3fc]">
                  First-time setup
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Finish onboarding
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  This wallet needs a username and display name before entering the
                  player dashboard.
                </p>

                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-medium text-slate-200">
                    Username
                    <input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="lowercaseonly"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-200">
                    Display name
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="GameChain Player"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={!sessionUser || profileSaving}
                    className="inline-flex rounded-full bg-[linear-gradient(90deg,#8b5cf6_0%,#38bdf8_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(56,189,248,0.28)] transition hover:scale-[1.02] disabled:opacity-50"
                  >
                    {profileSaving ? "Saving profile..." : "Complete onboarding"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

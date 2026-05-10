"use client";

import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#040612] text-white">
      <Image
        src="/Landing page background.jpeg"
        alt="GameChain background"
        fill
        priority
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.58)_0%,rgba(2,6,23,0.74)_45%,rgba(2,6,23,0.88)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(107,33,168,0.24),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(37,99,235,0.18),transparent_24%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#7dd3fc]">
              GameChain
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Wallet-first tournament identity for players and organizers
            </p>
          </div>

          <Link
            href="/login"
            className="inline-flex rounded-full border border-cyan-300/20 bg-slate-950/55 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-slate-900/70"
          >
            Login
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#7dd3fc]">
              Competitive identity on chain
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-white md:text-7xl">
              Built for players.
              <br />
              Trusted by organizers.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
              GameChain turns wallet identity into a clean tournament login experience.
              Players enter through their own flow, while organizers get a separate
              portal for tournament control, verification, and finalization.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login/player"
                className="inline-flex rounded-full bg-[linear-gradient(90deg,#8b5cf6_0%,#38bdf8_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(56,189,248,0.28)] transition hover:scale-[1.02]"
              >
                Player login
              </Link>
              <Link
                href="/login/organizer"
                className="inline-flex rounded-full border border-cyan-300/20 bg-slate-950/55 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-slate-900/70"
              >
                Organizer login
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="mx-auto w-full max-w-xl rounded-[32px] border border-white/10 bg-slate-950/35 p-5 backdrop-blur">
              <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(76,29,149,0.2),rgba(15,23,42,0.2))] px-4 py-8">
                <Image
                  src="/Logo.jpeg"
                  alt="GameChain logo"
                  width={900}
                  height={900}
                  priority
                  className="mx-auto h-auto w-full max-w-[420px]"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

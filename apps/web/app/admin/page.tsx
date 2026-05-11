"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Shield,
  Users,
  Trophy,
  BadgeCheck,
  Settings,
  Lock,
} from "lucide-react";

const adminActions = [
  {
    title: "Manage Organizers",
    description:
      "Approve, verify, and manage tournament organizers inside GameChain.",
    icon: Users,
    href: "/admin/organizers",
    active: true,
  },
  {
    title: "Tournament Control",
    description: "Create and finalize tournaments across the ecosystem.",
    icon: Trophy,
    active: false,
  },
  {
    title: "Credential Review",
    description: "Review player-issued credentials and attestations.",
    icon: BadgeCheck,
    active: false,
  },
  {
    title: "Trust & Security",
    description: "Monitor issuer trust score and fraud signals.",
    icon: Shield,
    active: false,
  },
  {
    title: "Platform Settings",
    description: "Manage GameChain platform-wide configuration.",
    icon: Settings,
    active: false,
  },
];

export default function AdminHomePage() {
  return (
    <main className="relative h-screen overflow-hidden bg-[#040612] text-white">
      <Image
        src="/Landing page background.jpeg"
        alt="GameChain background"
        fill
        priority
        className="object-cover object-center"
      />

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.58)_0%,rgba(2,6,23,0.74)_45%,rgba(2,6,23,0.88)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(107,33,168,0.24),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(37,99,235,0.18),transparent_24%)]" />

      <div className="relative mx-auto flex h-screen max-w-7xl flex-col overflow-hidden px-6 py-6 lg:py-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#7dd3fc]">
              GameChain Admin
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              Control Center
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              Manage trusted organizers, tournament infrastructure, and platform
              reputation across the GameChain ecosystem.
            </p>
          </div>

          <div className="hidden rounded-full border border-cyan-300/20 bg-slate-950/55 px-5 py-2 text-sm font-semibold text-slate-200 backdrop-blur md:flex">
            Admin Portal
          </div>
        </header>

        <section className="mt-8 grid min-h-0 flex-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="flex min-h-0 flex-col justify-center">
            

            <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
              Admin workflow built for
              <span className="bg-[linear-gradient(90deg,#8b5cf6_0%,#38bdf8_100%)] bg-clip-text text-transparent">
                {" "}
                verified ecosystems
              </span>
            </h2>

            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
              GameChain admins oversee organizer onboarding, issuer trust,
              tournament integrity, and ecosystem-wide verification flows — all
              from one unified dashboard.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/admin/organizers"
                className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#8b5cf6_0%,#38bdf8_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(56,189,248,0.28)] transition hover:scale-[1.02]"
              >
                <Users className="h-4 w-4" />
                Manage Org
              </Link>

              <button
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-white/10 bg-slate-900/40 px-6 py-3 text-sm font-semibold text-slate-500 backdrop-blur"
              >
                <Lock className="h-4 w-4" />
                More features coming soon
              </button>
            </div>
          </div>

          <div className="min-h-0 rounded-[32px] border border-white/10 bg-slate-950/35 p-4 backdrop-blur lg:h-full">
            <div className="flex h-full min-h-0 flex-col rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(76,29,149,0.24),rgba(15,23,42,0.4))] p-5 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
                    System Status
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">
                    Admin Operations
                  </h3>
                </div>

                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Online
                </div>
              </div>

              <div className="mt-6 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {adminActions.map((action) => {
                  const Icon = action.icon;

                  if (action.active) {
                    return (
                      <Link
                        key={action.title}
                        href={action.href!}
                        className="flex items-start gap-4 rounded-2xl border border-cyan-300/10 bg-slate-900/40 p-4 transition hover:border-cyan-300/30 hover:bg-slate-900/60"
                      >
                        <div className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div>
                          <h4 className="font-semibold text-white">
                            {action.title}
                          </h4>

                          <p className="mt-1 text-sm leading-6 text-slate-400">
                            {action.description}
                          </p>
                        </div>
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={action.title}
                      disabled
                      className="flex w-full cursor-not-allowed items-start gap-4 rounded-2xl border border-white/5 bg-slate-900/20 p-4 text-left opacity-60"
                    >
                      <div className="rounded-xl bg-slate-800 p-3 text-slate-500">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-300">
                            {action.title}
                          </h4>

                          <span className="rounded-full border border-white/10 bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                            Locked
                          </span>
                        </div>

                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {action.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

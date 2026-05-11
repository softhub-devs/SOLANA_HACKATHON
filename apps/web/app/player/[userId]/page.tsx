// import Link from "next/link";
// import Image from "next/image";
// import {
//   Trophy,
//   Medal,
//   ShieldCheck,
//   Star,
//   ArrowRight,
// } from "lucide-react";
// import { getPlayerDashboard } from "@/lib/demoIssuer";

// function formatWallet(wallet: string) {
//   if (wallet.length <= 12) return wallet;
//   return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
// }

// function getInitial(value: string) {
//   return value.trim().charAt(0).toUpperCase() || "P";
// }

// export default async function UserProfilePage({
//   params,
// }: {
//   params: Promise<{ userId: string }>;
// }) {
//   const { userId } = await params;
//   const dashboard = await getPlayerDashboard(userId);
//   const achievementCount = dashboard.tournaments.reduce(
//     (count, tournament) => count + tournament.achievements.length,
//     0
//   );
//   const hasCredential = Boolean(dashboard.credential);
//   const profileName = dashboard.playerName ?? formatWallet(dashboard.wallet);

//   const stats = [
//     {
//       label: "Credential Status",
//       value: hasCredential ? "Verified" : "Pending",
//       icon: ShieldCheck,
//     },
//     {
//       label: "Achievements",
//       value: achievementCount.toString(),
//       icon: Trophy,
//     },
//     {
//       label: "Tournaments",
//       value: dashboard.tournaments.length.toString(),
//       icon: Star,
//     },
//   ];

//   return (
//     <main className="relative h-screen overflow-hidden bg-[#040612] text-white">
//       <Image
//         src="/Landing page background.jpeg"
//         alt="GameChain background"
//         fill
//         priority
//         className="object-cover object-center"
//       />

//       <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.58)_0%,rgba(2,6,23,0.74)_45%,rgba(2,6,23,0.88)_100%)]" />
//       <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(107,33,168,0.24),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(37,99,235,0.18),transparent_24%)]" />

//       <div className="relative mx-auto flex h-screen max-w-7xl flex-col overflow-hidden px-6 py-6 lg:py-8">
//         <header className="flex items-center justify-between gap-4">
//           <div>
//             <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#7dd3fc]">
//               GameChain Profile
//             </p>

//             <h1 className="mt-4 text-xl font-semibold tracking-tight md:text-6xl">
//               {profileName}
//             </h1>

//             <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
//               Portable competitive identity powered by verified tournament
//               credentials and organizer-issued reputation.
//             </p>
//           </div>

//           <div className="hidden rounded-full border border-cyan-300/20 bg-slate-950/55 px-5 py-2 text-sm font-semibold text-slate-200 backdrop-blur md:flex">
//             {hasCredential ? "Verified Player" : "Player Profile"}
//           </div>
//         </header>

//         <section className="mt-8 grid min-h-0 flex-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
//           <div className="min-h-0">
//             <div className="flex h-full min-h-0 flex-col rounded-[32px] border border-white/10 bg-slate-950/35 p-6 backdrop-blur">
//               <div className="flex items-center gap-5">
//                 <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-cyan-300/10 bg-[linear-gradient(135deg,#8b5cf6_0%,#38bdf8_100%)] text-3xl font-bold">
//                   {getInitial(profileName)}
//                 </div>

//                 <div>
//                   <h2 className="text-3xl font-semibold">{profileName}</h2>

//                   <p className="mt-2 break-all text-slate-400">
//                     {dashboard.wallet}
//                   </p>

//                   <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
//                     <ShieldCheck className="h-4 w-4" />
//                     {hasCredential ? "Verified Identity" : "Profile Created"}
//                   </div>
//                 </div>
//               </div>

//               <div className="mt-10 grid gap-4 sm:grid-cols-3">
//                 {stats.map((stat) => {
//                   const Icon = stat.icon;

//                   return (
//                     <div
//                       key={stat.label}
//                       className="rounded-2xl border border-white/10 bg-slate-900/40 p-5"
//                     >
//                       <div className="flex items-center justify-between gap-3">
//                         <Icon className="h-5 w-5 text-cyan-300" />

//                         <span className="text-right text-2xl font-semibold">
//                           {stat.value}
//                         </span>
//                       </div>

//                       <p className="mt-4 text-sm text-slate-400">
//                         {stat.label}
//                       </p>
//                     </div>
//                   );
//                 })}
//               </div>

//               <div className="mt-10">
//                 <Link
//                   href={`/${encodeURIComponent(dashboard.wallet)}/achivement`}
//                   className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#8b5cf6_0%,#38bdf8_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(56,189,248,0.28)] transition hover:scale-[1.02]"
//                 >
//                   View Achievements
//                   <ArrowRight className="h-4 w-4" />
//                 </Link>
//               </div>
//             </div>
//           </div>

//           <div className="min-h-0">
//             <div className="flex h-full min-h-0 flex-col rounded-[32px] border border-white/10 bg-slate-950/35 p-5 backdrop-blur">
//             <div className="flex h-full min-h-0 flex-col rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(76,29,149,0.24),rgba(15,23,42,0.4))] p-6">
//               <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
//                 Reputation Overview
//               </p>

//               <h3 className="mt-3 text-3xl font-semibold">
//                 Competitive History
//               </h3>

//               <div className="mt-8 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
//                 <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
//                   <div className="flex items-center gap-3">
//                     <Trophy className="h-5 w-5 text-cyan-300" />

//                     <h4 className="font-semibold">Tournament Participation</h4>
//                   </div>

//                   <p className="mt-3 text-sm leading-7 text-slate-400">
//                     Active across {dashboard.tournaments.length} tracked tournament
//                     {dashboard.tournaments.length === 1 ? "" : "s"} in the current
//                     GameChain profile.
//                   </p>
//                 </div>

//                 <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
//                   <div className="flex items-center gap-3">
//                     <Medal className="h-5 w-5 text-cyan-300" />

//                     <h4 className="font-semibold">Organizer-Issued Credentials</h4>
//                   </div>

//                   <p className="mt-3 text-sm leading-7 text-slate-400">
//                     {hasCredential
//                       ? `Credential type ${dashboard.credential?.credentialType} is active for this player.`
//                       : "No organizer-issued credential has been recorded for this player yet."}
//                   </p>
//                 </div>

//                 <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
//                   <div className="flex items-center gap-3">
//                     <Star className="h-5 w-5 text-cyan-300" />

//                     <h4 className="font-semibold">Portable Reputation</h4>
//                   </div>

//                   <p className="mt-3 text-sm leading-7 text-slate-400">
//                     {achievementCount > 0
//                       ? `${achievementCount} earned achievement${achievementCount === 1 ? "" : "s"} can be carried across tournament experiences.`
//                       : "Achievements will appear here as this player competes and claims badges."}
//                   </p>
//                 </div>
//               </div>
//             </div>
//             </div>
//           </div>
//         </section>
//       </div>
//     </main>
//   );
// }


// app/player/[userId]/page.tsx

import Link from "next/link";
import {
  Trophy,
  Medal,
  ShieldCheck,
  Star,
  ArrowRight,
  Swords,
} from "lucide-react";

import { getPlayerDashboard } from "@/lib/demoIssuer";

function formatWallet(wallet: string) {
  if (wallet.length <= 12) return wallet;

  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function getInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "P";
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const dashboard = await getPlayerDashboard(userId);

  const achievementCount = dashboard.tournaments.reduce(
    (count, tournament) =>
      count + tournament.achievements.length,
    0
  );

  const hasCredential = Boolean(dashboard.credential);

  const profileName =
    dashboard.playerName ??
    formatWallet(dashboard.wallet);

  const stats = [
    {
      label: "Credential Status",
      value: hasCredential
        ? "Verified"
        : "Pending",
      icon: ShieldCheck,
    },
    {
      label: "Achievements",
      value: achievementCount.toString(),
      icon: Trophy,
    },
    {
      label: "Tournaments",
      value:
        dashboard.tournaments.length.toString(),
      icon: Star,
    },
  ];

  return (
    <div className="space-y-8">
      {/* HERO */}
      <section className="overflow-hidden rounded-[34px] ">
        <div className="relative px-8 py-10 md:px-10 md:py-12">
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-12 ">
            {/* LEFT */}
            <div className="flex items-start gap-6">
              <div>

                <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white md:text-5xl">
                  {profileName}
                </h1>

                <p className="mt-4 max-w-2xl break-all text-sm leading-7 text-slate-400 md:text-base">
                  {dashboard.wallet}
                </p>

                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                  Portable competitive identity powered by
                  verified organizer-issued credentials,
                  achievements, and tournament reputation.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={`/player/${encodeURIComponent(
                      userId
                    )}/achievements`}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#8b5cf6_0%,#38bdf8_100%)] px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
                  >
                    View Achievements

                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <button className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07]">
                    Share Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
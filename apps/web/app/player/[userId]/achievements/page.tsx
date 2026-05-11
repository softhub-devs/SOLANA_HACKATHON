import { CalendarClock, Sparkles } from "lucide-react";

import { getPlayerDashboard } from "@/lib/demoIssuer";

export const dynamic = "force-dynamic";

function formatWallet(wallet: string) {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function formatStatus(status: string) {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

export default async function AchievementPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const dashboard = await getPlayerDashboard(userId);
  const participatedTournaments = dashboard.tournaments.filter(
    (tournament) => tournament.registered || tournament.achievements.length > 0
  );
  const achievementCount = participatedTournaments.reduce(
    (count, tournament) => count + tournament.achievements.length,
    0
  );
  const profileName = dashboard.playerName ?? formatWallet(dashboard.wallet);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-slate-950/40 p-6 backdrop-blur md:p-8">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-white">
            Tournament Achievement History
          </h2>
        </div>

        <div className="mt-6 space-y-4">
          {participatedTournaments.length > 0 ? (
            participatedTournaments.map((tournament) => (
            <article
              key={tournament.id}
              className="rounded-3xl border border-white/10 bg-[#0b1120] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {tournament.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {tournament.organizerName} · {formatStatus(tournament.status)}
                  </p>
                </div>

                <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300">
                  {tournament.achievements.length} achievement
                  {tournament.achievements.length === 1 ? "" : "s"}
                </div>
              </div>

              {tournament.achievements.length > 0 ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {tournament.achievements.map((achievement) => (
                    <div
                      key={achievement.publicKey}
                      className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                    >
                      <p
                        className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                          achievement.badgeKind === "winner"
                            ? "text-amber-300"
                            : "text-cyan-300"
                        }`}
                      >
                        {achievement.badgeKind}
                      </p>

                      <p className="mt-2 text-base font-medium text-white">
                        {achievement.badgeLabel}
                      </p>

                      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                        <CalendarClock className="h-3.5 w-3.5" />
                        <span>
                          {new Date(achievement.awardedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-slate-900/40 px-4 py-4">
                  <p className="text-sm text-slate-400">
                    No achievements recorded for this tournament yet.
                  </p>
                </div>
              )}
            </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/40 px-5 py-6">
              <p className="text-sm text-slate-300">
                {profileName} has not participated in any tournaments yet.
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Join a tournament first, then earned badges will show up here.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

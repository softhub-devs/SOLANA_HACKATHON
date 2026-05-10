import { getPlayerDashboard } from "@/lib/demoIssuer";

export const dynamic = "force-dynamic";

function formatWallet(wallet: string) {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export default async function AchievementPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const dashboard = await getPlayerDashboard(userId);
  const tournamentsWithAchievements = dashboard.tournaments.filter(
    (tournament) => tournament.achievements.length > 0
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#18212c_0%,#0f172a_52%,#020617_100%)] px-6 py-10 text-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-[28px] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Player achievements
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-white md:text-5xl">
            Tournament history for {dashboard.playerName ?? formatWallet(dashboard.wallet)}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            This page groups the player&apos;s earned achievements by tournament using
            the stored tournament achievement records from the database.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur">
            <p className="text-sm uppercase tracking-[0.16em] text-slate-400">
              Player wallet
            </p>
            <p className="mt-3 break-all font-mono text-sm text-white">{dashboard.wallet}</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur">
            <p className="text-sm uppercase tracking-[0.16em] text-slate-400">
              Tournaments tracked
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {dashboard.tournaments.length}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur">
            <p className="text-sm uppercase tracking-[0.16em] text-slate-400">
              Database achievements
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {dashboard.tournaments.reduce(
                (count, tournament) => count + tournament.achievements.length,
                0
              )}
            </p>
          </div>
        </section>

        {tournamentsWithAchievements.length > 0 ? (
          <section className="grid gap-5">
            {dashboard.tournaments.map((tournament) => (
              <article
                key={tournament.id}
                className="rounded-[26px] border border-white/10 bg-white/5 p-6 backdrop-blur"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.16em] text-slate-400">
                      Tournament
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {tournament.name}
                    </h2>
                    <p className="mt-2 text-sm text-slate-300">
                      {tournament.organizerName} · {tournament.status.replace("_", " ")}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                    {tournament.achievements.length} achievement
                    {tournament.achievements.length === 1 ? "" : "s"}
                  </span>
                </div>

                {tournament.achievements.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    {tournament.achievements.map((achievement) => (
                      <div
                        key={achievement.publicKey}
                        className="rounded-[18px] border border-white/10 bg-slate-950/50 px-4 py-3"
                      >
                        <p
                          className={`text-xs font-semibold uppercase tracking-[0.14em] ${
                            achievement.badgeKind === "winner"
                              ? "text-amber-300"
                              : "text-cyan-300"
                          }`}
                        >
                          {achievement.badgeKind}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {achievement.badgeLabel}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          {new Date(achievement.awardedAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-slate-300">
                    No achievements recorded for this tournament yet.
                  </p>
                )}
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded-[28px] border border-dashed border-white/15 bg-white/5 p-8 text-sm leading-7 text-slate-300">
            No achievements have been recorded for this player yet. Once tournament
            badges are claimed, they will show up here grouped by tournament.
          </section>
        )}
      </div>
    </main>
  );
}

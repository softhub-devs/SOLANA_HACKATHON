import Link from "next/link";
import {
  getClaimableBadgesForWallet,
  getCredentialByWallet,
} from "@/lib/demoIssuer";
import { getPlayerTournamentBadges } from "@/lib/gamechainOnchain";

export const dynamic = "force-dynamic";

export default async function CredentialPage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  const record = await getCredentialByWallet(wallet);
  const badges = record ? await getPlayerTournamentBadges(wallet).catch(() => []) : [];
  const claimableBadges = record ? await getClaimableBadgesForWallet(wallet) : [];

  if (!record) {
    return (
      <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-50">
        <div className="mx-auto max-w-3xl rounded-[24px] border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-orange-300">
            Credential not found
          </p>
          <h1 className="mt-3 text-3xl font-semibold">No credential on file.</h1>
          <p className="mt-4 text-stone-300">
            Claim a credential first, then return to this page to share it with
            tournament organizers.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full bg-orange-400 px-4 py-2 text-sm font-semibold text-stone-950"
          >
            Back to claim flow
          </Link>
        </div>
      </main>
    );
  }

  const { credential } = record;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#131416_0%,#1f1d19_100%)] px-6 py-10 text-stone-50">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="rounded-[24px] border border-white/10 bg-white/5 p-8">
          <p className="text-sm uppercase tracking-[0.22em] text-orange-300">
            Shareable credential
          </p>
          <h1 className="mt-3 text-4xl font-semibold">
            Multi-game tournament credential
          </h1>
          <p className="mt-4 max-w-2xl text-stone-300">
            This issuer-backed credential is used for tournament gating. It complements
            the app account layer, while Solana tracks tournament entries and awarded
            achievements.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">Credential status</h2>
              <span
                className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200"
              >
                Verified
              </span>
            </div>

            <dl className="mt-6 space-y-4 text-sm text-stone-200">
              <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                <dt>Wallet</dt>
                <dd className="break-all text-right font-mono text-xs">
                  {credential.player}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                <dt>Credential value</dt>
                <dd>{credential.credentialValue}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                <dt>Game ID</dt>
                <dd>{credential.gameId}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                <dt>Game level</dt>
                <dd>{credential.gameLevel}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                <dt>Credential type</dt>
                <dd>Type {credential.credentialType}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                <dt>Issued at</dt>
                <dd>{new Date(credential.issuedAt).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                <dt>Expires at</dt>
                <dd>{new Date(credential.expiresAt).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Issuer</dt>
                <dd>{credential.issuer}</dd>
              </div>
            </dl>
          </div>

          <aside className="rounded-[24px] border border-white/10 bg-orange-300 p-6 text-stone-950">
            <p className="text-sm uppercase tracking-[0.2em] text-stone-700">
              Organizer use
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              Ready for tournament gating
            </h2>
            <p className="mt-4 text-sm leading-6 text-stone-800">
              Organizers can use this credential for verified access checks, then
              rely on Solana-backed tournament and badge records for competitive
              results.
            </p>

            <dl className="mt-6 space-y-3 text-sm text-stone-800">
              <div className="flex justify-between gap-4">
                <dt>Trust model</dt>
                <dd>{credential.trustModel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Metadata URI</dt>
                <dd className="break-all text-right font-mono text-xs">
                  {credential.metadataUri}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Transaction</dt>
                <dd className="break-all text-right font-mono text-xs">
                  {credential.transactionSignature}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/${encodeURIComponent(credential.player)}/achivement`}
                className="inline-flex rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
              >
                View achievements
              </Link>
              <Link
                href={`/organizers/demo?wallet=${encodeURIComponent(credential.player)}`}
                className="inline-flex rounded-full border border-stone-900/10 px-4 py-2 text-sm font-semibold text-stone-900"
              >
                Check in organizer view
              </Link>
              <Link
                href="/"
                className="inline-flex rounded-full border border-stone-900/10 px-4 py-2 text-sm font-semibold text-stone-900"
              >
                Claim another
              </Link>
            </div>
          </aside>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-orange-300">
                On-chain badge history
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                Past tournament badges
              </h2>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-stone-200">
              {badges.length} badge{badges.length === 1 ? "" : "s"}
            </span>
          </div>

          {claimableBadges.length > 0 ? (
            <div className="mt-6 rounded-[20px] border border-orange-300/40 bg-orange-300/10 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-200">
                Claimable via Blink
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {claimableBadges.map((badge) => (
                  <Link
                    key={`${badge.tournamentId}-${badge.badgeKind}`}
                    href={badge.blinkHref}
                    className="inline-flex rounded-full bg-orange-300 px-4 py-2 text-sm font-semibold text-stone-950"
                  >
                    Claim {badge.badgeKind} for {badge.tournamentName}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {badges.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {badges.map((badge) => (
                <div
                  key={badge.publicKey}
                  className="rounded-[20px] border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">
                      {badge.tournamentName}
                    </h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        badge.badgeKind === "winner"
                          ? "bg-emerald-400/15 text-emerald-200"
                          : "bg-cyan-400/15 text-cyan-200"
                      }`}
                    >
                      {badge.badgeKind === "winner" ? "Winner" : "Participant"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-stone-300">{badge.badgeLabel}</p>
                  <dl className="mt-4 space-y-2 text-sm text-stone-200">
                    <div className="flex justify-between gap-4">
                      <dt>Awarded</dt>
                      <dd>{new Date(badge.awardedAt).toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Organizer</dt>
                      <dd className="max-w-[15rem] break-all text-right font-mono text-xs">
                        {badge.organizer}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Badge account</dt>
                      <dd className="max-w-[15rem] break-all text-right font-mono text-xs">
                        {badge.publicKey}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[20px] border border-dashed border-white/15 bg-white/5 p-5 text-sm leading-6 text-stone-300">
              No on-chain tournament badges found for this wallet yet. Once a completed
              tournament is eligible, claim the badge through Blink and it will appear
              here from Solana account data.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

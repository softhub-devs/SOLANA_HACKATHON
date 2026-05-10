import { NextRequest, NextResponse } from "next/server";
import { finalizeTournament } from "@/lib/demoIssuer";
import { requireOrganizerSession } from "@/lib/serverAuth";

const ONCHAIN_MIRROR_ENABLED =
  process.env.ENABLE_GAMECHAIN_ONCHAIN_MIRROR === "true";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tournamentId: string }> }
) {
  const auth = await requireOrganizerSession(request);
  if (auth.error || !auth.session) {
    return auth.error!;
  }

  const { tournamentId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    winnerWallet?: string;
  };
  const result = await finalizeTournament(tournamentId, body.winnerWallet ?? "");

  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }

  if (!ONCHAIN_MIRROR_ENABLED) {
    return NextResponse.json({
      ...result,
      onchain: {
        synced: false,
        skipped: true,
        mode: "db-only",
      },
    });
  }

  try {
    const { mirrorTournamentFinalizeToChain } = await import(
      "@/lib/gamechainOnchain"
    );
    const onchain = await mirrorTournamentFinalizeToChain({
      tournamentId,
      tournamentName: result.tournament.name,
      entryCredentialType: result.tournament.entryCredentialType,
      entryCredentialScopeId: result.tournament.entryCredentialScopeId,
      winnerWallet: result.distribution.winnerWallet,
      playerWallets: result.tournament.registrations.map(
        (registration) => registration.wallet
      ),
    });

    return NextResponse.json({
      ...result,
      onchain: {
        synced: true,
        ...onchain,
      },
    });
  } catch (error) {
    return NextResponse.json({
      ...result,
      onchain: {
        synced: false,
        error:
          error instanceof Error
            ? error.message
            : "On-chain tournament finalization failed.",
      },
    });
  }
}

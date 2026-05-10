import { NextRequest, NextResponse } from "next/server";
import {
  createTournament,
  listTournaments,
  type CreateTournamentRequest,
} from "@/lib/demoIssuer";
import { mirrorTournamentCreateToChain } from "@/lib/gamechainOnchain";
import { requireOrganizerSession } from "@/lib/serverAuth";

export async function GET() {
  return NextResponse.json({ tournaments: await listTournaments() });
}

export async function POST(request: NextRequest) {
  const auth = await requireOrganizerSession(request);
  if (auth.error || !auth.session) {
    return auth.error!;
  }

  const body = (await request.json().catch(() => ({}))) as CreateTournamentRequest;
  const tournament = await createTournament({
    ...body,
    organizerName: auth.session.user.displayName ?? body.organizerName,
    organizerWallet: auth.session.user.walletAddress,
  });

  try {
    const onchain = await mirrorTournamentCreateToChain({
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      entryCredentialType: tournament.entryCredentialType,
      entryCredentialScopeId: tournament.entryCredentialScopeId,
    });

    return NextResponse.json(
      {
        ...tournament,
        onchain: {
          synced: true,
          ...onchain,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ...tournament,
        onchain: {
          synced: false,
          error:
            error instanceof Error
              ? error.message
              : "On-chain tournament creation failed.",
        },
      },
      { status: 201 }
    );
  }
}

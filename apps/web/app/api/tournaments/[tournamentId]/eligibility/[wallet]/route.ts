import { NextRequest, NextResponse } from "next/server";
import { getTournamentEligibilityForTournament } from "@/lib/demoIssuer";
import { requireOrganizerSession } from "@/lib/serverAuth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tournamentId: string; wallet: string }> }
) {
  const auth = await requireOrganizerSession(request);
  if (auth.error || !auth.session) {
    return auth.error!;
  }

  const { tournamentId, wallet } = await context.params;
  const result = await getTournamentEligibilityForTournament(tournamentId, wallet);

  if (!result) {
    return NextResponse.json(
      { error: "Tournament or credential not found for organizer check." },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}

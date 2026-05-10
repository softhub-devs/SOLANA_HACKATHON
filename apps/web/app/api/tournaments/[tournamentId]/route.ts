import { NextResponse } from "next/server";
import { getTournamentById } from "@/lib/demoIssuer";

export async function GET(
  _request: Request,
  context: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await context.params;
  const tournament = await getTournamentById(tournamentId);

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  return NextResponse.json(tournament);
}

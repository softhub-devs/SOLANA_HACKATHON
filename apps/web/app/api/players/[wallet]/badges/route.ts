import { NextResponse } from "next/server";
import { getPlayerTournamentBadges } from "@/lib/gamechainOnchain";

export async function GET(
  _request: Request,
  context: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await context.params;
    const badges = await getPlayerTournamentBadges(wallet);
    return NextResponse.json({ badges });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load on-chain tournament badges.",
      },
      { status: 400 }
    );
  }
}

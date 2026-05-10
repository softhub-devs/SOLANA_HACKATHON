import { NextResponse } from "next/server";
import { getTournamentEligibility } from "@/lib/demoIssuer";

export async function GET(
  _request: Request,
  context: { params: Promise<{ wallet: string }> }
) {
  const { wallet } = await context.params;
  const payload = await getTournamentEligibility(wallet);

  if (!payload) {
    return NextResponse.json(
      { error: "No credential found for organizer check." },
      { status: 404 }
    );
  }

  return NextResponse.json(payload);
}

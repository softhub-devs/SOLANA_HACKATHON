import { NextResponse } from "next/server";
import { getPlayerDashboard } from "@/lib/demoIssuer";

export async function GET(
  _request: Request,
  context: { params: Promise<{ wallet: string }> }
) {
  const { wallet } = await context.params;
  return NextResponse.json(await getPlayerDashboard(wallet));
}

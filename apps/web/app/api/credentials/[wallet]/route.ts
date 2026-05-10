import { NextResponse } from "next/server";
import { getCredentialByWallet } from "@/lib/demoIssuer";

export async function GET(
  _request: Request,
  context: { params: Promise<{ wallet: string }> }
) {
  const { wallet } = await context.params;
  const payload = await getCredentialByWallet(wallet);

  if (!payload) {
    return NextResponse.json(
      { error: "Credential not found for wallet." },
      { status: 404 }
    );
  }

  return NextResponse.json(payload);
}

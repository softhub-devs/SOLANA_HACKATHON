import { NextResponse } from "next/server";
import { getCredentialByType } from "@/lib/demoIssuer";

export async function GET(
  _request: Request,
  context: { params: Promise<{ wallet: string; credentialType: string }> }
) {
  const { wallet, credentialType } = await context.params;
  const credentialTypeNumber = Number(credentialType);
  const payload = await getCredentialByType(wallet, credentialTypeNumber);

  if (!payload) {
    return NextResponse.json(
      { error: "Credential type not found for wallet." },
      { status: 404 }
    );
  }

  return NextResponse.json(payload);
}

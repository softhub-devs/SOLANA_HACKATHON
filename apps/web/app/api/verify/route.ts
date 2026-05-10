import { NextRequest, NextResponse } from "next/server";
import { issueCredential, type VerifyRequest } from "@/lib/demoIssuer";
import { requireAuthenticatedSession } from "@/lib/serverAuth";

const ONCHAIN_MIRROR_ENABLED =
  process.env.ENABLE_GAMECHAIN_ONCHAIN_MIRROR === "true";

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedSession(request);
  if (auth.error || !auth.session) {
    return auth.error!;
  }

  const body = (await request.json().catch(() => ({}))) as VerifyRequest;
  const wallet = body.wallet?.trim();
  if (wallet && wallet !== auth.session.user.walletAddress) {
    return NextResponse.json(
      { error: "Players can only issue credentials for their signed-in wallet." },
      { status: 403 }
    );
  }

  const payload = await issueCredential(
    {
      ...body,
      wallet: auth.session.user.walletAddress,
    },
    {
    baseUrl: request.nextUrl.origin,
    }
  );

  if (!ONCHAIN_MIRROR_ENABLED) {
    return NextResponse.json({
      ...payload,
      onchain: {
        synced: false,
        skipped: true,
        mode: "db-only",
      },
    });
  }

  try {
    const { syncCredentialToChain } = await import("@/lib/gamechainOnchain");
    const signature = await syncCredentialToChain({
      wallet: payload.credential.player,
      credentialInstanceId: payload.credential.credentialInstanceId,
      credentialScopeId: payload.credential.credentialScopeId,
      credentialValue: payload.credential.credentialValue,
      metadataUri: payload.credential.metadataUri,
      expiresAtIso: payload.credential.expiresAt,
    });

    return NextResponse.json({
      ...payload,
      onchain: {
        synced: true,
        signature,
      },
    });
  } catch (error) {
    return NextResponse.json({
      ...payload,
      onchain: {
        synced: false,
        error: error instanceof Error ? error.message : "On-chain credential sync failed.",
      },
    });
  }
}

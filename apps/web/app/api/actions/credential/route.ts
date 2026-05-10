import { NextRequest, NextResponse } from "next/server";
import { getActionMetadata, runAction } from "@/lib/demoIssuer";

export async function GET(request: NextRequest) {
  return NextResponse.json(getActionMetadata(request.nextUrl.origin));
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { wallet?: string };
  return NextResponse.json(
    await runAction(body.wallet, request.nextUrl.origin)
  );
}

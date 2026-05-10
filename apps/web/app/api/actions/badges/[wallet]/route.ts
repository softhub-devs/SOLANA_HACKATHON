import { NextRequest, NextResponse } from "next/server";
import {
  getClaimableBadgesForWallet,
  getTournamentRecordForWallet,
} from "@/lib/demoIssuer";
import {
  claimTournamentBadgesToChain,
  type BadgeClaimKind,
} from "@/lib/gamechainOnchain";

function isBadgeKind(value: string | null): value is BadgeClaimKind {
  return value === "participation" || value === "winner";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ wallet: string }> }
) {
  const { wallet } = await context.params;
  const claimable = await getClaimableBadgesForWallet(wallet, {
    baseUrl: request.nextUrl.origin,
  });
  const tournamentId = request.nextUrl.searchParams.get("tournamentId");
  const badgeKind = request.nextUrl.searchParams.get("badgeKind");
  const filtered = claimable.filter((badge) => {
    if (tournamentId && badge.tournamentId !== tournamentId) {
      return false;
    }

    if (isBadgeKind(badgeKind) && badge.badgeKind !== badgeKind) {
      return false;
    }

    return true;
  });

  return NextResponse.json({
    type: "action",
    icon: `${request.nextUrl.origin}/favicon.ico`,
    title: "GameChain Badge Claim",
    description:
      filtered.length > 0
        ? `Claim ${filtered.length} tournament badge${
            filtered.length === 1 ? "" : "s"
          } for ${wallet} on Solana.`
        : `No completed tournament badges are claimable for ${wallet} yet.`,
    label: filtered.length > 0 ? "Claim badge" : "No badges available",
    links: {
      actions:
        filtered.length > 0
          ? filtered.map((badge) => ({
              label: `Claim ${badge.badgeKind} for ${badge.tournamentName}`,
              href: badge.blinkHref,
            }))
          : [],
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ wallet: string }> }
) {
  const { wallet } = await context.params;
  const tournamentId = request.nextUrl.searchParams.get("tournamentId");
  const badgeKind = request.nextUrl.searchParams.get("badgeKind");

  if (!tournamentId || !isBadgeKind(badgeKind)) {
    return NextResponse.json(
      {
        error:
          "Badge claim requires both tournamentId and badgeKind query parameters.",
      },
      { status: 400 }
    );
  }

  const tournament = await getTournamentRecordForWallet(tournamentId, wallet);
  if (!tournament || tournament.status !== "completed") {
    return NextResponse.json(
      {
        error:
          "This wallet is not registered for a completed tournament with a claimable badge.",
      },
      { status: 404 }
    );
  }

  if (badgeKind === "winner" && tournament.winnerWallet !== wallet) {
    return NextResponse.json(
      { error: "Only the recorded winner can claim the winner badge." },
      { status: 400 }
    );
  }

  try {
    const result = await claimTournamentBadgesToChain({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        entryCredentialType: tournament.entryCredentialType,
        entryCredentialScopeId: tournament.entryCredentialScopeId,
        status: tournament.status,
        winnerWallet: tournament.winnerWallet,
        registrations: tournament.registrations.map((registration) => ({
          wallet: registration.wallet,
          credentialType: registration.credentialType,
          credentialInstanceId: registration.credentialInstanceId,
          credentialScopeId: registration.credentialScopeId,
          credentialValue: registration.credentialValue,
          expiresAt: registration.expiresAt,
        })),
      },
      playerWallet: wallet,
      badgeKinds: [badgeKind],
      baseUrl: request.nextUrl.origin,
    });

    return NextResponse.json({
      type: "completed",
      message:
        result.claimed.length > 0
          ? `Claimed ${badgeKind} badge for ${tournament.name}.`
          : `${badgeKind} badge for ${tournament.name} was already claimed.`,
      signatures: result.signatures,
      claimed: result.claimed,
      alreadyClaimed: result.alreadyClaimed,
      tournamentAddress: result.tournamentAddress,
      links: {
        view: {
          type: "external-link",
          href: `${request.nextUrl.origin}/credentials/${encodeURIComponent(wallet)}`,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to write the badge claim to Solana.",
      },
      { status: 400 }
    );
  }
}

import { env, hasSupabaseConfig } from "./env";

export const CREDENTIAL_TYPE_ELIGIBILITY = 1;
export const DEFAULT_GAME_LEVEL = 1;
export const TRUSTED_ISSUER = "gamechain-trusted-issuer";
export const DEFAULT_TOURNAMENT_ID = "demo-cup";
export const ELIGIBILITY_RULE_LABEL = "Verified player credential required";

export type VerifyRequest = {
  wallet?: string;
  gameId?: string;
  gameLevel?: number;
};

export type VerifiedCredential = {
  credentialType: number;
  credentialValue: string;
  player: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  metadataUri: string;
  transactionSignature: string;
  trustModel: "issuer-backed";
  gameId: string;
  gameLevel: number;
};

export type VerificationResponse = {
  credential: VerifiedCredential;
  organizerDecision: {
    tournamentName: string;
    ruleLabel: string;
    eligible: boolean;
    reason: string;
  };
  blink: {
    label: string;
    href: string;
  };
};

export type CreateTournamentRequest = {
  name?: string;
  organizerName?: string;
  organizerWallet?: string;
  entryCredentialType?: number;
  winnerTokenName?: string;
  participationTokenName?: string;
};

export type TournamentStatus = "open" | "in_progress" | "completed";

export type TournamentSummary = {
  id: string;
  name: string;
  organizerName: string;
  organizerWallet: string;
  entryCredentialType: number;
  entryRuleLabel: string;
  winnerTokenName: string;
  participationTokenName: string;
  status: TournamentStatus;
  participantCount: number;
  createdAt: string;
  completedAt: string | null;
  winnerWallet: string | null;
};

export type TournamentRegistration = {
  wallet: string;
  credentialType: number;
  credentialValue: string;
  issuer: string;
  expiresAt: string;
  registeredAt: string;
};

export type TournamentDetail = TournamentSummary & {
  registrations: TournamentRegistration[];
};

export type TournamentEligibility = {
  tournamentId: string;
  tournamentName: string;
  wallet: string;
  credentialType: number;
  ruleLabel: string;
  eligible: boolean;
  expired: boolean;
  checkedAt: string;
  trustModel: "issuer-backed";
  reason: string;
  credential: VerifiedCredential;
};

export type PlayerTournamentSnapshot = TournamentSummary & {
  registered: boolean;
  registration: TournamentRegistration | null;
  eligibility: TournamentEligibility | null;
  achievements: PlayerTournamentAchievement[];
};

export type PlayerDashboard = {
  wallet: string;
  credential: VerifiedCredential | null;
  shareableCredentialPath: string;
  blinkActionPath: string;
  badgeBlinkActionPath: string;
  claimableBadges: ClaimableBadge[];
  tournaments: PlayerTournamentSnapshot[];
};

export type ClaimableBadge = {
  tournamentId: string;
  tournamentName: string;
  badgeKind: "participation" | "winner";
  badgeLabel: string;
  blinkHref: string;
};

export type PlayerTournamentAchievement = {
  publicKey: string;
  badgeKind: "participation" | "winner";
  badgeLabel: string;
  awardedAt: string;
};

type StoredCredentialRecord = {
  credential: VerifiedCredential;
};

type VerifiedCredentialRow = {
  player_wallet: string;
  credential_type: number;
  credential_value: string;
  issuer: string;
  issued_at: string;
  expires_at: string;
  metadata_uri: string;
  transaction_signature: string;
  trust_model: "issuer-backed";
  game_id: string;
  game_level: number;
};

type TournamentAchievementRow = {
  id: string;
  tournament_id: string;
  wallet: string;
  badge_kind: "participation" | "winner";
  badge_label: string;
  awarded_at: string;
  created_at: string;
};

type TournamentRecord = {
  summary: TournamentSummary;
  registrations: Map<string, TournamentRegistration>;
};

const credentialStore = new Map<string, StoredCredentialRecord>();
const tournamentStore = new Map<string, TournamentRecord>();
const SEEDED_PLAYER_CREDENTIALS = [
  {
    wallet: "demo-wallet",
    gameId: "demo-player-001",
    gameLevel: 13,
  },
  {
    wallet: "33FwT1P8h9rpgfEqRH65zDqHkDpfgkkqTJM6BNKsZb45",
    gameId: "demo-player-001",
    gameLevel: 1,
  },
] as const;

async function credentialDbRequest<T>(
  path: string,
  method: "GET" | "POST",
  options?: { body?: unknown; prefer?: string }
) {
  const response = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: env.supabaseServiceRoleKey!,
      Authorization: `Bearer ${env.supabaseServiceRoleKey!}`,
      Prefer: options?.prefer ?? "return=representation",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Credential database request failed: ${response.status} ${payload}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

function credentialDbQuery(filters: Record<string, string>) {
  const params = new URLSearchParams();
  params.set("select", "*");
  for (const [key, value] of Object.entries(filters)) {
    params.set(key, value);
  }
  return `verified_credentials?${params.toString()}`;
}

function mapCredentialRow(row: VerifiedCredentialRow): StoredCredentialRecord {
  return {
    credential: {
      credentialType: row.credential_type,
      credentialValue: row.credential_value,
      player: row.player_wallet,
      issuer: row.issuer,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
      metadataUri: row.metadata_uri,
      transactionSignature: row.transaction_signature,
      trustModel: row.trust_model,
      gameId: row.game_id,
      gameLevel: row.game_level,
    },
  };
}

async function dbGetCredentialByWallet(wallet: string, credentialType?: number) {
  const filters: Record<string, string> = {
    player_wallet: `eq.${normalizeWallet(wallet)}`,
    order: "issued_at.desc",
    limit: "1",
  };

  if (typeof credentialType === "number") {
    filters.credential_type = `eq.${credentialType}`;
  }

  const rows = await credentialDbRequest<VerifiedCredentialRow[]>(
    credentialDbQuery(filters),
    "GET"
  );
  return rows[0] ? mapCredentialRow(rows[0]) : null;
}

async function dbUpsertCredential(credential: VerifiedCredential) {
  const [row] = await credentialDbRequest<VerifiedCredentialRow[]>(
    "verified_credentials",
    "POST",
    {
      body: {
        player_wallet: credential.player,
        credential_type: credential.credentialType,
        credential_value: credential.credentialValue,
        issuer: credential.issuer,
        issued_at: credential.issuedAt,
        expires_at: credential.expiresAt,
        metadata_uri: credential.metadataUri,
        transaction_signature: credential.transactionSignature,
        trust_model: credential.trustModel,
        game_id: credential.gameId,
        game_level: credential.gameLevel,
      },
      prefer: "resolution=merge-duplicates,return=representation",
    }
  );
  return row ? mapCredentialRow(row) : null;
}

async function dbListAchievementRows(wallet: string) {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("wallet", `eq.${normalizeWallet(wallet)}`);
  params.set("order", "awarded_at.desc");

  return credentialDbRequest<TournamentAchievementRow[]>(
    `tournament_achievements?${params.toString()}`,
    "GET"
  );
}

async function dbUpsertAchievements(
  tournament: TournamentDetail,
  awardedAt: string
) {
  const rows = tournament.registrations.flatMap((registration) => {
    const result: Array<{
      tournament_id: string;
      wallet: string;
      badge_kind: "participation" | "winner";
      badge_label: string;
      awarded_at: string;
    }> = [
      {
        tournament_id: tournament.id,
        wallet: registration.wallet,
        badge_kind: "participation",
        badge_label: tournament.participationTokenName,
        awarded_at: awardedAt,
      },
    ];

    if (walletKey(registration.wallet) === walletKey(tournament.winnerWallet ?? "")) {
      result.push({
        tournament_id: tournament.id,
        wallet: registration.wallet,
        badge_kind: "winner",
        badge_label: tournament.winnerTokenName,
        awarded_at: awardedAt,
      });
    }

    return result;
  });

  if (rows.length === 0) {
    return [];
  }

  return credentialDbRequest<TournamentAchievementRow[]>(
    "tournament_achievements",
    "POST",
    {
      body: rows,
      prefer: "resolution=merge-duplicates,return=representation",
    }
  );
}

function normalizeWallet(wallet?: string) {
  return wallet?.trim() || "demo-wallet";
}

function normalizeGameId(gameId?: string) {
  return gameId?.trim() || "demo-player-001";
}

function normalizeGameLevel(gameLevel?: number) {
  if (typeof gameLevel === "number" && Number.isFinite(gameLevel)) {
    return Math.max(1, Math.floor(gameLevel));
  }

  return DEFAULT_GAME_LEVEL;
}

function walletKey(wallet: string) {
  return wallet.toLowerCase();
}

function tournamentKey(tournamentId: string) {
  return tournamentId.trim().toLowerCase();
}

function fakeSignature(wallet: string, gameLevel: number) {
  const timestamp = Date.now().toString(36);
  const seed = wallet.slice(0, 8).replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `sig_${seed}_${gameLevel}_${timestamp}`;
}

function buildProofUri(wallet: string, baseUrl?: string) {
  const path = `/credentials/${encodeURIComponent(wallet)}`;
  return baseUrl ? `${baseUrl}${path}` : path;
}

function buildBadgeActionPath(
  wallet: string,
  options?: {
    baseUrl?: string;
    tournamentId?: string;
    badgeKind?: "participation" | "winner";
  }
) {
  const path = `/api/actions/badges/${encodeURIComponent(wallet)}`;
  const url = new URL(path, options?.baseUrl ?? "http://localhost");

  if (options?.tournamentId) {
    url.searchParams.set("tournamentId", options.tournamentId);
  }

  if (options?.badgeKind) {
    url.searchParams.set("badgeKind", options.badgeKind);
  }

  return options?.baseUrl ? url.toString() : `${path}${url.search}`;
}

function buildCredentialValue(gameLevel: number, gameId: string): string {
  return `${gameId} · Level ${gameLevel} Verified`;
}

function isEligible() {
  return true;
}

function buildTournamentRuleLabel(entryCredentialType: number) {
  if (entryCredentialType === CREDENTIAL_TYPE_ELIGIBILITY) {
    return ELIGIBILITY_RULE_LABEL;
  }

  return `Credential type ${entryCredentialType} required`;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "tournament";
}

function createTournamentId(name: string) {
  const unique = Math.random().toString(36).slice(2, 8);
  return `${slugify(name)}-${unique}`;
}

function sortRegistrations(registrations: Map<string, TournamentRegistration>) {
  return [...registrations.values()].sort((a, b) =>
    a.registeredAt.localeCompare(b.registeredAt)
  );
}

function toTournamentDetail(record: TournamentRecord): TournamentDetail {
  return {
    ...record.summary,
    registrations: sortRegistrations(record.registrations),
  };
}

function ensureSeedData() {
  for (const seed of SEEDED_PLAYER_CREDENTIALS) {
    if (credentialStore.has(walletKey(seed.wallet))) {
      continue;
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    credentialStore.set(walletKey(seed.wallet), {
      credential: {
        credentialType: CREDENTIAL_TYPE_ELIGIBILITY,
        credentialValue: buildCredentialValue(seed.gameLevel, seed.gameId),
        player: seed.wallet,
        issuer: TRUSTED_ISSUER,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        metadataUri: buildProofUri(seed.wallet, ""),
        transactionSignature: fakeSignature(seed.wallet, seed.gameLevel),
        trustModel: "issuer-backed",
        gameId: seed.gameId,
        gameLevel: seed.gameLevel,
      },
    });
  }

  if (!tournamentStore.has(tournamentKey(DEFAULT_TOURNAMENT_ID))) {
    const now = new Date().toISOString();
    tournamentStore.set(tournamentKey(DEFAULT_TOURNAMENT_ID), {
      summary: {
        id: DEFAULT_TOURNAMENT_ID,
        name: "GameChain Demo Cup",
        organizerName: "GameChain Ops",
        organizerWallet: "organizer-demo-wallet",
        entryCredentialType: CREDENTIAL_TYPE_ELIGIBILITY,
        entryRuleLabel: buildTournamentRuleLabel(CREDENTIAL_TYPE_ELIGIBILITY),
        winnerTokenName: "Demo Cup Winner",
        participationTokenName: "Demo Cup Participant",
        status: "open",
        participantCount: 0,
        createdAt: now,
        completedAt: null,
        winnerWallet: null,
      },
      registrations: new Map<string, TournamentRegistration>(),
    });
  }
}

export async function issueCredential(
  request: VerifyRequest,
  options?: { baseUrl?: string }
): Promise<VerificationResponse> {
  const wallet = normalizeWallet(request.wallet);
  const gameId = normalizeGameId(request.gameId);
  const gameLevel = normalizeGameLevel(request.gameLevel);
  const eligible = isEligible();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const metadataUri = buildProofUri(wallet, options?.baseUrl);

  const credential: VerifiedCredential = {
    credentialType: CREDENTIAL_TYPE_ELIGIBILITY,
    credentialValue: buildCredentialValue(gameLevel, gameId),
    player: wallet,
    issuer: TRUSTED_ISSUER,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    metadataUri,
    transactionSignature: fakeSignature(wallet, gameLevel),
    trustModel: "issuer-backed",
    gameId,
    gameLevel,
  };

  credentialStore.set(walletKey(wallet), { credential });
  if (hasSupabaseConfig()) {
    await dbUpsertCredential(credential).catch(() => null);
  }
  ensureSeedData();

  return {
    credential,
    organizerDecision: {
      tournamentName: "GameChain Demo Cup",
      ruleLabel: ELIGIBILITY_RULE_LABEL,
      eligible,
      reason: "Player has a verified credential and is eligible for tournament entry.",
    },
    blink: {
      label: "Share credential",
      href: metadataUri,
    },
  };
}

export async function getCredentialByWallet(wallet: string) {
  if (hasSupabaseConfig()) {
    try {
      const dbRecord = await dbGetCredentialByWallet(wallet);
      if (dbRecord) {
        return dbRecord;
      }
    } catch {
      // Fall back to in-memory demo data if the DB table is not ready yet.
    }
  }

  ensureSeedData();
  return credentialStore.get(walletKey(normalizeWallet(wallet))) ?? null;
}

export async function getCredentialByType(wallet: string, credentialType: number) {
  if (hasSupabaseConfig()) {
    try {
      const dbRecord = await dbGetCredentialByWallet(wallet, credentialType);
      if (dbRecord) {
        return dbRecord;
      }
    } catch {
      // Fall back to in-memory demo data if the DB table is not ready yet.
    }
  }

  const record = await getCredentialByWallet(wallet);
  if (!record) return null;

  return record.credential.credentialType === credentialType ? record : null;
}

export function listTournaments() {
  ensureSeedData();
  return [...tournamentStore.values()]
    .map((record) => record.summary)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getTournamentById(tournamentId: string) {
  ensureSeedData();
  const record = tournamentStore.get(tournamentKey(tournamentId));
  return record ? toTournamentDetail(record) : null;
}

export function createTournament(request: CreateTournamentRequest) {
  ensureSeedData();

  const name = request.name?.trim() || "Untitled Tournament";
  const entryCredentialType =
    typeof request.entryCredentialType === "number" &&
    Number.isFinite(request.entryCredentialType)
      ? Math.max(1, Math.floor(request.entryCredentialType))
      : CREDENTIAL_TYPE_ELIGIBILITY;

  const summary: TournamentSummary = {
    id: createTournamentId(name),
    name,
    organizerName: request.organizerName?.trim() || "Organizer",
    organizerWallet: normalizeWallet(request.organizerWallet),
    entryCredentialType,
    entryRuleLabel: buildTournamentRuleLabel(entryCredentialType),
    winnerTokenName: request.winnerTokenName?.trim() || `${name} Winner`,
    participationTokenName:
      request.participationTokenName?.trim() || `${name} Participant`,
    status: "open",
    participantCount: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
    winnerWallet: null,
  };

  const record: TournamentRecord = {
    summary,
    registrations: new Map<string, TournamentRegistration>(),
  };

  tournamentStore.set(tournamentKey(summary.id), record);
  return toTournamentDetail(record);
}

export async function getTournamentEligibilityForTournament(
  tournamentId: string,
  wallet: string
) {
  ensureSeedData();
  const tournament = tournamentStore.get(tournamentKey(tournamentId));
  if (!tournament) {
    return null;
  }

  const record = await getCredentialByWallet(wallet);
  if (!record) {
    return null;
  }

  const expired = new Date(record.credential.expiresAt).getTime() < Date.now();
  const eligible =
    record.credential.credentialType === tournament.summary.entryCredentialType &&
    isEligible() &&
    !expired;

  return {
    tournamentId: tournament.summary.id,
    tournamentName: tournament.summary.name,
    wallet: record.credential.player,
    credentialType: record.credential.credentialType,
    ruleLabel: tournament.summary.entryRuleLabel,
    eligible,
    expired,
    checkedAt: new Date().toISOString(),
    trustModel: "issuer-backed" as const,
    reason: eligible
      ? `Credential satisfies ${tournament.summary.entryRuleLabel}.`
      : expired
        ? "Credential exists but has expired."
        : `Player does not satisfy ${tournament.summary.entryRuleLabel}.`,
    credential: record.credential,
  } satisfies TournamentEligibility;
}

export function getTournamentEligibility(wallet: string) {
  return getTournamentEligibilityForTournament(DEFAULT_TOURNAMENT_ID, wallet);
}

export function getClaimableBadgesForWallet(
  wallet: string,
  options?: { baseUrl?: string }
) {
  ensureSeedData();
  const normalizedWallet = normalizeWallet(wallet);

  return [...tournamentStore.values()]
    .flatMap((record) => {
      const registration = record.registrations.get(walletKey(normalizedWallet));
      if (!registration || record.summary.status !== "completed") {
        return [];
      }

      const badges: ClaimableBadge[] = [
        {
          tournamentId: record.summary.id,
          tournamentName: record.summary.name,
          badgeKind: "participation",
          badgeLabel: record.summary.participationTokenName,
          blinkHref: buildBadgeActionPath(normalizedWallet, {
            baseUrl: options?.baseUrl,
            tournamentId: record.summary.id,
            badgeKind: "participation",
          }),
        },
      ];

      if (record.summary.winnerWallet === normalizedWallet) {
        badges.push({
          tournamentId: record.summary.id,
          tournamentName: record.summary.name,
          badgeKind: "winner",
          badgeLabel: record.summary.winnerTokenName,
          blinkHref: buildBadgeActionPath(normalizedWallet, {
            baseUrl: options?.baseUrl,
            tournamentId: record.summary.id,
            badgeKind: "winner",
          }),
        });
      }

      return badges;
    })
    .sort((a, b) => a.tournamentName.localeCompare(b.tournamentName));
}

export async function getPlayerDashboard(wallet: string): Promise<PlayerDashboard> {
  ensureSeedData();
  const normalizedWallet = normalizeWallet(wallet);
  const credentialRecord = await getCredentialByWallet(normalizedWallet);
  const dbAchievements: Array<
    PlayerTournamentAchievement & {
      tournamentId: string;
    }
  > =
    hasSupabaseConfig()
      ? await dbListAchievementRows(normalizedWallet)
          .then((rows) =>
            rows.map((row) => ({
              publicKey: row.id,
              badgeKind: row.badge_kind,
              badgeLabel: row.badge_label,
              awardedAt: row.awarded_at,
              tournamentId: row.tournament_id,
            }))
          )
          .catch(() => [])
      : [];
  const tournaments = await Promise.all(
    [...tournamentStore.values()].map(async (record) => {
      const registration =
        record.registrations.get(walletKey(normalizedWallet)) ?? null;
      const eligibility = credentialRecord
        ? await getTournamentEligibilityForTournament(record.summary.id, normalizedWallet)
        : null;

      return {
        ...record.summary,
        registered: Boolean(registration),
        registration,
        eligibility,
        achievements: dbAchievements
          .filter((achievement) => achievement.tournamentId === record.summary.id)
          .map((achievement) => ({
            publicKey: achievement.publicKey,
            badgeKind: achievement.badgeKind,
            badgeLabel: achievement.badgeLabel,
            awardedAt: achievement.awardedAt,
          })),
      } satisfies PlayerTournamentSnapshot;
    })
  );

  return {
    wallet: normalizedWallet,
    credential: credentialRecord?.credential ?? null,
    shareableCredentialPath: buildProofUri(normalizedWallet),
    blinkActionPath: "/api/actions/credential",
    badgeBlinkActionPath: buildBadgeActionPath(normalizedWallet),
    claimableBadges: getClaimableBadgesForWallet(normalizedWallet),
    tournaments: tournaments.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export function getTournamentRecordForWallet(
  tournamentId: string,
  wallet: string
): TournamentDetail | null {
  ensureSeedData();
  const record = tournamentStore.get(tournamentKey(tournamentId));
  if (!record) return null;

  const normalizedWallet = normalizeWallet(wallet);
  if (!record.registrations.has(walletKey(normalizedWallet))) {
    return null;
  }

  return toTournamentDetail(record);
}

export async function registerPlayerForTournament(
  tournamentId: string,
  wallet: string
) {
  ensureSeedData();
  const record = tournamentStore.get(tournamentKey(tournamentId));
  if (!record) {
    return { error: "Tournament not found." };
  }

  if (record.summary.status === "completed") {
    return { error: "Tournament already completed." };
  }

  const eligibility = await getTournamentEligibilityForTournament(tournamentId, wallet);
  if (!eligibility) {
    return { error: "No credential found for organizer check." };
  }

  if (!eligibility.eligible) {
    return { error: eligibility.reason };
  }

  const registrationKey = walletKey(eligibility.wallet);
  if (!record.registrations.has(registrationKey)) {
    record.registrations.set(registrationKey, {
      wallet: eligibility.wallet,
      credentialType: eligibility.credential.credentialType,
      credentialValue: eligibility.credential.credentialValue,
      issuer: eligibility.credential.issuer,
      expiresAt: eligibility.credential.expiresAt,
      registeredAt: new Date().toISOString(),
    });
    record.summary.participantCount = record.registrations.size;
    if (record.summary.status === "open" && record.summary.participantCount > 0) {
      record.summary.status = "in_progress";
    }
  }

  return {
    tournament: toTournamentDetail(record),
    registration: record.registrations.get(registrationKey)!,
    eligibility,
  };
}

export async function finalizeTournament(tournamentId: string, winnerWallet: string) {
  ensureSeedData();
  const record = tournamentStore.get(tournamentKey(tournamentId));
  if (!record) {
    return { error: "Tournament not found." };
  }

  if (record.summary.status === "completed") {
    return { error: "Tournament already completed." };
  }

  const normalizedWinnerWallet = normalizeWallet(winnerWallet);
  if (!record.registrations.has(walletKey(normalizedWinnerWallet))) {
    return { error: "Winner must be a registered player." };
  }

  record.summary.status = "completed";
  record.summary.winnerWallet = normalizedWinnerWallet;
  record.summary.completedAt = new Date().toISOString();

  const tournament = toTournamentDetail(record);
  if (hasSupabaseConfig()) {
    await dbUpsertAchievements(
      tournament,
      record.summary.completedAt ?? new Date().toISOString()
    ).catch(() => []);
  }

  return {
    tournament,
    distribution: {
      winnerWallet: normalizedWinnerWallet,
      winnerTokenName: record.summary.winnerTokenName,
      participationTokenName: record.summary.participationTokenName,
      participantCount: record.summary.participantCount,
    },
  };
}

export function getActionMetadata(baseUrl?: string) {
  return {
    type: "action",
    icon: `${baseUrl ?? ""}/favicon.ico`,
    title: "GameChain Credential Check",
    description:
      "Verify an issuer-backed player credential for tournament eligibility.",
    label: "Open credential",
    links: {
      actions: [
        {
          label: "View sample credential",
          href: buildProofUri("demo-wallet", baseUrl),
        },
      ],
    },
  };
}

export async function runAction(wallet?: string, baseUrl?: string) {
  const normalizedWallet = normalizeWallet(wallet);
  const existing = await getCredentialByWallet(normalizedWallet);

  return {
    type: "completed",
    message: existing
      ? `Credential found for ${normalizedWallet}.`
      : `No credential found for ${normalizedWallet}.`,
    links: {
      next: {
        type: "post",
        href: `${baseUrl ?? ""}/api/verify`,
      },
      view: {
        type: "external-link",
        href: buildProofUri(normalizedWallet, baseUrl),
      },
    },
  };
}

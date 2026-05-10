import type { OnchainTournamentRecord } from "@/lib/gamechainOnchain";

export const CREDENTIAL_TYPE_ELIGIBILITY = 1;
export const DEFAULT_GAME_LEVEL = 1;
export const TRUSTED_ISSUER = "gamechain-trusted-issuer";
export const ELIGIBILITY_RULE_LABEL = "Verified player credential required";
export const GLOBAL_CREDENTIAL_SCOPE_ID = "0";

export type VerifyRequest = {
  wallet?: string;
  gameId?: string;
  gameLevel?: number;
};

export type VerifiedCredential = {
  credentialType: number;
  credentialInstanceId: string;
  credentialScopeId: string;
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
  entryCredentialScopeId: string;
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
  credentialInstanceId: string;
  credentialScopeId: string;
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
  playerName: string | null;
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

const credentialStore = new Map<string, StoredCredentialRecord[]>();
const tournamentStore = new Map<string, TournamentDetail>();
const TOURNAMENTS_SUPABASE_URL = process.env.SUPABASE_URL?.trim() || "";
const TOURNAMENTS_SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
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

type TournamentRow = {
  id: string;
  name: string;
  organizer_name: string;
  organizer_wallet: string;
  entry_credential_type: number;
  entry_credential_scope_id: string;
  entry_rule_label: string;
  winner_token_name: string;
  participation_token_name: string;
  status: TournamentStatus;
  participant_count: number;
  winner_wallet: string | null;
  created_at: string;
  completed_at: string | null;
};

type TournamentRegistrationRow = {
  tournament_id: string;
  wallet: string;
  credential_type: number;
  credential_instance_id: string;
  credential_scope_id: string;
  credential_value: string;
  issuer: string;
  expires_at: string;
  registered_at: string;
};

type VerifiedCredentialRow = {
  player_wallet: string;
  credential_type: number;
  credential_instance_id: string;
  credential_scope_id: string;
  credential_value: string;
  issuer: string;
  issued_at: string;
  expires_at: string;
  metadata_uri: string;
  transaction_signature: string;
  trust_model: "issuer-backed";
  game_id: string;
  game_level: number;
  created_at: string;
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

type UserProfileRow = {
  wallet_address: string;
  username: string | null;
  display_name: string | null;
};

function normalizeWallet(wallet?: string) {
  return wallet?.trim() || "";
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

function hashToU64String(value: string) {
  let hash = BigInt("1469598103934665603");
  const fnvPrime = BigInt("1099511628211");
  const u64Mod = BigInt("18446744073709551615");
  for (const character of value) {
    hash ^= BigInt(character.charCodeAt(0));
    hash = (hash * fnvPrime) & u64Mod;
  }

  return hash.toString();
}

function fakeSignature(wallet: string, gameLevel: number) {
  const timestamp = Date.now().toString(36);
  const seed = wallet.slice(0, 8).replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `sig_${seed}_${gameLevel}_${timestamp}`;
}

function buildProofUri(wallet: string, baseUrl?: string) {
  const normalizedWallet = wallet || "player-wallet";
  const path = `/credentials/${encodeURIComponent(normalizedWallet)}`;
  return baseUrl ? `${baseUrl}${path}` : path;
}

function buildCredentialMetadataUri(
  wallet: string,
  options?: { baseUrl?: string; tournamentId?: string }
) {
  const normalizedBaseUrl = options?.baseUrl?.trim() || "http://localhost";
  const url = new URL(buildProofUri(wallet), normalizedBaseUrl);

  if (options?.tournamentId) {
    url.searchParams.set("tournamentId", options.tournamentId);
  }

  return options?.baseUrl?.trim() ? url.toString() : `${url.pathname}${url.search}`;
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

function getTournamentCredentialScopeId(tournamentId: string) {
  return hashToU64String(`tournament-scope:${tournamentId.trim().toLowerCase()}`);
}

function createTournamentId() {
  return Date.now().toString();
}

function getCredentialRecords(wallet: string) {
  return credentialStore.get(walletKey(normalizeWallet(wallet))) ?? [];
}

function upsertCredentialRecord(credential: VerifiedCredential) {
  const key = walletKey(credential.player);
  const records = credentialStore.get(key) ?? [];
  const nextRecords = records.filter(
    (record) =>
      record.credential.credentialInstanceId !== credential.credentialInstanceId
  );
  nextRecords.push({ credential });
  nextRecords.sort((a, b) =>
    b.credential.issuedAt.localeCompare(a.credential.issuedAt)
  );
  credentialStore.set(key, nextRecords);
}

function ensureSeedCredentials() {
  for (const seed of SEEDED_PLAYER_CREDENTIALS) {
    const existing = getCredentialRecords(seed.wallet).find(
      (record) =>
        record.credential.credentialType === CREDENTIAL_TYPE_ELIGIBILITY &&
        record.credential.credentialScopeId === GLOBAL_CREDENTIAL_SCOPE_ID
    );

    if (existing) {
      continue;
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const credential: VerifiedCredential = {
      credentialType: CREDENTIAL_TYPE_ELIGIBILITY,
      credentialInstanceId: hashToU64String(
        [
          walletKey(seed.wallet),
          CREDENTIAL_TYPE_ELIGIBILITY,
          GLOBAL_CREDENTIAL_SCOPE_ID,
          seed.gameId,
          seed.gameLevel,
        ].join(":")
      ),
      credentialScopeId: GLOBAL_CREDENTIAL_SCOPE_ID,
      credentialValue: buildCredentialValue(seed.gameLevel, seed.gameId),
      player: seed.wallet,
      issuer: TRUSTED_ISSUER,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      metadataUri: buildCredentialMetadataUri(seed.wallet),
      transactionSignature: fakeSignature(seed.wallet, seed.gameLevel),
      trustModel: "issuer-backed",
      gameId: seed.gameId,
      gameLevel: seed.gameLevel,
    };

    upsertCredentialRecord(credential);
  }
}

function mapCredentialRow(row: VerifiedCredentialRow): StoredCredentialRecord {
  return {
    credential: {
      credentialType: row.credential_type,
      credentialInstanceId: row.credential_instance_id,
      credentialScopeId: row.credential_scope_id,
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

async function dbUpsertCredential(credential: VerifiedCredential) {
  const [created] = await tournamentDbRequest<VerifiedCredentialRow[]>(
    "verified_credentials",
    "POST",
    {
      body: {
        player_wallet: credential.player,
        credential_type: credential.credentialType,
        credential_instance_id: credential.credentialInstanceId,
        credential_scope_id: credential.credentialScopeId,
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
      prefer:
        "resolution=merge-duplicates,return=representation",
    }
  );
  return created;
}

async function dbListCredentialRows(
  wallet: string,
  options?: { credentialType?: number; credentialScopeId?: string }
) {
  const filters: Record<string, string> = {
    player_wallet: `eq.${normalizeWallet(wallet)}`,
    order: "issued_at.desc",
  };

  if (typeof options?.credentialType === "number") {
    filters.credential_type = `eq.${options.credentialType}`;
  }

  if (options?.credentialScopeId) {
    filters.credential_scope_id = `eq.${options.credentialScopeId}`;
  }

  const path = tournamentDbQuery("verified_credentials", filters);
  return tournamentDbRequest<VerifiedCredentialRow[]>(path, "GET");
}

async function dbListAchievementRows(wallet: string) {
  const path = tournamentDbQuery("tournament_achievements", {
    wallet: `eq.${normalizeWallet(wallet)}`,
    order: "awarded_at.desc",
  });
  return tournamentDbRequest<TournamentAchievementRow[]>(path, "GET");
}

async function dbGetUserProfileByWallet(wallet: string) {
  const path = tournamentDbQuery("users", {
    wallet_address: `eq.${normalizeWallet(wallet)}`,
    limit: "1",
  });
  const rows = await tournamentDbRequest<UserProfileRow[]>(path, "GET");
  return rows[0] ?? null;
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

  return tournamentDbRequest<TournamentAchievementRow[]>(
    "tournament_achievements",
    "POST",
    {
      body: rows,
      prefer: "resolution=merge-duplicates,return=representation",
    }
  );
}

function upsertTournamentRecord(tournament: TournamentDetail) {
  tournamentStore.set(tournament.id, tournament);
  return tournament;
}

function hasTournamentDatabase() {
  return Boolean(TOURNAMENTS_SUPABASE_URL && TOURNAMENTS_SUPABASE_SERVICE_ROLE_KEY);
}

async function tournamentDbRequest<T>(
  path: string,
  method: "GET" | "POST" | "PATCH",
  options?: { body?: unknown; prefer?: string }
) {
  const response = await fetch(`${TOURNAMENTS_SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: TOURNAMENTS_SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${TOURNAMENTS_SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: options?.prefer ?? "return=representation",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Tournament database request failed: ${response.status} ${payload}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

function tournamentDbQuery(table: string, filters: Record<string, string>) {
  const params = new URLSearchParams();
  params.set("select", "*");
  for (const [key, value] of Object.entries(filters)) {
    params.set(key, value);
  }
  return `${table}?${params.toString()}`;
}

function mapTournamentRow(row: TournamentRow, registrations: TournamentRegistration[]): TournamentDetail {
  return {
    id: row.id,
    name: row.name,
    organizerName: row.organizer_name,
    organizerWallet: row.organizer_wallet,
    entryCredentialType: row.entry_credential_type,
    entryCredentialScopeId: row.entry_credential_scope_id,
    entryRuleLabel: row.entry_rule_label,
    winnerTokenName: row.winner_token_name,
    participationTokenName: row.participation_token_name,
    status: row.status,
    participantCount: row.participant_count,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    winnerWallet: row.winner_wallet,
    registrations,
  };
}

function mapTournamentRegistrationRow(row: TournamentRegistrationRow): TournamentRegistration {
  return {
    wallet: row.wallet,
    credentialType: row.credential_type,
    credentialInstanceId: row.credential_instance_id,
    credentialScopeId: row.credential_scope_id,
    credentialValue: row.credential_value,
    issuer: row.issuer,
    expiresAt: row.expires_at,
    registeredAt: row.registered_at,
  };
}

async function dbListTournamentRows() {
  const path = tournamentDbQuery("tournaments", { order: "created_at.desc" });
  return tournamentDbRequest<TournamentRow[]>(path, "GET");
}

async function dbListRegistrationRows() {
  const path = tournamentDbQuery("tournament_registrations", { order: "registered_at.asc" });
  return tournamentDbRequest<TournamentRegistrationRow[]>(path, "GET");
}

async function dbGetTournamentRow(tournamentId: string) {
  const path = tournamentDbQuery("tournaments", {
    id: `eq.${tournamentId}`,
    limit: "1",
  });
  const rows = await tournamentDbRequest<TournamentRow[]>(path, "GET");
  return rows[0] ?? null;
}

async function dbGetRegistrationRows(tournamentId: string) {
  const path = tournamentDbQuery("tournament_registrations", {
    tournament_id: `eq.${tournamentId}`,
    order: "registered_at.asc",
  });
  return tournamentDbRequest<TournamentRegistrationRow[]>(path, "GET");
}

async function dbCreateTournament(tournament: TournamentDetail) {
  const [created] = await tournamentDbRequest<TournamentRow[]>("tournaments", "POST", {
    body: {
      id: tournament.id,
      name: tournament.name,
      organizer_name: tournament.organizerName,
      organizer_wallet: tournament.organizerWallet,
      entry_credential_type: tournament.entryCredentialType,
      entry_credential_scope_id: tournament.entryCredentialScopeId,
      entry_rule_label: tournament.entryRuleLabel,
      winner_token_name: tournament.winnerTokenName,
      participation_token_name: tournament.participationTokenName,
      status: tournament.status,
      participant_count: tournament.participantCount,
      winner_wallet: tournament.winnerWallet,
      created_at: tournament.createdAt,
      completed_at: tournament.completedAt,
    },
  });
  return created;
}

async function dbUpsertTournamentDetail(tournament: TournamentDetail) {
  const [updated] = await tournamentDbRequest<TournamentRow[]>(
    `tournaments?id=eq.${tournament.id}`,
    "PATCH",
    {
      body: {
        name: tournament.name,
        organizer_name: tournament.organizerName,
        organizer_wallet: tournament.organizerWallet,
        entry_credential_type: tournament.entryCredentialType,
        entry_credential_scope_id: tournament.entryCredentialScopeId,
        entry_rule_label: tournament.entryRuleLabel,
        winner_token_name: tournament.winnerTokenName,
        participation_token_name: tournament.participationTokenName,
        status: tournament.status,
        participant_count: tournament.registrations.length,
        winner_wallet: tournament.winnerWallet,
        completed_at: tournament.completedAt,
      },
    }
  );
  return updated;
}

async function dbUpsertRegistration(
  tournamentId: string,
  registration: TournamentRegistration
) {
  const existingPath = tournamentDbQuery("tournament_registrations", {
    tournament_id: `eq.${tournamentId}`,
    wallet: `eq.${registration.wallet}`,
    limit: "1",
  });
  const existing = await tournamentDbRequest<TournamentRegistrationRow[]>(existingPath, "GET");

  if (existing[0]) {
    const [updated] = await tournamentDbRequest<TournamentRegistrationRow[]>(
      `tournament_registrations?tournament_id=eq.${tournamentId}&wallet=eq.${encodeURIComponent(
        registration.wallet
      )}`,
      "PATCH",
      {
        body: {
          credential_type: registration.credentialType,
          credential_instance_id: registration.credentialInstanceId,
          credential_scope_id: registration.credentialScopeId,
          credential_value: registration.credentialValue,
          issuer: registration.issuer,
          expires_at: registration.expiresAt,
          registered_at: registration.registeredAt,
        },
      }
    );
    return updated;
  }

  const [created] = await tournamentDbRequest<TournamentRegistrationRow[]>(
    "tournament_registrations",
    "POST",
    {
      body: {
        tournament_id: tournamentId,
        wallet: registration.wallet,
        credential_type: registration.credentialType,
        credential_instance_id: registration.credentialInstanceId,
        credential_scope_id: registration.credentialScopeId,
        credential_value: registration.credentialValue,
        issuer: registration.issuer,
        expires_at: registration.expiresAt,
        registered_at: registration.registeredAt,
      },
    }
  );
  return created;
}

function mergeTournamentDetail(
  local: TournamentDetail | null,
  chain: TournamentDetail | null
): TournamentDetail | null {
  if (local && chain) {
    return {
      ...local,
      organizerWallet: chain.organizerWallet || local.organizerWallet,
      entryCredentialType: chain.entryCredentialType,
      entryCredentialScopeId: chain.entryCredentialScopeId,
      entryRuleLabel: chain.entryRuleLabel,
      status: chain.status,
      participantCount: chain.participantCount,
      createdAt: chain.createdAt,
      completedAt: chain.completedAt,
      winnerWallet: chain.winnerWallet,
      registrations: chain.registrations.length > 0 ? chain.registrations : local.registrations,
    };
  }

  return local ?? chain;
}

function mergeTournamentSummary(
  local: TournamentSummary | null,
  chain: TournamentSummary | null
): TournamentSummary | null {
  if (local && chain) {
    return {
      ...local,
      organizerWallet: chain.organizerWallet || local.organizerWallet,
      entryCredentialType: chain.entryCredentialType,
      entryCredentialScopeId: chain.entryCredentialScopeId,
      entryRuleLabel: chain.entryRuleLabel,
      status: chain.status,
      participantCount: chain.participantCount,
      createdAt: chain.createdAt,
      completedAt: chain.completedAt,
      winnerWallet: chain.winnerWallet,
    };
  }

  return local ?? chain;
}

async function getLatestCredential(
  wallet: string,
  options?: { credentialType?: number; credentialScopeId?: string }
) {
  ensureSeedCredentials();

  if (hasTournamentDatabase()) {
    try {
      const rows = await dbListCredentialRows(wallet, options);
      if (rows[0]) {
        return mapCredentialRow(rows[0]);
      }
    } catch {
      // Fall through to seeded in-memory credentials while DB schema catches up.
    }
  }

  return (
    getCredentialRecords(wallet).find((record) => {
      if (
        typeof options?.credentialType === "number" &&
        record.credential.credentialType !== options.credentialType
      ) {
        return false;
      }

      if (
        options?.credentialScopeId &&
        record.credential.credentialScopeId !== options.credentialScopeId
      ) {
        return false;
      }

      return true;
    }) ?? null
  );
}

function mapChainTournamentSummary(tournament: OnchainTournamentRecord): TournamentSummary {
  return {
    id: tournament.id,
    name: tournament.name,
    organizerName: tournament.organizerName,
    organizerWallet: tournament.organizerWallet,
    entryCredentialType: tournament.entryCredentialType,
    entryCredentialScopeId: tournament.entryCredentialScopeId,
    entryRuleLabel: buildTournamentRuleLabel(tournament.entryCredentialType),
    winnerTokenName: "Winner badge",
    participationTokenName: "Participation badge",
    status: tournament.status,
    participantCount: tournament.participantCount,
    createdAt: tournament.createdAt,
    completedAt: tournament.completedAt,
    winnerWallet: tournament.winnerWallet,
  };
}

function mapChainTournamentDetail(tournament: OnchainTournamentRecord): TournamentDetail {
  return {
    ...mapChainTournamentSummary(tournament),
    registrations: tournament.registrations.map((registration) => ({
      wallet: registration.wallet,
      credentialType: CREDENTIAL_TYPE_ELIGIBILITY,
      credentialInstanceId: "",
      credentialScopeId: tournament.entryCredentialScopeId,
      credentialValue: "Credential verified on-chain",
      issuer: TRUSTED_ISSUER,
      expiresAt: "",
      registeredAt: registration.registeredAt,
    })),
  };
}

async function loadOnchainTournaments() {
  return import("@/lib/gamechainOnchain").then((module) =>
    module.listOnchainTournaments()
  );
}

async function loadOnchainTournament(tournamentId: string) {
  return import("@/lib/gamechainOnchain").then((module) =>
    module.getOnchainTournamentById(tournamentId)
  );
}

async function ensureTournamentScopedCredential(
  tournament: TournamentSummary,
  wallet: string
) {
  const baseRecord = await getCredentialByWallet(wallet);
  if (!baseRecord) {
    return null;
  }

  const scopedRecord = await getLatestCredential(wallet, {
    credentialType: tournament.entryCredentialType,
    credentialScopeId: tournament.entryCredentialScopeId,
  });
  if (scopedRecord) {
    return scopedRecord;
  }

  await issueCredential(
    {
      wallet: baseRecord.credential.player,
      gameId: baseRecord.credential.gameId,
      gameLevel: baseRecord.credential.gameLevel,
    },
    {
      tournamentId: tournament.id,
    }
  );

  return getLatestCredential(wallet, {
    credentialType: tournament.entryCredentialType,
    credentialScopeId: tournament.entryCredentialScopeId,
  });
}

export async function issueCredential(
  request: VerifyRequest,
  options?: { baseUrl?: string; tournamentId?: string }
): Promise<VerificationResponse> {
  const wallet = normalizeWallet(request.wallet);
  const gameId = normalizeGameId(request.gameId);
  const gameLevel = normalizeGameLevel(request.gameLevel);
  const eligible = isEligible();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const credentialScopeId = options?.tournamentId
    ? getTournamentCredentialScopeId(options.tournamentId)
    : GLOBAL_CREDENTIAL_SCOPE_ID;
  const metadataUri = buildCredentialMetadataUri(wallet, options);

  const credential: VerifiedCredential = {
    credentialType: CREDENTIAL_TYPE_ELIGIBILITY,
    credentialInstanceId: hashToU64String(
      [
        walletKey(wallet),
        CREDENTIAL_TYPE_ELIGIBILITY,
        credentialScopeId,
        gameId,
        gameLevel,
      ].join(":")
    ),
    credentialScopeId,
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

  upsertCredentialRecord(credential);
  if (hasTournamentDatabase()) {
    await dbUpsertCredential(credential).catch(() => null);
  }

  return {
    credential,
    organizerDecision: {
      tournamentName: options?.tournamentId ?? "GameChain tournament",
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
  return getLatestCredential(wallet, {
    credentialType: CREDENTIAL_TYPE_ELIGIBILITY,
    credentialScopeId: GLOBAL_CREDENTIAL_SCOPE_ID,
  });
}

export async function getCredentialByType(wallet: string, credentialType: number) {
  return getLatestCredential(wallet, {
    credentialType,
    credentialScopeId: GLOBAL_CREDENTIAL_SCOPE_ID,
  });
}

export async function listTournaments() {
  if (hasTournamentDatabase()) {
    const [rows, registrationRows] = await Promise.all([
      dbListTournamentRows(),
      dbListRegistrationRows(),
    ]);
    const registrationsByTournament = new Map<string, TournamentRegistration[]>();

    for (const row of registrationRows) {
      const list = registrationsByTournament.get(row.tournament_id) ?? [];
      list.push(mapTournamentRegistrationRow(row));
      registrationsByTournament.set(row.tournament_id, list);
    }

    return rows.map((row) =>
      mapTournamentRow(row, registrationsByTournament.get(row.id) ?? [])
    );
  }

  const chainSummaries = (await loadOnchainTournaments()).map(mapChainTournamentSummary);
  const localSummaries = [...tournamentStore.values()].map((tournament) => ({
    id: tournament.id,
    name: tournament.name,
    organizerName: tournament.organizerName,
    organizerWallet: tournament.organizerWallet,
    entryCredentialType: tournament.entryCredentialType,
    entryCredentialScopeId: tournament.entryCredentialScopeId,
    entryRuleLabel: tournament.entryRuleLabel,
    winnerTokenName: tournament.winnerTokenName,
    participationTokenName: tournament.participationTokenName,
    status: tournament.status,
    participantCount: tournament.registrations.length,
    createdAt: tournament.createdAt,
    completedAt: tournament.completedAt,
    winnerWallet: tournament.winnerWallet,
  }));

  const byId = new Map<string, TournamentSummary>();

  for (const local of localSummaries) {
    byId.set(local.id, local);
  }

  for (const chain of chainSummaries) {
    byId.set(chain.id, mergeTournamentSummary(byId.get(chain.id) ?? null, chain)!);
  }

  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTournamentById(tournamentId: string) {
  if (hasTournamentDatabase()) {
    const row = await dbGetTournamentRow(tournamentId);
    if (!row) {
      return null;
    }

    const registrationRows = await dbGetRegistrationRows(tournamentId);
    return mapTournamentRow(
      row,
      registrationRows.map(mapTournamentRegistrationRow)
    );
  }

  const local = tournamentStore.get(tournamentId) ?? null;
  const chain = await loadOnchainTournament(tournamentId).then((tournament) =>
    tournament ? mapChainTournamentDetail(tournament) : null
  );
  return mergeTournamentDetail(local, chain);
}

export async function createTournament(
  request: CreateTournamentRequest
): Promise<TournamentDetail> {
  const name = request.name?.trim() || "Untitled Tournament";
  const entryCredentialType =
    typeof request.entryCredentialType === "number" &&
    Number.isFinite(request.entryCredentialType)
      ? Math.max(1, Math.floor(request.entryCredentialType))
      : CREDENTIAL_TYPE_ELIGIBILITY;
  const id = createTournamentId();

  const tournament = upsertTournamentRecord({
    id,
    name,
    organizerName: request.organizerName?.trim() || "Organizer",
    organizerWallet: normalizeWallet(request.organizerWallet),
    entryCredentialType,
    entryCredentialScopeId: getTournamentCredentialScopeId(id),
    entryRuleLabel: buildTournamentRuleLabel(entryCredentialType),
    winnerTokenName: request.winnerTokenName?.trim() || "Winner badge",
    participationTokenName:
      request.participationTokenName?.trim() || "Participation badge",
    status: "open",
    participantCount: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
    winnerWallet: null,
    registrations: [],
  });

  if (hasTournamentDatabase()) {
    await dbCreateTournament(tournament);
  }

  return tournament;
}

export async function getTournamentEligibilityForTournament(
  tournamentId: string,
  wallet: string
) {
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) {
    return null;
  }

  const record = await ensureTournamentScopedCredential(tournament, wallet);
  if (!record) {
    return null;
  }

  const expired = new Date(record.credential.expiresAt).getTime() < Date.now();
  const eligible =
    record.credential.credentialType === tournament.entryCredentialType &&
    record.credential.credentialScopeId === tournament.entryCredentialScopeId &&
    isEligible() &&
    !expired;

  return {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    wallet: record.credential.player,
    credentialType: record.credential.credentialType,
    ruleLabel: tournament.entryRuleLabel,
    eligible,
    expired,
    checkedAt: new Date().toISOString(),
    trustModel: "issuer-backed" as const,
    reason: eligible
      ? `Credential satisfies ${tournament.entryRuleLabel}.`
      : expired
        ? "Credential exists but has expired."
        : `Player does not satisfy ${tournament.entryRuleLabel}.`,
    credential: record.credential,
  } satisfies TournamentEligibility;
}

export async function getTournamentEligibility(wallet: string) {
  const tournaments = await listTournaments();
  const firstTournament = tournaments[0];
  if (!firstTournament) {
    return null;
  }

  return getTournamentEligibilityForTournament(firstTournament.id, wallet);
}

export async function getClaimableBadgesForWallet(
  wallet: string,
  options?: { baseUrl?: string }
) {
  const normalizedWallet = normalizeWallet(wallet);
  const tournaments = await loadOnchainTournaments();

  return tournaments
    .flatMap((record) => {
      const registration = record.registrations.find(
        (entry) => walletKey(entry.wallet) === walletKey(normalizedWallet)
      );
      if (!registration || record.status !== "completed") {
        return [];
      }

      const badges: ClaimableBadge[] = [
        {
          tournamentId: record.id,
          tournamentName: record.name,
          badgeKind: "participation",
          badgeLabel: "Participation badge",
          blinkHref: buildBadgeActionPath(normalizedWallet, {
            baseUrl: options?.baseUrl,
            tournamentId: record.id,
            badgeKind: "participation",
          }),
        },
      ];

      if (record.winnerWallet === normalizedWallet) {
        badges.push({
          tournamentId: record.id,
          tournamentName: record.name,
          badgeKind: "winner",
          badgeLabel: "Winner badge",
          blinkHref: buildBadgeActionPath(normalizedWallet, {
            baseUrl: options?.baseUrl,
            tournamentId: record.id,
            badgeKind: "winner",
          }),
        });
      }

      return badges;
    })
    .sort((a, b) => a.tournamentName.localeCompare(b.tournamentName));
}

export async function getPlayerDashboard(wallet: string): Promise<PlayerDashboard> {
  const normalizedWallet = normalizeWallet(wallet);
  const credentialRecord = await getCredentialByWallet(normalizedWallet);
  const tournaments = await listTournaments();
  const userProfile = hasTournamentDatabase()
    ? await dbGetUserProfileByWallet(normalizedWallet).catch(() => null)
    : null;
  const dbAchievements: Array<
    PlayerTournamentAchievement & {
      tournamentName: string;
    }
  > =
    hasTournamentDatabase()
      ? await dbListAchievementRows(normalizedWallet)
          .then((rows) =>
            rows.map((row) => ({
              publicKey: row.id,
              badgeKind: row.badge_kind,
              badgeLabel: row.badge_label,
              awardedAt: row.awarded_at,
              tournamentName:
                tournaments.find((tournament) => tournament.id === row.tournament_id)?.name ??
                row.tournament_id,
            }))
          )
        .catch(() => [])
      : [];

  return {
    wallet: normalizedWallet,
    playerName: userProfile?.display_name ?? userProfile?.username ?? null,
    credential: credentialRecord?.credential ?? null,
    shareableCredentialPath: buildProofUri(normalizedWallet),
    blinkActionPath: "/api/actions/credential",
    badgeBlinkActionPath: buildBadgeActionPath(normalizedWallet),
    claimableBadges: await getClaimableBadgesForWallet(normalizedWallet),
    tournaments: await Promise.all(
      tournaments.map(async (record) => {
        const detail = await getTournamentById(record.id);
        const registration =
          detail?.registrations.find(
            (entry) => walletKey(entry.wallet) === walletKey(normalizedWallet)
          ) ?? null;
        const eligibility = credentialRecord
          ? await getTournamentEligibilityForTournament(record.id, normalizedWallet)
          : null;
        const achievements = dbAchievements
          .filter((badge) => badge.tournamentName === record.name)
          .map((badge) => ({
            publicKey: badge.publicKey,
            badgeKind: badge.badgeKind,
            badgeLabel: badge.badgeLabel,
            awardedAt: badge.awardedAt,
          }));

        return {
          ...record,
          registered: Boolean(registration),
          registration,
          eligibility,
          achievements,
        } satisfies PlayerTournamentSnapshot;
      })
    ),
  };
}

export async function getTournamentRecordForWallet(
  tournamentId: string,
  wallet: string
): Promise<TournamentDetail | null> {
  const record = await getTournamentById(tournamentId);
  if (!record) return null;

  const normalizedWallet = normalizeWallet(wallet);
  if (!record.registrations.some((entry) => walletKey(entry.wallet) === walletKey(normalizedWallet))) {
    return null;
  }

  return record;
}

export async function registerPlayerForTournament(
  tournamentId: string,
  wallet: string
) {
  const record = await getTournamentById(tournamentId);
  if (!record) {
    return { error: "Tournament not found." };
  }

  if (record.status === "completed") {
    return { error: "Tournament already completed." };
  }

  const eligibility = await getTournamentEligibilityForTournament(tournamentId, wallet);
  if (!eligibility) {
    return { error: "No credential found for organizer check." };
  }

  if (!eligibility.eligible) {
    return { error: eligibility.reason };
  }

  const registration: TournamentRegistration = {
    wallet: eligibility.wallet,
    credentialType: eligibility.credential.credentialType,
    credentialInstanceId: eligibility.credential.credentialInstanceId,
    credentialScopeId: eligibility.credential.credentialScopeId,
    credentialValue: eligibility.credential.credentialValue,
    issuer: eligibility.credential.issuer,
    expiresAt: eligibility.credential.expiresAt,
    registeredAt: new Date().toISOString(),
  };

  const nextTournament = {
    ...record,
    status:
      record.registrations.length > 0 ||
      record.status === "in_progress"
        ? record.status
        : ("in_progress" as const),
    participantCount: record.registrations.some(
      (entry) => walletKey(entry.wallet) === walletKey(eligibility.wallet)
    )
      ? record.registrations.length
      : record.registrations.length + 1,
    registrations: record.registrations.some(
      (entry) => walletKey(entry.wallet) === walletKey(eligibility.wallet)
    )
      ? record.registrations
      : [...record.registrations, registration],
  } satisfies TournamentDetail;

  upsertTournamentRecord(nextTournament);
  if (hasTournamentDatabase()) {
    await dbUpsertRegistration(tournamentId, registration);
    await dbUpsertTournamentDetail(nextTournament);
  }

  return {
    tournament: nextTournament,
    registration,
    eligibility,
  };
}

export async function finalizeTournament(tournamentId: string, winnerWallet: string) {
  const record = await getTournamentById(tournamentId);
  if (!record) {
    return { error: "Tournament not found." };
  }

  if (record.status === "completed") {
    return { error: "Tournament already completed." };
  }

  const normalizedWinnerWallet = normalizeWallet(winnerWallet);
  if (!record.registrations.some((entry) => walletKey(entry.wallet) === walletKey(normalizedWinnerWallet))) {
    return { error: "Winner must be a registered player." };
  }

  const nextTournament = {
    ...record,
    status: "completed" as const,
    participantCount: record.registrations.length,
    winnerWallet: normalizedWinnerWallet,
    completedAt: new Date().toISOString(),
  } satisfies TournamentDetail;

  upsertTournamentRecord(nextTournament);
  if (hasTournamentDatabase()) {
    await dbUpsertTournamentDetail(nextTournament);
    await dbUpsertAchievements(
      nextTournament,
      nextTournament.completedAt ?? new Date().toISOString()
    ).catch(() => []);
  }

  return {
    tournament: nextTournament,
    distribution: {
      winnerWallet: normalizedWinnerWallet,
      winnerTokenName: nextTournament.winnerTokenName,
      participationTokenName: nextTournament.participationTokenName,
      participantCount: nextTournament.participantCount,
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
          label: "View credential format",
          href: buildProofUri("", baseUrl),
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
      : `No credential found for ${normalizedWallet || "this wallet"}.`,
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

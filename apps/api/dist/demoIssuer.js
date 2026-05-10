"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ELIGIBILITY_RULE_LABEL = exports.DEFAULT_TOURNAMENT_ID = exports.TRUSTED_ISSUER = exports.DEFAULT_GAME_LEVEL = exports.CREDENTIAL_TYPE_ELIGIBILITY = void 0;
exports.issueCredential = issueCredential;
exports.getCredentialByWallet = getCredentialByWallet;
exports.getCredentialByType = getCredentialByType;
exports.listTournaments = listTournaments;
exports.getTournamentById = getTournamentById;
exports.createTournament = createTournament;
exports.getTournamentEligibilityForTournament = getTournamentEligibilityForTournament;
exports.getTournamentEligibility = getTournamentEligibility;
exports.getClaimableBadgesForWallet = getClaimableBadgesForWallet;
exports.getPlayerDashboard = getPlayerDashboard;
exports.getTournamentRecordForWallet = getTournamentRecordForWallet;
exports.registerPlayerForTournament = registerPlayerForTournament;
exports.finalizeTournament = finalizeTournament;
exports.getActionMetadata = getActionMetadata;
exports.runAction = runAction;
const env_1 = require("./env");
exports.CREDENTIAL_TYPE_ELIGIBILITY = 1;
exports.DEFAULT_GAME_LEVEL = 1;
exports.TRUSTED_ISSUER = "gamechain-trusted-issuer";
exports.DEFAULT_TOURNAMENT_ID = "demo-cup";
exports.ELIGIBILITY_RULE_LABEL = "Verified player credential required";
const credentialStore = new Map();
const tournamentStore = new Map();
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
];
async function credentialDbRequest(path, method, options) {
    const response = await fetch(`${env_1.env.supabaseUrl}/rest/v1/${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            apikey: env_1.env.supabaseServiceRoleKey,
            Authorization: `Bearer ${env_1.env.supabaseServiceRoleKey}`,
            Prefer: options?.prefer ?? "return=representation",
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
        const payload = await response.text();
        throw new Error(`Credential database request failed: ${response.status} ${payload}`);
    }
    if (response.status === 204) {
        return null;
    }
    return (await response.json());
}
function credentialDbQuery(filters) {
    const params = new URLSearchParams();
    params.set("select", "*");
    for (const [key, value] of Object.entries(filters)) {
        params.set(key, value);
    }
    return `verified_credentials?${params.toString()}`;
}
function mapCredentialRow(row) {
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
async function dbGetCredentialByWallet(wallet, credentialType) {
    const filters = {
        player_wallet: `eq.${normalizeWallet(wallet)}`,
        order: "issued_at.desc",
        limit: "1",
    };
    if (typeof credentialType === "number") {
        filters.credential_type = `eq.${credentialType}`;
    }
    const rows = await credentialDbRequest(credentialDbQuery(filters), "GET");
    return rows[0] ? mapCredentialRow(rows[0]) : null;
}
async function dbUpsertCredential(credential) {
    const [row] = await credentialDbRequest("verified_credentials", "POST", {
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
    });
    return row ? mapCredentialRow(row) : null;
}
async function dbListAchievementRows(wallet) {
    const params = new URLSearchParams();
    params.set("select", "*");
    params.set("wallet", `eq.${normalizeWallet(wallet)}`);
    params.set("order", "awarded_at.desc");
    return credentialDbRequest(`tournament_achievements?${params.toString()}`, "GET");
}
async function dbUpsertAchievements(tournament, awardedAt) {
    const rows = tournament.registrations.flatMap((registration) => {
        const result = [
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
    return credentialDbRequest("tournament_achievements", "POST", {
        body: rows,
        prefer: "resolution=merge-duplicates,return=representation",
    });
}
function normalizeWallet(wallet) {
    return wallet?.trim() || "demo-wallet";
}
function normalizeGameId(gameId) {
    return gameId?.trim() || "demo-player-001";
}
function normalizeGameLevel(gameLevel) {
    if (typeof gameLevel === "number" && Number.isFinite(gameLevel)) {
        return Math.max(1, Math.floor(gameLevel));
    }
    return exports.DEFAULT_GAME_LEVEL;
}
function walletKey(wallet) {
    return wallet.toLowerCase();
}
function tournamentKey(tournamentId) {
    return tournamentId.trim().toLowerCase();
}
function fakeSignature(wallet, gameLevel) {
    const timestamp = Date.now().toString(36);
    const seed = wallet.slice(0, 8).replace(/[^a-z0-9]/gi, "").toLowerCase();
    return `sig_${seed}_${gameLevel}_${timestamp}`;
}
function buildProofUri(wallet, baseUrl) {
    const path = `/credentials/${encodeURIComponent(wallet)}`;
    return baseUrl ? `${baseUrl}${path}` : path;
}
function buildBadgeActionPath(wallet, options) {
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
function buildCredentialValue(gameLevel, gameId) {
    return `${gameId} · Level ${gameLevel} Verified`;
}
function isEligible() {
    return true;
}
function buildTournamentRuleLabel(entryCredentialType) {
    if (entryCredentialType === exports.CREDENTIAL_TYPE_ELIGIBILITY) {
        return exports.ELIGIBILITY_RULE_LABEL;
    }
    return `Credential type ${entryCredentialType} required`;
}
function slugify(value) {
    const slug = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug || "tournament";
}
function createTournamentId(name) {
    const unique = Math.random().toString(36).slice(2, 8);
    return `${slugify(name)}-${unique}`;
}
function sortRegistrations(registrations) {
    return [...registrations.values()].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));
}
function toTournamentDetail(record) {
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
                credentialType: exports.CREDENTIAL_TYPE_ELIGIBILITY,
                credentialValue: buildCredentialValue(seed.gameLevel, seed.gameId),
                player: seed.wallet,
                issuer: exports.TRUSTED_ISSUER,
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
    if (!tournamentStore.has(tournamentKey(exports.DEFAULT_TOURNAMENT_ID))) {
        const now = new Date().toISOString();
        tournamentStore.set(tournamentKey(exports.DEFAULT_TOURNAMENT_ID), {
            summary: {
                id: exports.DEFAULT_TOURNAMENT_ID,
                name: "GameChain Demo Cup",
                organizerName: "GameChain Ops",
                organizerWallet: "organizer-demo-wallet",
                entryCredentialType: exports.CREDENTIAL_TYPE_ELIGIBILITY,
                entryRuleLabel: buildTournamentRuleLabel(exports.CREDENTIAL_TYPE_ELIGIBILITY),
                winnerTokenName: "Demo Cup Winner",
                participationTokenName: "Demo Cup Participant",
                status: "open",
                participantCount: 0,
                createdAt: now,
                completedAt: null,
                winnerWallet: null,
            },
            registrations: new Map(),
        });
    }
}
async function issueCredential(request, options) {
    const wallet = normalizeWallet(request.wallet);
    const gameId = normalizeGameId(request.gameId);
    const gameLevel = normalizeGameLevel(request.gameLevel);
    const eligible = isEligible();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const metadataUri = buildProofUri(wallet, options?.baseUrl);
    const credential = {
        credentialType: exports.CREDENTIAL_TYPE_ELIGIBILITY,
        credentialValue: buildCredentialValue(gameLevel, gameId),
        player: wallet,
        issuer: exports.TRUSTED_ISSUER,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        metadataUri,
        transactionSignature: fakeSignature(wallet, gameLevel),
        trustModel: "issuer-backed",
        gameId,
        gameLevel,
    };
    credentialStore.set(walletKey(wallet), { credential });
    if ((0, env_1.hasSupabaseConfig)()) {
        await dbUpsertCredential(credential).catch(() => null);
    }
    ensureSeedData();
    return {
        credential,
        organizerDecision: {
            tournamentName: "GameChain Demo Cup",
            ruleLabel: exports.ELIGIBILITY_RULE_LABEL,
            eligible,
            reason: "Player has a verified credential and is eligible for tournament entry.",
        },
        blink: {
            label: "Share credential",
            href: metadataUri,
        },
    };
}
async function getCredentialByWallet(wallet) {
    if ((0, env_1.hasSupabaseConfig)()) {
        try {
            const dbRecord = await dbGetCredentialByWallet(wallet);
            if (dbRecord) {
                return dbRecord;
            }
        }
        catch {
            // Fall back to in-memory demo data if the DB table is not ready yet.
        }
    }
    ensureSeedData();
    return credentialStore.get(walletKey(normalizeWallet(wallet))) ?? null;
}
async function getCredentialByType(wallet, credentialType) {
    if ((0, env_1.hasSupabaseConfig)()) {
        try {
            const dbRecord = await dbGetCredentialByWallet(wallet, credentialType);
            if (dbRecord) {
                return dbRecord;
            }
        }
        catch {
            // Fall back to in-memory demo data if the DB table is not ready yet.
        }
    }
    const record = await getCredentialByWallet(wallet);
    if (!record)
        return null;
    return record.credential.credentialType === credentialType ? record : null;
}
function listTournaments() {
    ensureSeedData();
    return [...tournamentStore.values()]
        .map((record) => record.summary)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function getTournamentById(tournamentId) {
    ensureSeedData();
    const record = tournamentStore.get(tournamentKey(tournamentId));
    return record ? toTournamentDetail(record) : null;
}
function createTournament(request) {
    ensureSeedData();
    const name = request.name?.trim() || "Untitled Tournament";
    const entryCredentialType = typeof request.entryCredentialType === "number" &&
        Number.isFinite(request.entryCredentialType)
        ? Math.max(1, Math.floor(request.entryCredentialType))
        : exports.CREDENTIAL_TYPE_ELIGIBILITY;
    const summary = {
        id: createTournamentId(name),
        name,
        organizerName: request.organizerName?.trim() || "Organizer",
        organizerWallet: normalizeWallet(request.organizerWallet),
        entryCredentialType,
        entryRuleLabel: buildTournamentRuleLabel(entryCredentialType),
        winnerTokenName: request.winnerTokenName?.trim() || `${name} Winner`,
        participationTokenName: request.participationTokenName?.trim() || `${name} Participant`,
        status: "open",
        participantCount: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
        winnerWallet: null,
    };
    const record = {
        summary,
        registrations: new Map(),
    };
    tournamentStore.set(tournamentKey(summary.id), record);
    return toTournamentDetail(record);
}
async function getTournamentEligibilityForTournament(tournamentId, wallet) {
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
    const eligible = record.credential.credentialType === tournament.summary.entryCredentialType &&
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
        trustModel: "issuer-backed",
        reason: eligible
            ? `Credential satisfies ${tournament.summary.entryRuleLabel}.`
            : expired
                ? "Credential exists but has expired."
                : `Player does not satisfy ${tournament.summary.entryRuleLabel}.`,
        credential: record.credential,
    };
}
function getTournamentEligibility(wallet) {
    return getTournamentEligibilityForTournament(exports.DEFAULT_TOURNAMENT_ID, wallet);
}
function getClaimableBadgesForWallet(wallet, options) {
    ensureSeedData();
    const normalizedWallet = normalizeWallet(wallet);
    return [...tournamentStore.values()]
        .flatMap((record) => {
        const registration = record.registrations.get(walletKey(normalizedWallet));
        if (!registration || record.summary.status !== "completed") {
            return [];
        }
        const badges = [
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
async function getPlayerDashboard(wallet) {
    ensureSeedData();
    const normalizedWallet = normalizeWallet(wallet);
    const credentialRecord = await getCredentialByWallet(normalizedWallet);
    const dbAchievements = (0, env_1.hasSupabaseConfig)()
        ? await dbListAchievementRows(normalizedWallet)
            .then((rows) => rows.map((row) => ({
            publicKey: row.id,
            badgeKind: row.badge_kind,
            badgeLabel: row.badge_label,
            awardedAt: row.awarded_at,
            tournamentId: row.tournament_id,
        })))
            .catch(() => [])
        : [];
    const tournaments = await Promise.all([...tournamentStore.values()].map(async (record) => {
        const registration = record.registrations.get(walletKey(normalizedWallet)) ?? null;
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
        };
    }));
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
function getTournamentRecordForWallet(tournamentId, wallet) {
    ensureSeedData();
    const record = tournamentStore.get(tournamentKey(tournamentId));
    if (!record)
        return null;
    const normalizedWallet = normalizeWallet(wallet);
    if (!record.registrations.has(walletKey(normalizedWallet))) {
        return null;
    }
    return toTournamentDetail(record);
}
async function registerPlayerForTournament(tournamentId, wallet) {
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
        registration: record.registrations.get(registrationKey),
        eligibility,
    };
}
async function finalizeTournament(tournamentId, winnerWallet) {
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
    if ((0, env_1.hasSupabaseConfig)()) {
        await dbUpsertAchievements(tournament, record.summary.completedAt ?? new Date().toISOString()).catch(() => []);
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
function getActionMetadata(baseUrl) {
    return {
        type: "action",
        icon: `${baseUrl ?? ""}/favicon.ico`,
        title: "GameChain Credential Check",
        description: "Verify an issuer-backed player credential for tournament eligibility.",
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
async function runAction(wallet, baseUrl) {
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

import { createHash } from "crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const programId = process.env.NEXT_PUBLIC_GAMECHAIN_PROGRAM_ID;

if (!programId) {
  throw new Error("Missing NEXT_PUBLIC_GAMECHAIN_PROGRAM_ID");
}

export const GAMECHAIN_PROGRAM_ID = new PublicKey(programId);

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const ISSUER_REGISTRY_SEED = "issuer-registry";
const ISSUER_PROFILE_SEED = "issuer";
const VERIFIED_CREDENTIAL_SEED = "credential";
const TOURNAMENT_STATE_SEED = "tournament";
const TOURNAMENT_PARTICIPANT_SEED = "tournament-participant";
const PLAYER_TOURNAMENT_BADGE_SEED = "player-tournament-badge";
const CREDENTIAL_TYPE_ELIGIBILITY = 1;
const TOURNAMENT_BADGE_PARTICIPATION = 0;
const TOURNAMENT_BADGE_WINNER = 1;
const DEFAULT_TOKEN_MINT = new PublicKey("11111111111111111111111111111111");
const TOURNAMENT_STATE_DISCRIMINATOR = Buffer.from([
  193, 199, 179, 35, 83, 193, 7, 35,
]);
const TOURNAMENT_PARTICIPANT_DISCRIMINATOR = Buffer.from([
  211, 109, 9, 32, 139, 14, 117, 21,
]);
const PLAYER_TOURNAMENT_BADGE_DISCRIMINATOR = Buffer.from([
  3, 156, 113, 222, 52, 113, 97, 219,
]);

export type OnchainTournamentRegistration = {
  wallet: string;
  registeredAt: string;
};

export type OnchainTournamentRecord = {
  id: string;
  publicKey: string;
  organizerWallet: string;
  organizerName: string;
  name: string;
  entryCredentialType: number;
  entryCredentialScopeId: string;
  winnerTokenMint: string;
  participationTokenMint: string;
  status: "open" | "in_progress" | "completed";
  winnerWallet: string | null;
  participantCount: number;
  createdAt: string;
  completedAt: string | null;
  registrations: OnchainTournamentRegistration[];
};

export type OnchainBadgeRecord = {
  publicKey: string;
  player: string;
  tournament: string;
  organizer: string;
  badgeKind: "participation" | "winner";
  badgeLabel: string;
  tokenMint: string;
  tournamentName: string;
  awardedAt: string;
};

export type BadgeClaimKind = "participation" | "winner";

export type ClaimBadgeInput = {
  tournament: {
    id: string;
    name: string;
    entryCredentialType: number;
    entryCredentialScopeId: string;
    status: "open" | "in_progress" | "completed";
    winnerWallet: string | null;
    registrations: Array<{
      wallet: string;
      credentialType: number;
      credentialInstanceId: string;
      credentialScopeId: string;
      credentialValue: string;
      expiresAt: string;
    }>;
  };
  playerWallet: string;
  badgeKinds: BadgeClaimKind[];
  baseUrl?: string;
};

type TournamentMirrorInput = {
  tournamentId: string;
  tournamentName: string;
  entryCredentialType: number;
  entryCredentialScopeId: string;
};

type RegistrationMirrorInput = TournamentMirrorInput & {
  playerWallet: string;
  credentialInstanceId: string;
};

type FinalizeMirrorInput = TournamentMirrorInput & {
  winnerWallet: string;
  playerWallets: string[];
};

let sharedConnection: Connection | null = null;

function connection() {
  if (!sharedConnection) {
    sharedConnection = new Connection(RPC_ENDPOINT, "confirmed");
  }

  return sharedConnection;
}

function discriminator(name: string) {
  return createHash("sha256")
    .update(name)
    .digest()
    .subarray(0, 8);
}

function encodeU8(value: number) {
  return Buffer.from([value & 0xff]);
}

function encodeU32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value, 0);
  return buffer;
}

function encodeU64(value: bigint) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value, 0);
  return buffer;
}

function readU64(buffer: Buffer, offset: number) {
  return { value: buffer.readBigUInt64LE(offset), offset: offset + 8 };
}

function encodeI64(value: bigint) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64LE(value, 0);
  return buffer;
}

function encodeString(value: string) {
  const bytes = Buffer.from(value, "utf8");
  return Buffer.concat([encodeU32(bytes.length), bytes]);
}

function encodePubkey(value: PublicKey) {
  return value.toBuffer();
}

function encodeInstruction(name: string, parts: Buffer[]) {
  return Buffer.concat([discriminator(`global:${name}`), ...parts]);
}

function deriveNumericTournamentId(tournamentId: string) {
  const normalized = tournamentId.trim();
  if (/^\d+$/.test(normalized)) {
    return BigInt(normalized);
  }
  const hash = createHash("sha256").update(tournamentId).digest();
  return hash.readBigUInt64LE(0);
}

function parseU64String(value: string) {
  return BigInt(value);
}

function deriveIssuerRegistryPda() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ISSUER_REGISTRY_SEED)],
    GAMECHAIN_PROGRAM_ID
  )[0];
}

function deriveIssuerProfilePda(authority: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ISSUER_PROFILE_SEED), authority.toBuffer()],
    GAMECHAIN_PROGRAM_ID
  )[0];
}

function deriveCredentialPda(
  player: PublicKey,
  issuer: PublicKey,
  credentialType: number,
  credentialInstanceId: bigint
) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(VERIFIED_CREDENTIAL_SEED),
      player.toBuffer(),
      issuer.toBuffer(),
      Buffer.from([credentialType]),
      encodeU64(credentialInstanceId),
    ],
    GAMECHAIN_PROGRAM_ID
  )[0];
}

function deriveTournamentPda(organizer: PublicKey, tournamentId: string) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(TOURNAMENT_STATE_SEED),
      organizer.toBuffer(),
      encodeU64(deriveNumericTournamentId(tournamentId)),
    ],
    GAMECHAIN_PROGRAM_ID
  )[0];
}

function deriveParticipantPda(tournament: PublicKey, player: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(TOURNAMENT_PARTICIPANT_SEED),
      tournament.toBuffer(),
      player.toBuffer(),
    ],
    GAMECHAIN_PROGRAM_ID
  )[0];
}

function deriveBadgePda(tournament: PublicKey, player: PublicKey, badgeKind: number) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(PLAYER_TOURNAMENT_BADGE_SEED),
      tournament.toBuffer(),
      player.toBuffer(),
      Buffer.from([badgeKind]),
    ],
    GAMECHAIN_PROGRAM_ID
  )[0];
}

function readU8(buffer: Buffer, offset: number) {
  return { value: buffer.readUInt8(offset), offset: offset + 1 };
}

function readU32(buffer: Buffer, offset: number) {
  return { value: buffer.readUInt32LE(offset), offset: offset + 4 };
}

function readI64(buffer: Buffer, offset: number) {
  return { value: buffer.readBigInt64LE(offset), offset: offset + 8 };
}

function readPubkey(buffer: Buffer, offset: number) {
  return {
    value: new PublicKey(buffer.subarray(offset, offset + 32)),
    offset: offset + 32,
  };
}

function readString(buffer: Buffer, offset: number) {
  const { value: length, offset: nextOffset } = readU32(buffer, offset);
  const start = nextOffset;
  const end = start + length;
  return {
    value: buffer.subarray(start, end).toString("utf8"),
    offset: end,
  };
}

function parseSecretKey(secret: string) {
  const parsed = JSON.parse(secret) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(parsed));
}

function getServerAuthority() {
  const secret =
    process.env.GAMECHAIN_SERVER_SECRET_KEY ??
    process.env.GAMECHAIN_ADMIN_SECRET_KEY ??
    "";

  if (!secret.trim()) {
    return null;
  }

  return parseSecretKey(secret);
}

async function sendInstructions(instructions: TransactionInstruction[]) {
  const signer = getServerAuthority();
  if (!signer) {
    throw new Error(
      "Missing GAMECHAIN_SERVER_SECRET_KEY or GAMECHAIN_ADMIN_SECRET_KEY for on-chain writes."
    );
  }

  const rpc = connection();
  const latestBlockhash = await rpc.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: signer.publicKey,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  }).add(...instructions);

  transaction.sign(signer);
  const signature = await rpc.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await rpc.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed"
  );
  return signature;
}

async function ensureIssuerSetup() {
  const signer = getServerAuthority();
  if (!signer) {
    throw new Error(
      "Missing GAMECHAIN_SERVER_SECRET_KEY or GAMECHAIN_ADMIN_SECRET_KEY for on-chain writes."
    );
  }

  const rpc = connection();
  const issuerRegistry = deriveIssuerRegistryPda();
  const issuerProfile = deriveIssuerProfilePda(signer.publicKey);
  const registryAccount = await rpc.getAccountInfo(issuerRegistry, "confirmed");
  const profileAccount = await rpc.getAccountInfo(issuerProfile, "confirmed");
  const instructions: TransactionInstruction[] = [];

  if (!registryAccount) {
    instructions.push(
      new TransactionInstruction({
        programId: GAMECHAIN_PROGRAM_ID,
        keys: [
          { pubkey: signer.publicKey, isSigner: true, isWritable: true },
          { pubkey: issuerRegistry, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: encodeInstruction("initialize_registry", []),
      })
    );
  }

  if (!profileAccount) {
    instructions.push(
      new TransactionInstruction({
        programId: GAMECHAIN_PROGRAM_ID,
        keys: [
          { pubkey: signer.publicKey, isSigner: true, isWritable: true },
          { pubkey: issuerRegistry, isSigner: false, isWritable: true },
          { pubkey: signer.publicKey, isSigner: false, isWritable: false },
          { pubkey: issuerProfile, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: encodeInstruction("authorize_issuer", [
          encodeString(process.env.GAMECHAIN_ISSUER_NAME ?? "GameChain Server"),
        ]),
      })
    );
  }

  if (instructions.length > 0) {
    await sendInstructions(instructions);
  }

  return { signer, issuerRegistry, issuerProfile };
}

async function ensureCredentialMirrorForRegistration(input: {
  playerWallet: string;
  credentialType: number;
  credentialInstanceId: string;
  credentialScopeId: string;
  credentialValue: string;
  expiresAtIso: string;
  baseUrl?: string;
}) {
  const { signer, issuerRegistry, issuerProfile } = await ensureIssuerSetup();
  const player = new PublicKey(input.playerWallet);
  const credentialInstanceId = parseU64String(input.credentialInstanceId);
  const credentialScopeId = parseU64String(input.credentialScopeId);
  const credentialPda = deriveCredentialPda(
    player,
    signer.publicKey,
    input.credentialType,
    credentialInstanceId
  );
  const existing = await connection().getAccountInfo(credentialPda, "confirmed");

  if (existing) {
    return { signature: null, credentialAddress: credentialPda.toBase58() };
  }

  const metadataUri = `${
    input.baseUrl ?? ""
  }/credentials/${encodeURIComponent(input.playerWallet)}`;

  const signature = await sendInstructions([
    new TransactionInstruction({
      programId: GAMECHAIN_PROGRAM_ID,
      keys: [
        { pubkey: signer.publicKey, isSigner: true, isWritable: true },
        { pubkey: issuerRegistry, isSigner: false, isWritable: false },
        { pubkey: issuerProfile, isSigner: false, isWritable: false },
        { pubkey: player, isSigner: false, isWritable: false },
        { pubkey: credentialPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: encodeInstruction("issue_credential", [
        encodeU8(input.credentialType),
        encodeU64(credentialInstanceId),
        encodeU64(credentialScopeId),
        encodeString(input.credentialValue),
        encodeString(metadataUri),
        encodeI64(BigInt(Math.floor(new Date(input.expiresAtIso).getTime() / 1000))),
      ]),
    }),
  ]);

  return { signature, credentialAddress: credentialPda.toBase58() };
}

export async function syncCredentialToChain(input: {
  wallet: string;
  credentialInstanceId: string;
  credentialScopeId: string;
  credentialValue: string;
  metadataUri: string;
  expiresAtIso: string;
}) {
  const { signer, issuerRegistry, issuerProfile } = await ensureIssuerSetup();
  const player = new PublicKey(input.wallet);
  const credentialInstanceId = parseU64String(input.credentialInstanceId);
  const credentialScopeId = parseU64String(input.credentialScopeId);
  const credentialPda = deriveCredentialPda(
    player,
    signer.publicKey,
    CREDENTIAL_TYPE_ELIGIBILITY,
    credentialInstanceId
  );

  const existing = await connection().getAccountInfo(credentialPda, "confirmed");
  if (existing) {
    return null;
  }

  return sendInstructions([
    new TransactionInstruction({
      programId: GAMECHAIN_PROGRAM_ID,
      keys: [
        { pubkey: signer.publicKey, isSigner: true, isWritable: true },
        { pubkey: issuerRegistry, isSigner: false, isWritable: false },
        { pubkey: issuerProfile, isSigner: false, isWritable: false },
        { pubkey: player, isSigner: false, isWritable: false },
        { pubkey: credentialPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: encodeInstruction("issue_credential", [
        encodeU8(CREDENTIAL_TYPE_ELIGIBILITY),
        encodeU64(credentialInstanceId),
        encodeU64(credentialScopeId),
        encodeString(input.credentialValue),
        encodeString(input.metadataUri),
        encodeI64(BigInt(Math.floor(new Date(input.expiresAtIso).getTime() / 1000))),
      ]),
    }),
  ]);
}

export async function mirrorTournamentCreateToChain(input: TournamentMirrorInput) {
  const { signer } = await ensureIssuerSetup();
  const tournamentState = deriveTournamentPda(signer.publicKey, input.tournamentId);
  const existing = await connection().getAccountInfo(tournamentState, "confirmed");
  if (existing) {
    return { signature: null, tournamentAddress: tournamentState.toBase58() };
  }

  const signature = await sendInstructions([
    new TransactionInstruction({
      programId: GAMECHAIN_PROGRAM_ID,
      keys: [
        { pubkey: signer.publicKey, isSigner: true, isWritable: true },
        { pubkey: tournamentState, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: encodeInstruction("create_tournament", [
        encodeU64(deriveNumericTournamentId(input.tournamentId)),
        encodeString(input.tournamentName),
        encodeU8(input.entryCredentialType),
        encodeU64(parseU64String(input.entryCredentialScopeId)),
        encodePubkey(DEFAULT_TOKEN_MINT),
        encodePubkey(DEFAULT_TOKEN_MINT),
      ]),
    }),
  ]);

  return { signature, tournamentAddress: tournamentState.toBase58() };
}

export async function mirrorTournamentRegistrationToChain(
  input: RegistrationMirrorInput
) {
  const { signer, issuerProfile } = await ensureIssuerSetup();
  const tournamentState = deriveTournamentPda(signer.publicKey, input.tournamentId);
  const player = new PublicKey(input.playerWallet);
  const credentialPda = deriveCredentialPda(
    player,
    signer.publicKey,
    input.entryCredentialType,
    parseU64String(input.credentialInstanceId)
  );
  const tournamentParticipant = deriveParticipantPda(tournamentState, player);
  const existing = await connection().getAccountInfo(tournamentParticipant, "confirmed");
  if (existing) {
    return { signature: null, participantAddress: tournamentParticipant.toBase58() };
  }

  const signature = await sendInstructions([
    new TransactionInstruction({
      programId: GAMECHAIN_PROGRAM_ID,
      keys: [
        { pubkey: signer.publicKey, isSigner: true, isWritable: true },
        { pubkey: player, isSigner: false, isWritable: false },
        { pubkey: tournamentState, isSigner: false, isWritable: true },
        { pubkey: credentialPda, isSigner: false, isWritable: false },
        { pubkey: issuerProfile, isSigner: false, isWritable: false },
        { pubkey: tournamentParticipant, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: encodeInstruction("register_player", []),
    }),
  ]);

  return { signature, participantAddress: tournamentParticipant.toBase58() };
}

export async function mirrorTournamentFinalizeToChain(input: FinalizeMirrorInput) {
  const { signer } = await ensureIssuerSetup();
  const tournamentState = deriveTournamentPda(signer.publicKey, input.tournamentId);
  const winner = new PublicKey(input.winnerWallet);
  const winnerParticipant = deriveParticipantPda(tournamentState, winner);
  const signatures: string[] = [];

  signatures.push(
    await sendInstructions([
      new TransactionInstruction({
        programId: GAMECHAIN_PROGRAM_ID,
        keys: [
          { pubkey: signer.publicKey, isSigner: true, isWritable: true },
          { pubkey: tournamentState, isSigner: false, isWritable: true },
          { pubkey: winnerParticipant, isSigner: false, isWritable: false },
        ],
        data: encodeInstruction("finalize_tournament", [encodePubkey(winner)]),
      }),
    ])
  );

  for (const playerWallet of input.playerWallets) {
    const player = new PublicKey(playerWallet);
    const participant = deriveParticipantPda(tournamentState, player);
    const participationBadge = deriveBadgePda(
      tournamentState,
      player,
      TOURNAMENT_BADGE_PARTICIPATION
    );
    const participationExists = await connection().getAccountInfo(
      participationBadge,
      "confirmed"
    );

    if (!participationExists) {
      signatures.push(
        await sendInstructions([
          new TransactionInstruction({
            programId: GAMECHAIN_PROGRAM_ID,
            keys: [
              { pubkey: signer.publicKey, isSigner: true, isWritable: true },
              { pubkey: tournamentState, isSigner: false, isWritable: true },
              { pubkey: player, isSigner: false, isWritable: false },
              { pubkey: participant, isSigner: false, isWritable: false },
              { pubkey: participationBadge, isSigner: false, isWritable: true },
              { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            data: encodeInstruction("record_tournament_badge", [
              encodeU8(TOURNAMENT_BADGE_PARTICIPATION),
              encodeString("Participant"),
            ]),
          }),
        ])
      );
    }

    if (player.equals(winner)) {
      const winnerBadge = deriveBadgePda(
        tournamentState,
        player,
        TOURNAMENT_BADGE_WINNER
      );
      const winnerExists = await connection().getAccountInfo(winnerBadge, "confirmed");
      if (!winnerExists) {
        signatures.push(
          await sendInstructions([
            new TransactionInstruction({
              programId: GAMECHAIN_PROGRAM_ID,
              keys: [
                { pubkey: signer.publicKey, isSigner: true, isWritable: true },
                { pubkey: tournamentState, isSigner: false, isWritable: true },
                { pubkey: player, isSigner: false, isWritable: false },
                { pubkey: participant, isSigner: false, isWritable: false },
                { pubkey: winnerBadge, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
              ],
              data: encodeInstruction("record_tournament_badge", [
                encodeU8(TOURNAMENT_BADGE_WINNER),
                encodeString("Winner"),
              ]),
            }),
          ])
        );
      }
    }
  }

  return {
    signatures,
    tournamentAddress: tournamentState.toBase58(),
  };
}

export async function claimTournamentBadgesToChain(input: ClaimBadgeInput) {
  const normalizedBadgeKinds = [...new Set(input.badgeKinds)];
  const { signer } = await ensureIssuerSetup();
  const tournamentState = deriveTournamentPda(signer.publicKey, input.tournament.id);
  const signatures: string[] = [];
  const claimed: Array<{ badgeKind: BadgeClaimKind; badgeAddress: string }> = [];
  const alreadyClaimed: BadgeClaimKind[] = [];

  const tournamentAccount = await connection().getAccountInfo(tournamentState, "confirmed");
  if (!tournamentAccount) {
    const createResult = await mirrorTournamentCreateToChain({
      tournamentId: input.tournament.id,
      tournamentName: input.tournament.name,
      entryCredentialType: input.tournament.entryCredentialType,
      entryCredentialScopeId: input.tournament.entryCredentialScopeId,
    });

    if (createResult.signature) {
      signatures.push(createResult.signature);
    }
  }

  for (const registration of input.tournament.registrations) {
    await ensureCredentialMirrorForRegistration({
      playerWallet: registration.wallet,
      credentialType: registration.credentialType,
      credentialInstanceId: registration.credentialInstanceId,
      credentialScopeId: registration.credentialScopeId,
      credentialValue: registration.credentialValue,
      expiresAtIso: registration.expiresAt,
      baseUrl: input.baseUrl,
    });

    const participantResult = await mirrorTournamentRegistrationToChain({
      tournamentId: input.tournament.id,
      tournamentName: input.tournament.name,
      entryCredentialType: registration.credentialType,
      entryCredentialScopeId: input.tournament.entryCredentialScopeId,
      playerWallet: registration.wallet,
      credentialInstanceId: registration.credentialInstanceId,
    });

    if (participantResult.signature) {
      signatures.push(participantResult.signature);
    }
  }

  if (input.tournament.status === "completed" && input.tournament.winnerWallet) {
    try {
      const finalizeResult = await mirrorTournamentFinalizeToChain({
        tournamentId: input.tournament.id,
        tournamentName: input.tournament.name,
        entryCredentialType: input.tournament.entryCredentialType,
        entryCredentialScopeId: input.tournament.entryCredentialScopeId,
        winnerWallet: input.tournament.winnerWallet,
        playerWallets: [],
      });

      signatures.push(...finalizeResult.signatures);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("already completed")) {
        throw error;
      }
    }
  }

  const player = new PublicKey(input.playerWallet);
  const participant = deriveParticipantPda(tournamentState, player);

  for (const badgeKind of normalizedBadgeKinds) {
    const badgeKindValue =
      badgeKind === "winner" ? TOURNAMENT_BADGE_WINNER : TOURNAMENT_BADGE_PARTICIPATION;
    const badgeAddress = deriveBadgePda(tournamentState, player, badgeKindValue);
    const existing = await connection().getAccountInfo(badgeAddress, "confirmed");

    if (existing) {
      alreadyClaimed.push(badgeKind);
      continue;
    }

    const label = badgeKind === "winner" ? "Winner" : "Participant";
    const signature = await sendInstructions([
      new TransactionInstruction({
        programId: GAMECHAIN_PROGRAM_ID,
        keys: [
          { pubkey: signer.publicKey, isSigner: true, isWritable: true },
          { pubkey: tournamentState, isSigner: false, isWritable: true },
          { pubkey: player, isSigner: false, isWritable: false },
          { pubkey: participant, isSigner: false, isWritable: false },
          { pubkey: badgeAddress, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: encodeInstruction("record_tournament_badge", [
          encodeU8(badgeKindValue),
          encodeString(label),
        ]),
      }),
    ]);

    signatures.push(signature);
    claimed.push({
      badgeKind,
      badgeAddress: badgeAddress.toBase58(),
    });
  }

  return {
    tournamentAddress: tournamentState.toBase58(),
    signatures,
    claimed,
    alreadyClaimed,
  };
}

export async function getPlayerTournamentBadges(wallet: string) {
  const player = new PublicKey(wallet);
  const accounts = await connection().getProgramAccounts(GAMECHAIN_PROGRAM_ID, {
    filters: [
      { dataSize: 250 },
      {
        memcmp: {
          offset: 8,
          bytes: player.toBase58(),
        },
      },
    ],
  });

  return accounts
    .filter((account) =>
      account.account.data.subarray(0, 8).equals(PLAYER_TOURNAMENT_BADGE_DISCRIMINATOR)
    )
    .map((account) => decodePlayerTournamentBadge(account.pubkey, account.account.data))
    .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt));
}

export async function listOnchainTournaments() {
  const tournamentAccounts = await connection().getProgramAccounts(GAMECHAIN_PROGRAM_ID, {
    filters: [{ dataSize: 244 }],
  });
  const participantAccounts = await connection().getProgramAccounts(
    GAMECHAIN_PROGRAM_ID,
    {
      filters: [{ dataSize: 82 }],
    }
  );

  const participantsByTournament = new Map<string, OnchainTournamentRegistration[]>();
  for (const account of participantAccounts) {
    if (
      !account.account.data
        .subarray(0, 8)
        .equals(TOURNAMENT_PARTICIPANT_DISCRIMINATOR)
    ) {
      continue;
    }

    const participant = decodeTournamentParticipant(account.account.data);
    const list = participantsByTournament.get(participant.tournament) ?? [];
    list.push({
      wallet: participant.playerWallet,
      registeredAt: participant.registeredAt,
    });
    participantsByTournament.set(participant.tournament, list);
  }

  return tournamentAccounts
    .filter((account) =>
      account.account.data.subarray(0, 8).equals(TOURNAMENT_STATE_DISCRIMINATOR)
    )
    .map((account) => decodeTournamentState(account.pubkey, account.account.data))
    .map((tournament) => ({
      ...tournament,
      registrations: (participantsByTournament.get(tournament.publicKey) ?? []).sort(
        (a, b) => a.registeredAt.localeCompare(b.registeredAt)
      ),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOnchainTournamentById(tournamentId: string) {
  const tournaments = await listOnchainTournaments();
  return tournaments.find((tournament) => tournament.id === tournamentId) ?? null;
}

function decodePlayerTournamentBadge(publicKey: PublicKey, data: Buffer): OnchainBadgeRecord {
  let offset = 8;
  const player = readPubkey(data, offset);
  offset = player.offset;
  const tournament = readPubkey(data, offset);
  offset = tournament.offset;
  const organizer = readPubkey(data, offset);
  offset = organizer.offset;
  const badgeKind = readU8(data, offset);
  offset = badgeKind.offset;
  const badgeLabel = readString(data, offset);
  offset = badgeLabel.offset;
  const tokenMint = readPubkey(data, offset);
  offset = tokenMint.offset;
  const tournamentName = readString(data, offset);
  offset = tournamentName.offset;
  const awardedAt = readI64(data, offset);

  return {
    publicKey: publicKey.toBase58(),
    player: player.value.toBase58(),
    tournament: tournament.value.toBase58(),
    organizer: organizer.value.toBase58(),
    badgeKind: badgeKind.value === TOURNAMENT_BADGE_WINNER ? "winner" : "participation",
    badgeLabel: badgeLabel.value,
    tokenMint: tokenMint.value.toBase58(),
    tournamentName: tournamentName.value,
    awardedAt: new Date(Number(awardedAt.value) * 1000).toISOString(),
  };
}

function decodeTournamentState(
  publicKey: PublicKey,
  data: Buffer
): Omit<OnchainTournamentRecord, "registrations"> {
  let offset = 8;
  const tournamentId = readU64(data, offset);
  offset = tournamentId.offset;
  const organizer = readPubkey(data, offset);
  offset = organizer.offset;
  const name = readString(data, offset);
  offset = name.offset;
  const entryRule = readU8(data, offset);
  offset = entryRule.offset;
  const entryCredentialScopeId = readU64(data, offset);
  offset = entryCredentialScopeId.offset;
  const winnerTokenMint = readPubkey(data, offset);
  offset = winnerTokenMint.offset;
  const participationTokenMint = readPubkey(data, offset);
  offset = participationTokenMint.offset;
  const state = readU8(data, offset);
  offset = state.offset;
  const winnerOption = readU8(data, offset);
  offset = winnerOption.offset;
  let winnerWallet: string | null = null;
  if (winnerOption.value === 1) {
    const winner = readPubkey(data, offset);
    winnerWallet = winner.value.toBase58();
    offset = winner.offset;
  } else {
    offset += 32;
  }
  const createdAt = readI64(data, offset);
  offset = createdAt.offset;
  const completedAt = readI64(data, offset);
  offset = completedAt.offset;
  const participantCount = readU32(data, offset);

  return {
    id: tournamentId.value.toString(),
    publicKey: publicKey.toBase58(),
    organizerWallet: organizer.value.toBase58(),
    organizerName: `Organizer ${organizer.value.toBase58().slice(0, 4)}`,
    name: name.value,
    entryCredentialType: entryRule.value,
    entryCredentialScopeId: entryCredentialScopeId.value.toString(),
    winnerTokenMint: winnerTokenMint.value.toBase58(),
    participationTokenMint: participationTokenMint.value.toBase58(),
    status:
      state.value === 2 ? "completed" : state.value === 1 ? "in_progress" : "open",
    winnerWallet,
    participantCount: participantCount.value,
    createdAt: new Date(Number(createdAt.value) * 1000).toISOString(),
    completedAt:
      completedAt.value > BigInt(0)
        ? new Date(Number(completedAt.value) * 1000).toISOString()
        : null,
  };
}

function decodeTournamentParticipant(data: Buffer) {
  let offset = 8;
  const tournament = readPubkey(data, offset);
  offset = tournament.offset;
  const playerWallet = readPubkey(data, offset);
  offset = playerWallet.offset;
  const registeredAt = readI64(data, offset);

  return {
    tournament: tournament.value.toBase58(),
    playerWallet: playerWallet.value.toBase58(),
    registeredAt: new Date(Number(registeredAt.value) * 1000).toISOString(),
  };
}

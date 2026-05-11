import {
  createPublicKey,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  verify,
} from "crypto";
import type { Request, Response } from "express";
import bs58 from "bs58";
import { env } from "./env";
import { createStorage, sha256, type UserRecord, type UserRole } from "./storage";

export const storage = createStorage();

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const USERNAME_PATTERN = /^[a-z0-9]{3,24}$/;
const HARDCODED_ADMIN_WALLET = "qzSCWELxFmn5H3KPYQAdWhNCPnnpkkVtiTicqhGR2UA";
const PASSWORD_MIN_LENGTH = 8;
export type AuthIntent = "player" | "organizer";

export type SessionUser = {
  id: string;
  orgId: string;
  walletAddress: string;
  username: string;
  displayName: string;
  role: UserRole;
  organizerStatus: UserRecord["organizer_status"];
};

export function normalizeWalletAddress(value?: string) {
  const walletAddress = value?.trim();
  if (!walletAddress) {
    throw new Error("Wallet address is required.");
  }

  const decoded = bs58.decode(walletAddress);
  if (decoded.length !== 32) {
    throw new Error("Wallet address must be a valid 32-byte Solana public key.");
  }

  return bs58.encode(decoded);
}

function isHardcodedAdminWallet(walletAddress: string) {
  return walletAddress === HARDCODED_ADMIN_WALLET;
}

function validateAuthIntent(value?: string): AuthIntent {
  return value === "organizer" ? "organizer" : "player";
}

function getAuthIntentFromChallengeMessage(message: string): AuthIntent {
  return message.includes("Access: Organizer dashboard") ? "organizer" : "player";
}

export function createChallengeMessage(
  walletAddress: string,
  nonce: string,
  expiresAt: string,
  authIntent: AuthIntent
) {
  const accessLine =
    authIntent === "organizer"
      ? "Access: Organizer dashboard"
      : "Access: Player dashboard";
  return [
    "GameChain wallet sign-in",
    "",
    accessLine,
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    `Expires At: ${expiresAt}`,
    "",
    "Sign this message to authenticate with GameChain.",
  ].join("\n");
}

export async function issueChallenge(walletAddress: string, authIntent?: string) {
  const normalizedIntent = validateAuthIntent(authIntent);
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + env.challengeTtlMs).toISOString();
  const message = createChallengeMessage(
    walletAddress,
    nonce,
    expiresAt,
    normalizedIntent
  );

  const challenge = await storage.createChallenge({
    wallet_address: walletAddress,
    nonce,
    message,
    expires_at: expiresAt,
  });

  return {
    nonce: challenge.nonce,
    message: challenge.message,
    expiresAt: challenge.expires_at,
    authIntent: normalizedIntent,
  };
}

function decodeSignature(signature: string) {
  const trimmed = signature.trim();
  if (!trimmed) {
    throw new Error("Signature is required.");
  }

  try {
    const decoded = Buffer.from(trimmed, "base64");
    if (decoded.length === 64) {
      return decoded;
    }
  } catch {}

  try {
    const decoded = Buffer.from(bs58.decode(trimmed));
    if (decoded.length === 64) {
      return decoded;
    }
  } catch {}

  throw new Error("Signature must be a valid 64-byte base64 or base58 string.");
}

function verifyWalletSignature(walletAddress: string, message: string, signature: string) {
  const publicKey = bs58.decode(walletAddress);
  const signatureBytes = decodeSignature(signature);
  const publicKeyObject = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKey)]),
    format: "der",
    type: "spki",
  });

  return verify(
    null,
    Buffer.from(message, "utf8"),
    publicKeyObject,
    signatureBytes
  );
}

export function serializeUser(user: UserRecord): SessionUser {
  return {
    id: user.id,
    orgId: user.id,
    walletAddress: user.wallet_address,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    organizerStatus: user.organizer_status,
  };
}

function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPasswordHash(password: string, passwordHash: string) {
  const [algorithm, salt, expectedHash] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHash) {
    return false;
  }

  const actualHash = scryptSync(password, salt, expectedHash.length / 2).toString("hex");
  return timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}

async function createSessionForUser(user: UserRecord) {
  const sessionToken = randomUUID().replace(/-/g, "") + randomBytes(16).toString("hex");
  const tokenHash = sha256(sessionToken);
  const expiresAt = new Date(Date.now() + env.sessionTtlMs).toISOString();

  await storage.createSession({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  return {
    sessionToken,
    expiresAt,
    user,
    isNewUser: false,
    needsOnboarding: !user.username || !user.display_name,
  };
}

async function ensureAdminUser() {
  const adminUsername = env.adminUsername;
  const adminPassword = env.adminPassword;
  const adminDisplayName = env.adminDisplayName;

  if (!adminUsername || !adminPassword || !adminDisplayName) {
    throw new Error("Admin username, password, and display name are required.");
  }

  const passwordHash = createPasswordHash(adminPassword);
  const existingAdminByWallet = await storage.findUserByWallet(HARDCODED_ADMIN_WALLET);

  if (existingAdminByWallet) {
    if (
      existingAdminByWallet.role === "admin" &&
      existingAdminByWallet.organizer_status === "approved" &&
      existingAdminByWallet.username === adminUsername &&
      existingAdminByWallet.display_name === adminDisplayName &&
      existingAdminByWallet.password_hash &&
      verifyPasswordHash(adminPassword, existingAdminByWallet.password_hash)
    ) {
      return existingAdminByWallet;
    }

    return storage.updateUserProfile(existingAdminByWallet.id, {
      username: adminUsername,
      password_hash: passwordHash,
      display_name: adminDisplayName,
      role: "admin",
      organizer_status: "approved",
    });
  }

  const existingAdminByUsername = await storage.findUserByUsername(adminUsername);
  if (existingAdminByUsername) {
    return storage.updateUserProfile(existingAdminByUsername.id, {
      password_hash: passwordHash,
      display_name: adminDisplayName,
      role: "admin",
      organizer_status: "approved",
    });
  }

  return storage.createUser({
    wallet_address: HARDCODED_ADMIN_WALLET,
    username: adminUsername,
    password_hash: passwordHash,
    display_name: adminDisplayName,
    role: "admin",
    organizer_status: "approved",
  });
}

export type OrganizerApplicationSummary = {
  id: string;
  userId: string;
  walletAddress: string;
  username: string | null;
  displayName: string | null;
  role: UserRole;
  organizerStatus: UserRecord["organizer_status"];
  status: "pending" | "approved" | "rejected";
  reason: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function verifyChallengeAndCreateSession(input: {
  walletAddress: string;
  nonce: string;
  message: string;
  signature: string;
  authIntent?: string;
}) {
  const nowIso = new Date().toISOString();
  const challenge = await storage.findValidChallenge(
    input.walletAddress,
    input.nonce,
    nowIso
  );

  if (!challenge || challenge.message !== input.message) {
    throw new Error("Challenge is invalid or has expired.");
  }

  if (!verifyWalletSignature(input.walletAddress, input.message, input.signature)) {
    throw new Error("Wallet signature verification failed.");
  }

  const authIntent = getAuthIntentFromChallengeMessage(challenge.message);

  const consumedAt = new Date().toISOString();
  await storage.consumeChallenge(challenge.id, consumedAt);

  let user = await storage.findUserByWallet(input.walletAddress);
  let isNewUser = false;

  if (!user) {
    if (isHardcodedAdminWallet(input.walletAddress)) {
      isNewUser = true;
      user = await storage.createUser({
        wallet_address: input.walletAddress,
        username: "",
        password_hash: "",
        display_name: "",
        role: "admin",
        organizer_status: "approved",
      });
    } else if (authIntent === "organizer") {
      throw new Error("Organizer access is only available to approved organizer wallets.");
    } else {
      isNewUser = true;
      user = await storage.createUser({
        wallet_address: input.walletAddress,
        username: "",
        password_hash: "",
        display_name: "",
        role: "player",
        organizer_status: "none",
      });
    }
  } else if (
    isHardcodedAdminWallet(input.walletAddress) &&
    (user.role !== "admin" || user.organizer_status !== "approved")
  ) {
    user = await storage.updateUserProfile(user.id, {
      role: "admin",
      organizer_status: "approved",
    });
  }

  if (
    authIntent === "organizer" &&
    user.role !== "organizer" &&
    user.role !== "admin"
  ) {
    throw new Error("Organizer sign-in requires an approved organizer or admin wallet.");
  }

  const session = await createSessionForUser(user);
  return {
    ...session,
    isNewUser,
  };
}

export function validateUsername(value?: string) {
  const username = value?.trim().toLowerCase();
  if (!username) {
    throw new Error("Username is required.");
  }

  if (!USERNAME_PATTERN.test(username)) {
    throw new Error("Username must be 3-24 characters of lowercase letters and numbers.");
  }

  return username;
}

export function validateDisplayName(value?: string) {
  const displayName = value?.trim();
  if (!displayName) {
    throw new Error("Display name is required.");
  }

  if (displayName.length < 2 || displayName.length > 40) {
    throw new Error("Display name must be between 2 and 40 characters.");
  }

  return displayName;
}

export function validatePassword(value?: string) {
  const password = value?.trim() ?? "";
  if (!password) {
    throw new Error("Password is required.");
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }

  return password;
}

function parseCookie(req: Request) {
  const rawCookie = req.headers.cookie ?? "";
  const pairs = rawCookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");
      return [
        part.slice(0, separatorIndex),
        separatorIndex >= 0 ? decodeURIComponent(part.slice(separatorIndex + 1)) : "",
      ] as const;
    });

  return Object.fromEntries(pairs);
}

export function setSessionCookie(res: Response, token: string, expiresAt: string) {
  const maxAge = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  );
  const secure = env.secureCookies ? "; Secure" : "";
  const sameSite = env.secureCookies ? "None" : "Lax";
  res.setHeader(
    "Set-Cookie",
    `${env.sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=${maxAge}${secure}`
  );
}

export function clearSessionCookie(res: Response) {
  const secure = env.secureCookies ? "; Secure" : "";
  const sameSite = env.secureCookies ? "None" : "Lax";
  res.setHeader(
    "Set-Cookie",
    `${env.sessionCookieName}=; HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=0${secure}`
  );
}

export async function getSessionFromRequest(req: Request) {
  const cookies = parseCookie(req);
  const token = cookies[env.sessionCookieName];
  if (!token) {
    return null;
  }

  const session = await storage.getSessionByTokenHash(
    sha256(token),
    new Date().toISOString()
  );
  return session;
}

export async function updateUserProfile(
  userId: string,
  payload: { username?: string; displayName?: string; password?: string }
) {
  const username = validateUsername(payload.username);
  const displayName = validateDisplayName(payload.displayName);
  const existingByUsername = await storage.findUserByUsername(username);
  if (existingByUsername && existingByUsername.id !== userId) {
    throw new Error("Username is already taken.");
  }

  return storage.updateUserProfile(userId, {
    username,
    password_hash: payload.password?.trim()
      ? createPasswordHash(validatePassword(payload.password))
      : undefined,
    display_name: displayName,
  });
}

export async function signInWithPassword(payload: {
  username?: string;
  password?: string;
}) {
  await ensureAdminUser();

  const username = validateUsername(payload.username);
  const password = validatePassword(payload.password);
  const user = await storage.findUserByUsername(username);

  if (!user?.password_hash || !verifyPasswordHash(password, user.password_hash)) {
    throw new Error("Invalid username or password.");
  }

  if (
    user.role !== "organizer" &&
    user.role !== "admin" &&
    user.organizer_status !== "pending" &&
    user.organizer_status !== "rejected"
  ) {
    throw new Error("Organizer or admin access is required.");
  }

  return createSessionForUser(user);
}

export async function registerOrganizerWithPassword(payload: {
  walletAddress?: string;
  username?: string;
  displayName?: string;
  password?: string;
  reason?: string;
}) {
  await ensureAdminUser();

  const walletAddress = normalizeWalletAddress(payload.walletAddress);
  const username = validateUsername(payload.username);
  const displayName = validateDisplayName(payload.displayName);
  const password = validatePassword(payload.password);
  const trimmedReason = payload.reason?.trim() ?? "";

  if (trimmedReason.length < 20) {
    throw new Error("Organizer application reason must be at least 20 characters.");
  }

  const existingByUsername = await storage.findUserByUsername(username);
  const existingByWallet = await storage.findUserByWallet(walletAddress);

  if (
    existingByUsername &&
    existingByWallet &&
    existingByUsername.id !== existingByWallet.id
  ) {
    throw new Error("Username and wallet belong to different accounts.");
  }

  if (existingByUsername && !existingByWallet) {
    throw new Error("Username is already taken.");
  }

  let user = existingByWallet ?? existingByUsername;

  if (!user) {
    user = await storage.createUser({
      wallet_address: walletAddress,
      username,
      password_hash: createPasswordHash(password),
      display_name: displayName,
      role: "player",
      organizer_status: "pending",
    });
  } else {
    if (user.role === "admin") {
      throw new Error("Admin credentials must be managed separately.");
    }

    user = await storage.updateUserProfile(user.id, {
      username,
      password_hash: createPasswordHash(password),
      display_name: displayName,
      organizer_status: user.organizer_status === "approved" ? "approved" : "pending",
    });
  }

  const application = await storage.upsertOrganizerApplication({
    user_id: user.id,
    reason: trimmedReason,
    status: user.organizer_status === "approved" ? "approved" : "pending",
  });

  const session = await createSessionForUser(user);
  return { ...session, application };
}

export async function submitOrganizerApplication(userId: string, reason: string) {
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 20) {
    throw new Error("Organizer application reason must be at least 20 characters.");
  }

  return storage.upsertOrganizerApplication({
    user_id: userId,
    reason: trimmedReason,
    status: "pending",
  });
}

export async function listOrganizerApplications() {
  const applications = await storage.listOrganizerApplications();
  return Promise.all(
    applications.map(async (application) => {
      const user = await storage.findUserById(application.user_id);
      if (!user) {
        throw new Error(`User not found for organizer application ${application.id}.`);
      }

      return {
        id: application.id,
        userId: application.user_id,
        walletAddress: user.wallet_address,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        organizerStatus: user.organizer_status,
        status: application.status,
        reason: application.reason,
        reviewedBy: application.reviewed_by,
        reviewedAt: application.reviewed_at,
        createdAt: application.created_at,
        updatedAt: application.updated_at,
      } satisfies OrganizerApplicationSummary;
    })
  );
}

export async function approveOrganizerApplication(
  applicationId: string,
  adminUserId: string
) {
  const application = await storage.getOrganizerApplicationById(applicationId);
  if (!application) {
    throw new Error("Organizer application not found.");
  }

  await storage.updateUserProfile(application.user_id, {
    role: "organizer",
    organizer_status: "approved",
  });

  return storage.upsertOrganizerApplication({
    user_id: application.user_id,
    reason: application.reason,
    status: "approved",
    reviewed_by: adminUserId,
    reviewed_at: new Date().toISOString(),
  });
}

export async function rejectOrganizerApplication(
  applicationId: string,
  adminUserId: string
) {
  const application = await storage.getOrganizerApplicationById(applicationId);
  if (!application) {
    throw new Error("Organizer application not found.");
  }

  await storage.updateUserProfile(application.user_id, {
    role: "player",
    organizer_status: "rejected",
  });

  return storage.upsertOrganizerApplication({
    user_id: application.user_id,
    reason: application.reason,
    status: "rejected",
    reviewed_by: adminUserId,
    reviewed_at: new Date().toISOString(),
  });
}

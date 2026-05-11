"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = void 0;
exports.normalizeWalletAddress = normalizeWalletAddress;
exports.createChallengeMessage = createChallengeMessage;
exports.issueChallenge = issueChallenge;
exports.serializeUser = serializeUser;
exports.verifyChallengeAndCreateSession = verifyChallengeAndCreateSession;
exports.validateUsername = validateUsername;
exports.validateDisplayName = validateDisplayName;
exports.validatePassword = validatePassword;
exports.setSessionCookie = setSessionCookie;
exports.clearSessionCookie = clearSessionCookie;
exports.getSessionFromRequest = getSessionFromRequest;
exports.updateUserProfile = updateUserProfile;
exports.signInWithPassword = signInWithPassword;
exports.registerOrganizerWithPassword = registerOrganizerWithPassword;
exports.submitOrganizerApplication = submitOrganizerApplication;
exports.listOrganizerApplications = listOrganizerApplications;
exports.approveOrganizerApplication = approveOrganizerApplication;
exports.rejectOrganizerApplication = rejectOrganizerApplication;
const crypto_1 = require("crypto");
const bs58_1 = __importDefault(require("bs58"));
const env_1 = require("./env");
const storage_1 = require("./storage");
exports.storage = (0, storage_1.createStorage)();
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const USERNAME_PATTERN = /^[a-z0-9]{3,24}$/;
const HARDCODED_ADMIN_WALLET = "qzSCWELxFmn5H3KPYQAdWhNCPnnpkkVtiTicqhGR2UA";
const PASSWORD_MIN_LENGTH = 8;
function normalizeWalletAddress(value) {
    const walletAddress = value?.trim();
    if (!walletAddress) {
        throw new Error("Wallet address is required.");
    }
    const decoded = bs58_1.default.decode(walletAddress);
    if (decoded.length !== 32) {
        throw new Error("Wallet address must be a valid 32-byte Solana public key.");
    }
    return bs58_1.default.encode(decoded);
}
function isHardcodedAdminWallet(walletAddress) {
    return walletAddress === HARDCODED_ADMIN_WALLET;
}
function validateAuthIntent(value) {
    return value === "organizer" ? "organizer" : "player";
}
function getAuthIntentFromChallengeMessage(message) {
    return message.includes("Access: Organizer dashboard") ? "organizer" : "player";
}
function createChallengeMessage(walletAddress, nonce, expiresAt, authIntent) {
    const accessLine = authIntent === "organizer"
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
async function issueChallenge(walletAddress, authIntent) {
    const normalizedIntent = validateAuthIntent(authIntent);
    const nonce = (0, crypto_1.randomBytes)(16).toString("hex");
    const expiresAt = new Date(Date.now() + env_1.env.challengeTtlMs).toISOString();
    const message = createChallengeMessage(walletAddress, nonce, expiresAt, normalizedIntent);
    const challenge = await exports.storage.createChallenge({
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
function decodeSignature(signature) {
    const trimmed = signature.trim();
    if (!trimmed) {
        throw new Error("Signature is required.");
    }
    try {
        const decoded = Buffer.from(trimmed, "base64");
        if (decoded.length === 64) {
            return decoded;
        }
    }
    catch { }
    try {
        const decoded = Buffer.from(bs58_1.default.decode(trimmed));
        if (decoded.length === 64) {
            return decoded;
        }
    }
    catch { }
    throw new Error("Signature must be a valid 64-byte base64 or base58 string.");
}
function verifyWalletSignature(walletAddress, message, signature) {
    const publicKey = bs58_1.default.decode(walletAddress);
    const signatureBytes = decodeSignature(signature);
    const publicKeyObject = (0, crypto_1.createPublicKey)({
        key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKey)]),
        format: "der",
        type: "spki",
    });
    return (0, crypto_1.verify)(null, Buffer.from(message, "utf8"), publicKeyObject, signatureBytes);
}
function serializeUser(user) {
    return {
        id: user.id,
        walletAddress: user.wallet_address,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        organizerStatus: user.organizer_status,
    };
}
function createPasswordHash(password) {
    const salt = (0, crypto_1.randomBytes)(16).toString("hex");
    const hash = (0, crypto_1.scryptSync)(password, salt, 64).toString("hex");
    return `scrypt$${salt}$${hash}`;
}
function verifyPasswordHash(password, passwordHash) {
    const [algorithm, salt, expectedHash] = passwordHash.split("$");
    if (algorithm !== "scrypt" || !salt || !expectedHash) {
        return false;
    }
    const actualHash = (0, crypto_1.scryptSync)(password, salt, expectedHash.length / 2).toString("hex");
    return (0, crypto_1.timingSafeEqual)(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}
async function createSessionForUser(user) {
    const sessionToken = (0, crypto_1.randomUUID)().replace(/-/g, "") + (0, crypto_1.randomBytes)(16).toString("hex");
    const tokenHash = (0, storage_1.sha256)(sessionToken);
    const expiresAt = new Date(Date.now() + env_1.env.sessionTtlMs).toISOString();
    await exports.storage.createSession({
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
    const adminUsername = env_1.env.adminUsername;
    const adminPassword = env_1.env.adminPassword;
    const adminDisplayName = env_1.env.adminDisplayName;
    if (!adminUsername || !adminPassword || !adminDisplayName) {
        throw new Error("Admin username, password, and display name are required.");
    }
    const passwordHash = createPasswordHash(adminPassword);
    const existingAdminByWallet = await exports.storage.findUserByWallet(HARDCODED_ADMIN_WALLET);
    if (existingAdminByWallet) {
        if (existingAdminByWallet.role === "admin" &&
            existingAdminByWallet.organizer_status === "approved" &&
            existingAdminByWallet.username === adminUsername &&
            existingAdminByWallet.display_name === adminDisplayName &&
            existingAdminByWallet.password_hash &&
            verifyPasswordHash(adminPassword, existingAdminByWallet.password_hash)) {
            return existingAdminByWallet;
        }
        return exports.storage.updateUserProfile(existingAdminByWallet.id, {
            username: adminUsername,
            password_hash: passwordHash,
            display_name: adminDisplayName,
            role: "admin",
            organizer_status: "approved",
        });
    }
    const existingAdminByUsername = await exports.storage.findUserByUsername(adminUsername);
    if (existingAdminByUsername) {
        return exports.storage.updateUserProfile(existingAdminByUsername.id, {
            password_hash: passwordHash,
            display_name: adminDisplayName,
            role: "admin",
            organizer_status: "approved",
        });
    }
    return exports.storage.createUser({
        wallet_address: HARDCODED_ADMIN_WALLET,
        username: adminUsername,
        password_hash: passwordHash,
        display_name: adminDisplayName,
        role: "admin",
        organizer_status: "approved",
    });
}
async function verifyChallengeAndCreateSession(input) {
    const nowIso = new Date().toISOString();
    const challenge = await exports.storage.findValidChallenge(input.walletAddress, input.nonce, nowIso);
    if (!challenge || challenge.message !== input.message) {
        throw new Error("Challenge is invalid or has expired.");
    }
    if (!verifyWalletSignature(input.walletAddress, input.message, input.signature)) {
        throw new Error("Wallet signature verification failed.");
    }
    const authIntent = getAuthIntentFromChallengeMessage(challenge.message);
    const consumedAt = new Date().toISOString();
    await exports.storage.consumeChallenge(challenge.id, consumedAt);
    let user = await exports.storage.findUserByWallet(input.walletAddress);
    let isNewUser = false;
    if (!user) {
        if (isHardcodedAdminWallet(input.walletAddress)) {
            isNewUser = true;
            user = await exports.storage.createUser({
                wallet_address: input.walletAddress,
                username: "",
                password_hash: "",
                display_name: "",
                role: "admin",
                organizer_status: "approved",
            });
        }
        else if (authIntent === "organizer") {
            throw new Error("Organizer access is only available to approved organizer wallets.");
        }
        else {
            isNewUser = true;
            user = await exports.storage.createUser({
                wallet_address: input.walletAddress,
                username: "",
                password_hash: "",
                display_name: "",
                role: "player",
                organizer_status: "none",
            });
        }
    }
    else if (isHardcodedAdminWallet(input.walletAddress) &&
        (user.role !== "admin" || user.organizer_status !== "approved")) {
        user = await exports.storage.updateUserProfile(user.id, {
            role: "admin",
            organizer_status: "approved",
        });
    }
    if (authIntent === "organizer" &&
        user.role !== "organizer" &&
        user.role !== "admin") {
        throw new Error("Organizer sign-in requires an approved organizer or admin wallet.");
    }
    const session = await createSessionForUser(user);
    return {
        ...session,
        isNewUser,
    };
}
function validateUsername(value) {
    const username = value?.trim().toLowerCase();
    if (!username) {
        throw new Error("Username is required.");
    }
    if (!USERNAME_PATTERN.test(username)) {
        throw new Error("Username must be 3-24 characters of lowercase letters and numbers.");
    }
    return username;
}
function validateDisplayName(value) {
    const displayName = value?.trim();
    if (!displayName) {
        throw new Error("Display name is required.");
    }
    if (displayName.length < 2 || displayName.length > 40) {
        throw new Error("Display name must be between 2 and 40 characters.");
    }
    return displayName;
}
function validatePassword(value) {
    const password = value?.trim() ?? "";
    if (!password) {
        throw new Error("Password is required.");
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
        throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    }
    return password;
}
function parseCookie(req) {
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
        ];
    });
    return Object.fromEntries(pairs);
}
function setSessionCookie(res, token, expiresAt) {
    const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    const secure = env_1.env.secureCookies ? "; Secure" : "";
    res.setHeader("Set-Cookie", `${env_1.env.sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}
function clearSessionCookie(res) {
    const secure = env_1.env.secureCookies ? "; Secure" : "";
    res.setHeader("Set-Cookie", `${env_1.env.sessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
}
async function getSessionFromRequest(req) {
    const cookies = parseCookie(req);
    const token = cookies[env_1.env.sessionCookieName];
    if (!token) {
        return null;
    }
    const session = await exports.storage.getSessionByTokenHash((0, storage_1.sha256)(token), new Date().toISOString());
    return session;
}
async function updateUserProfile(userId, payload) {
    const username = validateUsername(payload.username);
    const displayName = validateDisplayName(payload.displayName);
    const existingByUsername = await exports.storage.findUserByUsername(username);
    if (existingByUsername && existingByUsername.id !== userId) {
        throw new Error("Username is already taken.");
    }
    return exports.storage.updateUserProfile(userId, {
        username,
        password_hash: payload.password?.trim()
            ? createPasswordHash(validatePassword(payload.password))
            : undefined,
        display_name: displayName,
    });
}
async function signInWithPassword(payload) {
    await ensureAdminUser();
    const username = validateUsername(payload.username);
    const password = validatePassword(payload.password);
    const user = await exports.storage.findUserByUsername(username);
    if (!user?.password_hash || !verifyPasswordHash(password, user.password_hash)) {
        throw new Error("Invalid username or password.");
    }
    if (user.role !== "organizer" &&
        user.role !== "admin" &&
        user.organizer_status !== "pending" &&
        user.organizer_status !== "rejected") {
        throw new Error("Organizer or admin access is required.");
    }
    return createSessionForUser(user);
}
async function registerOrganizerWithPassword(payload) {
    await ensureAdminUser();
    const walletAddress = normalizeWalletAddress(payload.walletAddress);
    const username = validateUsername(payload.username);
    const displayName = validateDisplayName(payload.displayName);
    const password = validatePassword(payload.password);
    const trimmedReason = payload.reason?.trim() ?? "";
    if (trimmedReason.length < 20) {
        throw new Error("Organizer application reason must be at least 20 characters.");
    }
    const existingByUsername = await exports.storage.findUserByUsername(username);
    const existingByWallet = await exports.storage.findUserByWallet(walletAddress);
    if (existingByUsername &&
        existingByWallet &&
        existingByUsername.id !== existingByWallet.id) {
        throw new Error("Username and wallet belong to different accounts.");
    }
    if (existingByUsername && !existingByWallet) {
        throw new Error("Username is already taken.");
    }
    let user = existingByWallet ?? existingByUsername;
    if (!user) {
        user = await exports.storage.createUser({
            wallet_address: walletAddress,
            username,
            password_hash: createPasswordHash(password),
            display_name: displayName,
            role: "player",
            organizer_status: "pending",
        });
    }
    else {
        if (user.role === "admin") {
            throw new Error("Admin credentials must be managed separately.");
        }
        user = await exports.storage.updateUserProfile(user.id, {
            username,
            password_hash: createPasswordHash(password),
            display_name: displayName,
            organizer_status: user.organizer_status === "approved" ? "approved" : "pending",
        });
    }
    const application = await exports.storage.upsertOrganizerApplication({
        user_id: user.id,
        reason: trimmedReason,
        status: user.organizer_status === "approved" ? "approved" : "pending",
    });
    const session = await createSessionForUser(user);
    return { ...session, application };
}
async function submitOrganizerApplication(userId, reason) {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 20) {
        throw new Error("Organizer application reason must be at least 20 characters.");
    }
    return exports.storage.upsertOrganizerApplication({
        user_id: userId,
        reason: trimmedReason,
        status: "pending",
    });
}
async function listOrganizerApplications() {
    const applications = await exports.storage.listOrganizerApplications();
    return Promise.all(applications.map(async (application) => {
        const user = await exports.storage.findUserById(application.user_id);
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
        };
    }));
}
async function approveOrganizerApplication(applicationId, adminUserId) {
    const application = await exports.storage.getOrganizerApplicationById(applicationId);
    if (!application) {
        throw new Error("Organizer application not found.");
    }
    await exports.storage.updateUserProfile(application.user_id, {
        role: "organizer",
        organizer_status: "approved",
    });
    return exports.storage.upsertOrganizerApplication({
        user_id: application.user_id,
        reason: application.reason,
        status: "approved",
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
    });
}
async function rejectOrganizerApplication(applicationId, adminUserId) {
    const application = await exports.storage.getOrganizerApplicationById(applicationId);
    if (!application) {
        throw new Error("Organizer application not found.");
    }
    await exports.storage.updateUserProfile(application.user_id, {
        role: "player",
        organizer_status: "rejected",
    });
    return exports.storage.upsertOrganizerApplication({
        user_id: application.user_id,
        reason: application.reason,
        status: "rejected",
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
    });
}

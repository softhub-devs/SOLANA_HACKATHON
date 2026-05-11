"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("./auth");
const demoIssuer_1 = require("./demoIssuer");
const env_1 = require("./env");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((req, res, next) => {
    const origin = req.get("origin");
    if (!origin) {
        next();
        return;
    }
    if (origin === env_1.env.webOrigin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Vary", "Origin");
    }
    else {
        res.status(403).json({ error: "CORS policy: Origin not allowed." });
        return;
    }
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }
    next();
});
function firstParam(value) {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
function baseUrl(req) {
    return `${req.protocol}://${req.get("host")}`;
}
function isOrganizer(role) {
    return role === "organizer" || role === "admin";
}
app.get("/health", (_req, res) => {
    res.json({
        ok: true,
        service: "gamechain-api",
        mode: (0, env_1.hasSupabaseConfig)() ? "supabase" : "memory-fallback",
    });
});
app.post("/auth/challenge", async (req, res) => {
    try {
        const body = req.body ?? {};
        const walletAddress = (0, auth_1.normalizeWalletAddress)(body.walletAddress);
        res.status(201).json(await (0, auth_1.issueChallenge)(walletAddress, body.authIntent));
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to create challenge.",
        });
    }
});
app.post("/auth/verify", async (req, res) => {
    try {
        const body = req.body ?? {
            walletAddress: "",
            nonce: "",
            message: "",
            signature: "",
            authIntent: "player",
        };
        const walletAddress = (0, auth_1.normalizeWalletAddress)(body.walletAddress);
        const result = await (0, auth_1.verifyChallengeAndCreateSession)({
            walletAddress,
            nonce: firstParam(body.nonce),
            message: firstParam(body.message),
            signature: firstParam(body.signature),
            authIntent: firstParam(body.authIntent),
        });
        (0, auth_1.setSessionCookie)(res, result.sessionToken, result.expiresAt);
        res.json({
            user: (0, auth_1.serializeUser)(result.user),
            session: { expiresAt: result.expiresAt },
            isNewUser: result.isNewUser,
            needsOnboarding: result.needsOnboarding,
        });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Wallet verification failed.",
        });
    }
});
app.post("/auth/login", async (req, res) => {
    try {
        const body = req.body ?? {};
        const result = await (0, auth_1.signInWithPassword)(body);
        (0, auth_1.setSessionCookie)(res, result.sessionToken, result.expiresAt);
        res.json({
            user: (0, auth_1.serializeUser)(result.user),
            session: { expiresAt: result.expiresAt },
        });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Credential login failed.",
        });
    }
});
app.post("/auth/register-organizer", async (req, res) => {
    try {
        const body = req.body ?? {};
        const result = await (0, auth_1.registerOrganizerWithPassword)(body);
        (0, auth_1.setSessionCookie)(res, result.sessionToken, result.expiresAt);
        res.status(201).json({
            user: (0, auth_1.serializeUser)(result.user),
            session: { expiresAt: result.expiresAt },
            application: result.application,
            needsOnboarding: result.needsOnboarding,
            isNewUser: result.isNewUser,
        });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Organizer registration failed.",
        });
    }
});
app.get("/auth/session", async (req, res) => {
    const session = await (0, auth_1.getSessionFromRequest)(req);
    if (!session) {
        res.status(401).json({ error: "No active session." });
        return;
    }
    res.json({
        user: (0, auth_1.serializeUser)(session.user),
        session: { expiresAt: session.session.expires_at },
    });
});
app.post("/auth/logout", async (req, res) => {
    const session = await (0, auth_1.getSessionFromRequest)(req);
    if (session) {
        await auth_1.storage.deleteSession(session.session.token_hash);
    }
    (0, auth_1.clearSessionCookie)(res);
    res.status(204).end();
});
app.patch("/auth/profile", async (req, res) => {
    const session = await (0, auth_1.getSessionFromRequest)(req);
    if (!session) {
        res.status(401).json({ error: "Sign in first." });
        return;
    }
    try {
        const body = req.body ?? {};
        const user = await (0, auth_1.updateUserProfile)(session.user.id, body);
        res.json({ user: (0, auth_1.serializeUser)(user) });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to update profile.",
        });
    }
});
app.post("/organizer-applications", async (req, res) => {
    const session = await (0, auth_1.getSessionFromRequest)(req);
    if (!session) {
        res.status(401).json({ error: "Sign in first." });
        return;
    }
    try {
        const reason = firstParam(req.body?.reason);
        const application = await (0, auth_1.submitOrganizerApplication)(session.user.id, reason);
        const user = await auth_1.storage.updateUserProfile(session.user.id, {
            organizer_status: "pending",
        });
        res.status(201).json({ application, user: (0, auth_1.serializeUser)(user) });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error
                ? error.message
                : "Failed to submit organizer application.",
        });
    }
});
app.get("/admin/organizer-applications", async (req, res) => {
    const session = await (0, auth_1.getSessionFromRequest)(req);
    if (!session || session.user.role !== "admin") {
        res.status(403).json({ error: "Admin access required." });
        return;
    }
    res.json({ applications: await (0, auth_1.listOrganizerApplications)() });
});
app.post("/admin/organizer-applications/:applicationId/approve", async (req, res) => {
    const session = await (0, auth_1.getSessionFromRequest)(req);
    if (!session || session.user.role !== "admin") {
        res.status(403).json({ error: "Admin access required." });
        return;
    }
    try {
        res.json({
            application: await (0, auth_1.approveOrganizerApplication)(firstParam(req.params.applicationId), session.user.id),
        });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error
                ? error.message
                : "Failed to approve organizer application.",
        });
    }
});
app.post("/admin/organizer-applications/:applicationId/reject", async (req, res) => {
    const session = await (0, auth_1.getSessionFromRequest)(req);
    if (!session || session.user.role !== "admin") {
        res.status(403).json({ error: "Admin access required." });
        return;
    }
    try {
        res.json({
            application: await (0, auth_1.rejectOrganizerApplication)(firstParam(req.params.applicationId), session.user.id),
        });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error
                ? error.message
                : "Failed to reject organizer application.",
        });
    }
});
app.post("/api/verify", async (req, res) => {
    const payload = await (0, demoIssuer_1.issueCredential)(req.body, {
        baseUrl: baseUrl(req),
    });
    res.status(200).json(payload);
});
app.get("/api/credentials/:wallet", async (req, res) => {
    const result = await (0, demoIssuer_1.getCredentialByWallet)(firstParam(req.params.wallet));
    if (!result) {
        res.status(404).json({ error: "Credential not found for wallet." });
        return;
    }
    res.json(result);
});
app.get("/api/players/:wallet", async (req, res) => {
    res.json(await (0, demoIssuer_1.getPlayerDashboard)(firstParam(req.params.wallet)));
});
app.get("/api/credentials/:wallet/:credentialType", async (req, res) => {
    const result = await (0, demoIssuer_1.getCredentialByType)(firstParam(req.params.wallet), parseInt(firstParam(req.params.credentialType), 10));
    if (!result) {
        res.status(404).json({ error: "Credential type not found for wallet." });
        return;
    }
    res.json(result);
});
app.get("/api/tournaments/demo/eligibility/:wallet", async (req, res) => {
    const result = await (0, demoIssuer_1.getTournamentEligibility)(firstParam(req.params.wallet));
    if (!result) {
        res.status(404).json({ error: "No credential found for organizer check." });
        return;
    }
    res.json(result);
});
app.get("/api/tournaments", (_req, res) => {
    res.json({ tournaments: (0, demoIssuer_1.listTournaments)() });
});
app.post("/api/tournaments", async (req, res) => {
    const session = await (0, auth_1.getSessionFromRequest)(req);
    if (!session || !isOrganizer(session.user.role)) {
        res.status(403).json({ error: "Organizer approval is required." });
        return;
    }
    const tournament = (0, demoIssuer_1.createTournament)({
        ...req.body,
        organizerWallet: session.user.wallet_address,
        organizerName: session.user.display_name ?? session.user.username ?? "Organizer",
    });
    res.status(201).json(tournament);
});
app.get("/api/tournaments/:tournamentId", (req, res) => {
    const tournament = (0, demoIssuer_1.getTournamentById)(firstParam(req.params.tournamentId));
    if (!tournament) {
        res.status(404).json({ error: "Tournament not found." });
        return;
    }
    res.json(tournament);
});
app.get("/api/tournaments/:tournamentId/eligibility/:wallet", async (req, res) => {
    const result = await (0, demoIssuer_1.getTournamentEligibilityForTournament)(firstParam(req.params.tournamentId), firstParam(req.params.wallet));
    if (!result) {
        res
            .status(404)
            .json({ error: "Tournament or credential not found for organizer check." });
        return;
    }
    res.json(result);
});
app.post("/api/tournaments/:tournamentId/register", async (req, res) => {
    const session = await (0, auth_1.getSessionFromRequest)(req);
    if (!session) {
        res.status(401).json({ error: "Sign in first." });
        return;
    }
    const result = await (0, demoIssuer_1.registerPlayerForTournament)(firstParam(req.params.tournamentId), session.user.wallet_address);
    if ("error" in result) {
        res.status(400).json(result);
        return;
    }
    res.json(result);
});
app.post("/api/tournaments/:tournamentId/finalize", async (req, res) => {
    const session = await (0, auth_1.getSessionFromRequest)(req);
    if (!session || !isOrganizer(session.user.role)) {
        res.status(403).json({ error: "Organizer approval is required." });
        return;
    }
    const winnerWallet = firstParam(req.body?.winnerWallet);
    const result = await (0, demoIssuer_1.finalizeTournament)(firstParam(req.params.tournamentId), winnerWallet);
    if ("error" in result) {
        res.status(400).json(result);
        return;
    }
    res.json(result);
});
app.get("/api/actions/credential", (req, res) => {
    res.json((0, demoIssuer_1.getActionMetadata)(baseUrl(req)));
});
app.post("/api/actions/credential", async (req, res) => {
    const wallet = req.body?.wallet;
    res.json(await (0, demoIssuer_1.runAction)(wallet, baseUrl(req)));
});
app.listen(env_1.env.port, () => {
    console.log(`GameChain API listening on http://localhost:${env_1.env.port}`);
});

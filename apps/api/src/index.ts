import express, { Request, Response } from "express";
import {
  approveOrganizerApplication,
  clearSessionCookie,
  getSessionFromRequest,
  issueChallenge,
  listOrganizerApplications,
  normalizeWalletAddress,
  registerOrganizerWithPassword,
  rejectOrganizerApplication,
  serializeUser,
  setSessionCookie,
  signInWithPassword,
  storage,
  submitOrganizerApplication,
  updateUserProfile,
  verifyChallengeAndCreateSession,
} from "./auth";
import {
  createTournament,
  finalizeTournament,
  getActionMetadata,
  getCredentialByType,
  getCredentialByWallet,
  getPlayerDashboard,
  getTournamentById,
  getTournamentEligibility,
  getTournamentEligibilityForTournament,
  issueCredential,
  listTournaments,
  registerPlayerForTournament,
  runAction,
  type VerifyRequest,
} from "./demoIssuer";
import { env, hasSupabaseConfig } from "./env";

const app = express();

app.use(express.json());
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && origin === env.webOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function baseUrl(req: Request) {
  return `${req.protocol}://${req.get("host")}`;
}

function isOrganizer(role: string) {
  return role === "organizer" || role === "admin";
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "gamechain-api",
    mode: hasSupabaseConfig() ? "supabase" : "memory-fallback",
  });
});

app.post("/auth/challenge", async (req: Request, res: Response) => {
  try {
    const body = (req.body as { walletAddress?: string; authIntent?: string } | undefined) ?? {};
    const walletAddress = normalizeWalletAddress(
      body.walletAddress
    );
    res.status(201).json(await issueChallenge(walletAddress, body.authIntent));
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to create challenge.",
    });
  }
});

app.post("/auth/verify", async (req: Request, res: Response) => {
  try {
    const body = (req.body as {
      walletAddress?: string;
      nonce?: string;
      message?: string;
      signature?: string;
      authIntent?: string;
    }) ?? {
      walletAddress: "",
      nonce: "",
      message: "",
      signature: "",
      authIntent: "player",
    };

    const walletAddress = normalizeWalletAddress(body.walletAddress);
    const result = await verifyChallengeAndCreateSession({
      walletAddress,
      nonce: firstParam(body.nonce),
      message: firstParam(body.message),
      signature: firstParam(body.signature),
      authIntent: firstParam(body.authIntent),
    });

    setSessionCookie(res, result.sessionToken, result.expiresAt);

    res.json({
      user: serializeUser(result.user),
      session: { expiresAt: result.expiresAt },
      isNewUser: result.isNewUser,
      needsOnboarding: result.needsOnboarding,
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Wallet verification failed.",
    });
  }
});

app.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const body = (req.body as { username?: string; password?: string } | undefined) ?? {};
    const result = await signInWithPassword(body);

    setSessionCookie(res, result.sessionToken, result.expiresAt);
    res.json({
      user: serializeUser(result.user),
      session: { expiresAt: result.expiresAt },
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Credential login failed.",
    });
  }
});

app.post("/auth/register-organizer", async (req: Request, res: Response) => {
  try {
    const body =
      (req.body as {
        walletAddress?: string;
        username?: string;
        displayName?: string;
        password?: string;
        reason?: string;
      } | undefined) ?? {};

    const result = await registerOrganizerWithPassword(body);
    setSessionCookie(res, result.sessionToken, result.expiresAt);
    res.status(201).json({
      user: serializeUser(result.user),
      session: { expiresAt: result.expiresAt },
      application: result.application,
      needsOnboarding: result.needsOnboarding,
      isNewUser: result.isNewUser,
    });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Organizer registration failed.",
    });
  }
});

app.get("/auth/session", async (req: Request, res: Response) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "No active session." });
    return;
  }

  res.json({
    user: serializeUser(session.user),
    session: { expiresAt: session.session.expires_at },
  });
});

app.post("/auth/logout", async (req: Request, res: Response) => {
  const session = await getSessionFromRequest(req);
  if (session) {
    await storage.deleteSession(session.session.token_hash);
  }

  clearSessionCookie(res);
  res.status(204).end();
});

app.patch("/auth/profile", async (req: Request, res: Response) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Sign in first." });
    return;
  }

  try {
    const body = (req.body as { username?: string; displayName?: string }) ?? {};
    const user = await updateUserProfile(session.user.id, body);
    res.json({ user: serializeUser(user) });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to update profile.",
    });
  }
});

app.post("/organizer-applications", async (req: Request, res: Response) => {
  const session = await getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Sign in first." });
    return;
  }

  try {
    const reason = firstParam(
      (req.body as { reason?: string } | undefined)?.reason
    );
    const application = await submitOrganizerApplication(session.user.id, reason);
    const user = await storage.updateUserProfile(session.user.id, {
      organizer_status: "pending",
    });
    res.status(201).json({ application, user: serializeUser(user) });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to submit organizer application.",
    });
  }
});

app.get("/admin/organizer-applications", async (req: Request, res: Response) => {
  const session = await getSessionFromRequest(req);
  if (!session || session.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  res.json({ applications: await listOrganizerApplications() });
});

app.post(
  "/admin/organizer-applications/:applicationId/approve",
  async (req: Request, res: Response) => {
    const session = await getSessionFromRequest(req);
    if (!session || session.user.role !== "admin") {
      res.status(403).json({ error: "Admin access required." });
      return;
    }

    try {
      res.json({
        application: await approveOrganizerApplication(
          firstParam(req.params.applicationId),
          session.user.id
        ),
      });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to approve organizer application.",
      });
    }
  }
);

app.post(
  "/admin/organizer-applications/:applicationId/reject",
  async (req: Request, res: Response) => {
    const session = await getSessionFromRequest(req);
    if (!session || session.user.role !== "admin") {
      res.status(403).json({ error: "Admin access required." });
      return;
    }

    try {
      res.json({
        application: await rejectOrganizerApplication(
          firstParam(req.params.applicationId),
          session.user.id
        ),
      });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to reject organizer application.",
      });
    }
  }
);

app.post("/api/verify", async (req: Request, res: Response) => {
  const payload = await issueCredential(req.body as VerifyRequest, {
    baseUrl: baseUrl(req),
  });
  res.status(200).json(payload);
});

app.get("/api/credentials/:wallet", async (req: Request, res: Response) => {
  const result = await getCredentialByWallet(firstParam(req.params.wallet));
  if (!result) {
    res.status(404).json({ error: "Credential not found for wallet." });
    return;
  }

  res.json(result);
});

app.get("/api/players/:wallet", async (req: Request, res: Response) => {
  res.json(await getPlayerDashboard(firstParam(req.params.wallet)));
});

app.get(
  "/api/credentials/:wallet/:credentialType",
  async (req: Request, res: Response) => {
    const result = await getCredentialByType(
      firstParam(req.params.wallet),
      parseInt(firstParam(req.params.credentialType), 10)
    );
    if (!result) {
      res.status(404).json({ error: "Credential type not found for wallet." });
      return;
    }

    res.json(result);
  }
);

app.get(
  "/api/tournaments/demo/eligibility/:wallet",
  async (req: Request, res: Response) => {
    const result = await getTournamentEligibility(firstParam(req.params.wallet));
    if (!result) {
      res.status(404).json({ error: "No credential found for organizer check." });
      return;
    }

    res.json(result);
  }
);

app.get("/api/tournaments", (_req: Request, res: Response) => {
  res.json({ tournaments: listTournaments() });
});

app.post("/api/tournaments", async (req: Request, res: Response) => {
  const session = await getSessionFromRequest(req);
  if (!session || !isOrganizer(session.user.role)) {
    res.status(403).json({ error: "Organizer approval is required." });
    return;
  }

  const tournament = createTournament({
    ...(req.body as Record<string, unknown>),
    organizerWallet: session.user.wallet_address,
    organizerName: session.user.display_name ?? session.user.username ?? "Organizer",
  });
  res.status(201).json(tournament);
});

app.get("/api/tournaments/:tournamentId", (req: Request, res: Response) => {
  const tournament = getTournamentById(firstParam(req.params.tournamentId));
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found." });
    return;
  }

  res.json(tournament);
});

app.get(
  "/api/tournaments/:tournamentId/eligibility/:wallet",
  async (req: Request, res: Response) => {
    const result = await getTournamentEligibilityForTournament(
      firstParam(req.params.tournamentId),
      firstParam(req.params.wallet)
    );

    if (!result) {
      res
        .status(404)
        .json({ error: "Tournament or credential not found for organizer check." });
      return;
    }

    res.json(result);
  }
);

app.post(
  "/api/tournaments/:tournamentId/register",
  async (req: Request, res: Response) => {
    const session = await getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: "Sign in first." });
      return;
    }

    const result = await registerPlayerForTournament(
      firstParam(req.params.tournamentId),
      session.user.wallet_address
    );

    if ("error" in result) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  }
);

app.post(
  "/api/tournaments/:tournamentId/finalize",
  async (req: Request, res: Response) => {
    const session = await getSessionFromRequest(req);
    if (!session || !isOrganizer(session.user.role)) {
      res.status(403).json({ error: "Organizer approval is required." });
      return;
    }

    const winnerWallet = firstParam(
      (req.body as { winnerWallet?: string } | undefined)?.winnerWallet
    );
    const result = await finalizeTournament(
      firstParam(req.params.tournamentId),
      winnerWallet
    );

    if ("error" in result) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  }
);

app.get("/api/actions/credential", (req: Request, res: Response) => {
  res.json(getActionMetadata(baseUrl(req)));
});

app.post("/api/actions/credential", async (req: Request, res: Response) => {
  const wallet = (req.body as { wallet?: string } | undefined)?.wallet;
  res.json(await runAction(wallet, baseUrl(req)));
});

app.listen(env.port, () => {
  console.log(`GameChain API listening on http://localhost:${env.port}`);
});

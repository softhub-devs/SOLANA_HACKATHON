export type UserRole = "player" | "organizer" | "admin";
export type OrganizerStatus = "none" | "pending" | "approved" | "rejected";
export type AuthIntent = "player" | "organizer";

export type SessionUser = {
  id: string;
  walletAddress: string;
  username: string | null;
  displayName: string | null;
  role: UserRole;
  organizerStatus: OrganizerStatus;
};

export type AuthChallengeResponse = {
  nonce: string;
  message: string;
  expiresAt: string;
  authIntent: AuthIntent;
};

export type AuthVerifyResponse = {
  user: SessionUser;
  session: {
    expiresAt: string;
  };
  isNewUser: boolean;
  needsOnboarding: boolean;
};

export type SessionResponse = {
  user: SessionUser;
  session: {
    expiresAt: string;
  };
};

export type OrganizerApplication = {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizerApplicationReviewItem = {
  id: string;
  userId: string;
  walletAddress: string;
  username: string | null;
  displayName: string | null;
  role: UserRole;
  organizerStatus: OrganizerStatus;
  status: "pending" | "approved" | "rejected";
  reason: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const CREDENTIAL_TYPE_ELIGIBILITY = 1;

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

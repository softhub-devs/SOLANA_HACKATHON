#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

declare_id!("BGXKsQccysQGXqUhkhQeTNbMaitepHaXFXdfp5hy45iL");

const ISSUER_REGISTRY_SEED: &[u8] = b"issuer-registry";
const ISSUER_PROFILE_SEED: &[u8] = b"issuer";
const VERIFIED_CREDENTIAL_SEED: &[u8] = b"credential";
const TOURNAMENT_STATE_SEED: &[u8] = b"tournament";
const TOURNAMENT_PARTICIPANT_SEED: &[u8] = b"tournament-participant";
const PLAYER_TOURNAMENT_BADGE_SEED: &[u8] = b"player-tournament-badge";
const MAX_ISSUER_NAME_LEN: usize = 32;
const MAX_CREDENTIAL_VALUE_LEN: usize = 32;
const MAX_METADATA_URI_LEN: usize = 96;
const MAX_TOURNAMENT_NAME_LEN: usize = 64;
const MAX_BADGE_LABEL_LEN: usize = 32;
const MIN_ISSUER_REPUTATION_FOR_REGISTRATION: u64 = 1;
const MAX_CREDENTIAL_REGISTRATION_AGE_SECONDS: i64 = 60 * 60 * 24 * 30;
const DEFAULT_ISSUER_REPUTATION_SCORE: u64 = 1;

pub const CREDENTIAL_TYPE_ELIGIBILITY: u8 = 1;
pub const CREDENTIAL_TYPE_ACHIEVEMENT: u8 = 2;
pub const CREDENTIAL_TYPE_BEHAVIOR: u8 = 3;

#[program]
pub mod gamechain {
    use super::*;

    pub fn initialize_registry(ctx: Context<InitializeRegistry>) -> Result<()> {
        let registry = &mut ctx.accounts.issuer_registry;
        registry.admin = ctx.accounts.admin.key();
        registry.total_issuers = 0;
        registry.bump = ctx.bumps.issuer_registry;
        Ok(())
    }

    pub fn authorize_issuer(ctx: Context<AuthorizeIssuer>, name: String) -> Result<()> {
        require!(
            name.len() <= MAX_ISSUER_NAME_LEN,
            GamechainError::IssuerNameTooLong
        );

        let registry = &mut ctx.accounts.issuer_registry;
        registry.total_issuers = registry.total_issuers.saturating_add(1);

        let issuer_profile = &mut ctx.accounts.issuer_profile;
        issuer_profile.authority = ctx.accounts.issuer_authority.key();
        issuer_profile.name = name;
        issuer_profile.is_active = true;
        issuer_profile.reputation_score = DEFAULT_ISSUER_REPUTATION_SCORE;
        issuer_profile.bump = ctx.bumps.issuer_profile;
        Ok(())
    }

    pub fn issue_credential(
        ctx: Context<IssueCredential>,
        credential_type: u8,
        credential_instance_id: u64,
        credential_scope_id: u64,
        credential_value: String,
        metadata_uri: String,
        expires_at: i64,
    ) -> Result<()> {
        require!(
            credential_value.len() <= MAX_CREDENTIAL_VALUE_LEN,
            GamechainError::CredentialValueTooLong
        );
        require!(
            metadata_uri.len() <= MAX_METADATA_URI_LEN,
            GamechainError::MetadataUriTooLong
        );
        require!(
            ctx.accounts.issuer_profile.is_active,
            GamechainError::IssuerNotActive
        );
        require!(
            expires_at >= Clock::get()?.unix_timestamp,
            GamechainError::InvalidExpiry
        );

        let issued_at = Clock::get()?.unix_timestamp;
        let credential = &mut ctx.accounts.verified_credential;
        credential.player = ctx.accounts.player.key();
        credential.issuer = ctx.accounts.issuer_authority.key();
        credential.credential_type = credential_type;
        credential.credential_instance_id = credential_instance_id;
        credential.credential_scope_id = credential_scope_id;
        credential.credential_value = credential_value;
        credential.metadata_uri = metadata_uri;
        credential.issued_at = issued_at;
        credential.expires_at = expires_at;
        credential.bump = ctx.bumps.verified_credential;
        Ok(())
    }

    pub fn revoke_credential(ctx: Context<RevokeCredential>) -> Result<()> {
        require!(
            ctx.accounts.issuer_profile.is_active,
            GamechainError::IssuerNotActive
        );

        ctx.accounts.verified_credential.expires_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn update_issuer_name(
        ctx: Context<UpdateIssuerName>,
        new_name: String,
    ) -> Result<()> {
        require!(
            new_name.len() <= MAX_ISSUER_NAME_LEN,
            GamechainError::IssuerNameTooLong
        );

        ctx.accounts.issuer_profile.name = new_name;
        Ok(())
    }

    pub fn create_tournament(
        ctx: Context<CreateTournament>,
        tournament_id: u64,
        name: String,
        entry_rule: u8,
        entry_credential_scope_id: u64,
        winner_token_mint: Pubkey,
        participation_token_mint: Pubkey,
    ) -> Result<()> {
        require!(
            name.len() <= MAX_TOURNAMENT_NAME_LEN,
            GamechainError::TournamentNameTooLong
        );

        let tournament = &mut ctx.accounts.tournament_state;
        tournament.tournament_id = tournament_id;
        tournament.organizer = ctx.accounts.organizer.key();
        tournament.name = name;
        tournament.entry_rule = entry_rule;
        tournament.entry_credential_scope_id = entry_credential_scope_id;
        tournament.winner_token_mint = winner_token_mint;
        tournament.participation_token_mint = participation_token_mint;
        tournament.state = TournamentStateEnum::Open;
        tournament.winner = None;
        tournament.created_at = Clock::get()?.unix_timestamp;
        tournament.completed_at = 0;
        tournament.participant_count = 0;
        tournament.bump = ctx.bumps.tournament_state;
        Ok(())
    }

    pub fn register_player(ctx: Context<RegisterPlayer>) -> Result<()> {
        let organizer = &ctx.accounts.organizer;
        let tournament = &mut ctx.accounts.tournament_state;
        let now = Clock::get()?.unix_timestamp;
        require!(
            tournament.state == TournamentStateEnum::Open
                || tournament.state == TournamentStateEnum::InProgress,
            GamechainError::TournamentNotOpen
        );
        require!(
            tournament.organizer == organizer.key(),
            GamechainError::Unauthorized
        );

        let credential = &ctx.accounts.player_credential;
        require!(
            credential.player == ctx.accounts.player.key(),
            GamechainError::PlayerCredentialMismatch
        );
        require!(
            credential.credential_type == tournament.entry_rule,
            GamechainError::PlayerIneligible
        );
        require!(
            credential.credential_scope_id == tournament.entry_credential_scope_id,
            GamechainError::CredentialScopeMismatch
        );
        require!(
            credential.expires_at > Clock::get()?.unix_timestamp,
            GamechainError::CredentialExpired
        );
        require!(
            ctx.accounts.issuer_profile.is_active,
            GamechainError::IssuerNotActive
        );
        require!(
            ctx.accounts.issuer_profile.reputation_score >= MIN_ISSUER_REPUTATION_FOR_REGISTRATION,
            GamechainError::LowTrustIssuer
        );
        require!(
            credential.issued_at >= now - MAX_CREDENTIAL_REGISTRATION_AGE_SECONDS,
            GamechainError::CredentialTooOld
        );

        let participant = &mut ctx.accounts.tournament_participant;
        participant.tournament = tournament.key();
        participant.player_wallet = ctx.accounts.player.key();
        participant.registered_at = now;
        participant.credential_verified = true;
        participant.bump = ctx.bumps.tournament_participant;

        tournament.participant_count = tournament.participant_count.saturating_add(1);
        if tournament.participant_count > 0 {
            tournament.state = TournamentStateEnum::InProgress;
        }

        Ok(())
    }

    pub fn finalize_tournament(
        ctx: Context<FinalizeTournament>,
        winner_wallet: Pubkey,
    ) -> Result<()> {
        let tournament = &mut ctx.accounts.tournament_state;

        require!(
            tournament.organizer == ctx.accounts.organizer.key(),
            GamechainError::Unauthorized
        );
        require!(
            tournament.state != TournamentStateEnum::Completed,
            GamechainError::TournamentAlreadyCompleted
        );
        require!(
            ctx.accounts.winner_participant.player_wallet == winner_wallet,
            GamechainError::WinnerNotRegistered
        );
        require!(
            ctx.accounts.winner_participant.tournament == tournament.key(),
            GamechainError::WinnerNotRegistered
        );

        tournament.winner = Some(winner_wallet);
        tournament.state = TournamentStateEnum::Completed;
        tournament.completed_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn record_tournament_badge(
        ctx: Context<RecordTournamentBadge>,
        badge_kind: u8,
        badge_label: String,
    ) -> Result<()> {
        require!(
            badge_label.len() <= MAX_BADGE_LABEL_LEN,
            GamechainError::BadgeLabelTooLong
        );

        let badge_kind = TournamentBadgeKind::try_from(badge_kind)?;
        let tournament = &ctx.accounts.tournament_state;
        require!(
            tournament.organizer == ctx.accounts.organizer.key(),
            GamechainError::Unauthorized
        );
        require!(
            tournament.state == TournamentStateEnum::Completed,
            GamechainError::TournamentNotCompleted
        );
        require!(
            ctx.accounts.tournament_participant.tournament == tournament.key(),
            GamechainError::BadgePlayerNotRegistered
        );
        require!(
            ctx.accounts.tournament_participant.player_wallet == ctx.accounts.player.key(),
            GamechainError::BadgePlayerMismatch
        );

        let token_mint = match badge_kind {
            TournamentBadgeKind::Participation => tournament.participation_token_mint,
            TournamentBadgeKind::Winner => {
                require!(
                    tournament.winner == Some(ctx.accounts.player.key()),
                    GamechainError::WinnerBadgeRequiresWinner
                );
                tournament.winner_token_mint
            }
        };

        let badge = &mut ctx.accounts.player_tournament_badge;
        badge.player = ctx.accounts.player.key();
        badge.tournament = tournament.key();
        badge.organizer = ctx.accounts.organizer.key();
        badge.badge_kind = badge_kind;
        badge.badge_label = badge_label;
        badge.token_mint = token_mint;
        badge.tournament_name = tournament.name.clone();
        badge.awarded_at = Clock::get()?.unix_timestamp;
        badge.bump = ctx.bumps.player_tournament_badge;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = IssuerRegistry::SPACE,
        seeds = [ISSUER_REGISTRY_SEED],
        bump
    )]
    pub issuer_registry: Account<'info, IssuerRegistry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AuthorizeIssuer<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [ISSUER_REGISTRY_SEED],
        bump = issuer_registry.bump,
        constraint = issuer_registry.admin == admin.key() @ GamechainError::Unauthorized
    )]
    pub issuer_registry: Account<'info, IssuerRegistry>,
    /// CHECK: PDA seed source for issuer profile authority
    pub issuer_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        space = IssuerProfile::SPACE,
        seeds = [ISSUER_PROFILE_SEED, issuer_authority.key().as_ref()],
        bump
    )]
    pub issuer_profile: Account<'info, IssuerProfile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(credential_type: u8, credential_instance_id: u64)]
pub struct IssueCredential<'info> {
    #[account(mut)]
    pub issuer_authority: Signer<'info>,
    #[account(
        seeds = [ISSUER_REGISTRY_SEED],
        bump = issuer_registry.bump
    )]
    pub issuer_registry: Account<'info, IssuerRegistry>,
    #[account(
        seeds = [ISSUER_PROFILE_SEED, issuer_authority.key().as_ref()],
        bump = issuer_profile.bump,
        constraint = issuer_profile.authority == issuer_authority.key() @ GamechainError::Unauthorized
    )]
    pub issuer_profile: Account<'info, IssuerProfile>,
    /// CHECK: player wallet receiving the credential
    pub player: UncheckedAccount<'info>,
    #[account(
        init,
        payer = issuer_authority,
        space = VerifiedCredential::SPACE,
        seeds = [
            VERIFIED_CREDENTIAL_SEED,
            player.key().as_ref(),
            issuer_authority.key().as_ref(),
            &[credential_type],
            &credential_instance_id.to_le_bytes()
        ],
        bump
    )]
    pub verified_credential: Account<'info, VerifiedCredential>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeCredential<'info> {
    pub issuer_authority: Signer<'info>,
    #[account(
        seeds = [ISSUER_PROFILE_SEED, issuer_authority.key().as_ref()],
        bump = issuer_profile.bump,
        constraint = issuer_profile.authority == issuer_authority.key() @ GamechainError::Unauthorized
    )]
    pub issuer_profile: Account<'info, IssuerProfile>,
    #[account(
        mut,
        seeds = [
            VERIFIED_CREDENTIAL_SEED,
            verified_credential.player.as_ref(),
            issuer_authority.key().as_ref(),
            &[verified_credential.credential_type],
            &verified_credential.credential_instance_id.to_le_bytes()
        ],
        bump = verified_credential.bump
    )]
    pub verified_credential: Account<'info, VerifiedCredential>,
}

#[derive(Accounts)]
pub struct UpdateIssuerName<'info> {
    pub issuer_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [ISSUER_PROFILE_SEED, issuer_authority.key().as_ref()],
        bump = issuer_profile.bump,
        constraint = issuer_profile.authority == issuer_authority.key() @ GamechainError::Unauthorized
    )]
    pub issuer_profile: Account<'info, IssuerProfile>,
}

#[derive(Accounts)]
#[instruction(tournament_id: u64)]
pub struct CreateTournament<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    #[account(
        init,
        payer = organizer,
        space = TournamentState::SPACE,
        seeds = [TOURNAMENT_STATE_SEED, organizer.key().as_ref(), &tournament_id.to_le_bytes()],
        bump
    )]
    pub tournament_state: Account<'info, TournamentState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterPlayer<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    /// CHECK: organizer-managed registration for an eligible player wallet
    pub player: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [
            TOURNAMENT_STATE_SEED,
            tournament_state.organizer.as_ref(),
            &tournament_state.tournament_id.to_le_bytes()
        ],
        bump = tournament_state.bump
    )]
    pub tournament_state: Account<'info, TournamentState>,
    #[account(
        seeds = [
            VERIFIED_CREDENTIAL_SEED,
            player.key().as_ref(),
            player_credential.issuer.as_ref(),
            &[player_credential.credential_type],
            &player_credential.credential_instance_id.to_le_bytes()
        ],
        bump = player_credential.bump
    )]
    pub player_credential: Account<'info, VerifiedCredential>,
    #[account(
        seeds = [ISSUER_PROFILE_SEED, player_credential.issuer.as_ref()],
        bump = issuer_profile.bump,
        constraint = issuer_profile.authority == player_credential.issuer @ GamechainError::InvalidCredentialIssuer
    )]
    pub issuer_profile: Account<'info, IssuerProfile>,
    #[account(
        init,
        payer = organizer,
        space = TournamentParticipant::SPACE,
        seeds = [TOURNAMENT_PARTICIPANT_SEED, tournament_state.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub tournament_participant: Account<'info, TournamentParticipant>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeTournament<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    #[account(
        mut,
        seeds = [
            TOURNAMENT_STATE_SEED,
            organizer.key().as_ref(),
            &tournament_state.tournament_id.to_le_bytes()
        ],
        bump = tournament_state.bump
    )]
    pub tournament_state: Account<'info, TournamentState>,
    #[account(
        seeds = [
            TOURNAMENT_PARTICIPANT_SEED,
            tournament_state.key().as_ref(),
            winner_participant.player_wallet.as_ref()
        ],
        bump = winner_participant.bump
    )]
    pub winner_participant: Account<'info, TournamentParticipant>,
}

#[derive(Accounts)]
#[instruction(badge_kind: u8)]
pub struct RecordTournamentBadge<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    #[account(
        mut,
        seeds = [
            TOURNAMENT_STATE_SEED,
            organizer.key().as_ref(),
            &tournament_state.tournament_id.to_le_bytes()
        ],
        bump = tournament_state.bump
    )]
    pub tournament_state: Account<'info, TournamentState>,
    /// CHECK: player receiving the on-chain badge history record
    pub player: UncheckedAccount<'info>,
    #[account(
        seeds = [
            TOURNAMENT_PARTICIPANT_SEED,
            tournament_state.key().as_ref(),
            player.key().as_ref()
        ],
        bump = tournament_participant.bump
    )]
    pub tournament_participant: Account<'info, TournamentParticipant>,
    #[account(
        init,
        payer = organizer,
        space = PlayerTournamentBadge::SPACE,
        seeds = [
            PLAYER_TOURNAMENT_BADGE_SEED,
            tournament_state.key().as_ref(),
            player.key().as_ref(),
            &[badge_kind]
        ],
        bump
    )]
    pub player_tournament_badge: Account<'info, PlayerTournamentBadge>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct IssuerRegistry {
    pub admin: Pubkey,
    pub total_issuers: u32,
    pub bump: u8,
}

impl IssuerRegistry {
    pub const SPACE: usize = 8 + 32 + 4 + 1;
}

#[account]
pub struct IssuerProfile {
    pub authority: Pubkey,
    pub name: String,
    pub is_active: bool,
    pub reputation_score: u64,
    pub bump: u8,
}

impl IssuerProfile {
    pub const SPACE: usize = 8 + 32 + 4 + MAX_ISSUER_NAME_LEN + 1 + 8 + 1;
}

#[account]
pub struct VerifiedCredential {
    pub player: Pubkey,
    pub issuer: Pubkey,
    pub credential_type: u8,
    pub credential_instance_id: u64,
    pub credential_scope_id: u64,
    pub credential_value: String,
    pub metadata_uri: String,
    pub issued_at: i64,
    pub expires_at: i64,
    pub bump: u8,
}

impl VerifiedCredential {
    pub const SPACE: usize = 8
        + 32
        + 32
        + 1
        + 8
        + 8
        + 4
        + MAX_CREDENTIAL_VALUE_LEN
        + 4
        + MAX_METADATA_URI_LEN
        + 8
        + 8
        + 1;
}

#[account]
pub struct TournamentState {
    pub tournament_id: u64,
    pub organizer: Pubkey,
    pub name: String,
    pub entry_rule: u8,
    pub entry_credential_scope_id: u64,
    pub winner_token_mint: Pubkey,
    pub participation_token_mint: Pubkey,
    pub state: TournamentStateEnum,
    pub winner: Option<Pubkey>,
    pub created_at: i64,
    pub completed_at: i64,
    pub participant_count: u32,
    pub bump: u8,
}

impl TournamentState {
    pub const SPACE: usize = 8
        + 8
        + 32
        + 4
        + MAX_TOURNAMENT_NAME_LEN
        + 1
        + 8
        + 32
        + 32
        + 1
        + 1
        + 32
        + 8
        + 8
        + 4
        + 1;
}

#[account]
pub struct TournamentParticipant {
    pub tournament: Pubkey,
    pub player_wallet: Pubkey,
    pub registered_at: i64,
    pub credential_verified: bool,
    pub bump: u8,
}

impl TournamentParticipant {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 1 + 1;
}

#[account]
pub struct PlayerTournamentBadge {
    pub player: Pubkey,
    pub tournament: Pubkey,
    pub organizer: Pubkey,
    pub badge_kind: TournamentBadgeKind,
    pub badge_label: String,
    pub token_mint: Pubkey,
    pub tournament_name: String,
    pub awarded_at: i64,
    pub bump: u8,
}

impl PlayerTournamentBadge {
    pub const SPACE: usize = 8
        + 32
        + 32
        + 32
        + 1
        + 4
        + MAX_BADGE_LABEL_LEN
        + 32
        + 4
        + MAX_TOURNAMENT_NAME_LEN
        + 8
        + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum TournamentStateEnum {
    Open,
    InProgress,
    Completed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum TournamentBadgeKind {
    Participation,
    Winner,
}

impl TryFrom<u8> for TournamentBadgeKind {
    type Error = anchor_lang::error::Error;

    fn try_from(value: u8) -> Result<Self> {
        match value {
            0 => Ok(Self::Participation),
            1 => Ok(Self::Winner),
            _ => err!(GamechainError::InvalidBadgeKind),
        }
    }
}

#[error_code]
pub enum GamechainError {
    #[msg("Only the registry admin can perform this action.")]
    Unauthorized,
    #[msg("Issuer name exceeds the maximum length.")]
    IssuerNameTooLong,
    #[msg("Credential value exceeds the maximum length.")]
    CredentialValueTooLong,
    #[msg("Metadata URI exceeds the maximum length.")]
    MetadataUriTooLong,
    #[msg("Credential expiry must be in the future.")]
    InvalidExpiry,
    #[msg("Issuer is not active and cannot issue credentials.")]
    IssuerNotActive,
    #[msg("Tournament name exceeds the maximum length.")]
    TournamentNameTooLong,
    #[msg("Tournament is not open for player registration.")]
    TournamentNotOpen,
    #[msg("Player does not satisfy the tournament entry rule.")]
    PlayerIneligible,
    #[msg("Credential has expired.")]
    CredentialExpired,
    #[msg("Credential scope does not satisfy the tournament requirement.")]
    CredentialScopeMismatch,
    #[msg("Credential is too old for tournament registration.")]
    CredentialTooOld,
    #[msg("Credential does not belong to the player.")]
    PlayerCredentialMismatch,
    #[msg("Credential issuer does not match the provided issuer profile.")]
    InvalidCredentialIssuer,
    #[msg("Issuer reputation is too low for tournament registration.")]
    LowTrustIssuer,
    #[msg("Tournament has already been completed.")]
    TournamentAlreadyCompleted,
    #[msg("Tournament must be completed before recording badges.")]
    TournamentNotCompleted,
    #[msg("Winner must be a registered player.")]
    WinnerNotRegistered,
    #[msg("Badge kind is invalid.")]
    InvalidBadgeKind,
    #[msg("Badge label exceeds the maximum length.")]
    BadgeLabelTooLong,
    #[msg("Participant record does not belong to the expected player.")]
    BadgePlayerMismatch,
    #[msg("Player is not registered in the tournament.")]
    BadgePlayerNotRegistered,
    #[msg("Winner badge can only be recorded for the tournament winner.")]
    WinnerBadgeRequiresWinner,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn issuer_registry_space_matches_fields() {
        assert_eq!(IssuerRegistry::SPACE, 45);
    }

    #[test]
    fn issuer_profile_space_matches_fields() {
        assert_eq!(IssuerProfile::SPACE, 86);
    }

    #[test]
    fn verified_credential_space_matches_fields() {
        assert_eq!(VerifiedCredential::SPACE, 242);
    }

    #[test]
    fn tournament_state_space_matches_fields() {
        assert_eq!(TournamentState::SPACE, 244);
    }

    #[test]
    fn tournament_participant_space_matches_fields() {
        assert_eq!(TournamentParticipant::SPACE, 82);
    }

    #[test]
    fn player_tournament_badge_space_matches_fields() {
        assert_eq!(PlayerTournamentBadge::SPACE, 250);
    }

    #[test]
    fn badge_kind_parser_accepts_expected_variants() {
        assert_eq!(
            TournamentBadgeKind::try_from(0).unwrap(),
            TournamentBadgeKind::Participation
        );
        assert_eq!(
            TournamentBadgeKind::try_from(1).unwrap(),
            TournamentBadgeKind::Winner
        );
        assert!(TournamentBadgeKind::try_from(99).is_err());
    }
}

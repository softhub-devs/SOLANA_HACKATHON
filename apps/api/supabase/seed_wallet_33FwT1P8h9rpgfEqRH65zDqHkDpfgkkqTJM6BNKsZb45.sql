create table if not exists public.verified_credentials (
  player_wallet text not null,
  credential_type integer not null,
  credential_instance_id text not null,
  credential_scope_id text not null,
  credential_value text not null,
  issuer text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  metadata_uri text not null,
  transaction_signature text not null,
  trust_model text not null default 'issuer-backed' check (trust_model in ('issuer-backed')),
  game_id text not null,
  game_level integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (player_wallet, credential_type, credential_scope_id)
);

create unique index if not exists verified_credentials_instance_id_idx
  on public.verified_credentials (credential_instance_id);

create index if not exists verified_credentials_player_wallet_idx
  on public.verified_credentials (player_wallet, issued_at desc);

insert into public.verified_credentials (
  player_wallet,
  credential_type,
  credential_instance_id,
  credential_scope_id,
  credential_value,
  issuer,
  issued_at,
  expires_at,
  metadata_uri,
  transaction_signature,
  trust_model,
  game_id,
  game_level
)
values (
  '33FwT1P8h9rpgfEqRH65zDqHkDpfgkkqTJM6BNKsZb45',
  1,
  '7298257098084660209',
  '0',
  'demo-player-001 · Level 1 Verified',
  'gamechain-trusted-issuer',
  timezone('utc', now()),
  timezone('utc', now()) + interval '7 days',
  '/credentials/33FwT1P8h9rpgfEqRH65zDqHkDpfgkkqTJM6BNKsZb45',
  'seed_sig_33fwt1p8_1',
  'issuer-backed',
  'demo-player-001',
  1
)
on conflict (player_wallet, credential_type, credential_scope_id)
do update set
  credential_instance_id = excluded.credential_instance_id,
  credential_value = excluded.credential_value,
  issuer = excluded.issuer,
  issued_at = excluded.issued_at,
  expires_at = excluded.expires_at,
  metadata_uri = excluded.metadata_uri,
  transaction_signature = excluded.transaction_signature,
  trust_model = excluded.trust_model,
  game_id = excluded.game_id,
  game_level = excluded.game_level;

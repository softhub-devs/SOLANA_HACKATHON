create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  username text unique,
  password_hash text,
  display_name text,
  role text not null default 'player' check (role in ('player', 'organizer', 'admin')),
  organizer_status text not null default 'none' check (
    organizer_status in ('none', 'pending', 'approved', 'rejected')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.auth_challenges (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  nonce text not null unique,
  message text not null,
  expires_at timestamptz not null,
  is_consumed boolean not null default false,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists auth_challenges_wallet_nonce_idx
  on public.auth_challenges (wallet_address, nonce);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);

create table if not exists public.organizer_apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text not null,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at
before update on public.users
for each row execute procedure public.touch_updated_at();

drop trigger if exists organizer_apps_touch_updated_at on public.organizer_apps;
create trigger organizer_apps_touch_updated_at
before update on public.organizer_apps
for each row execute procedure public.touch_updated_at();

create table if not exists public.tournaments (
  id text primary key,
  name text not null,
  organizer_name text not null,
  organizer_wallet text not null,
  entry_credential_type integer not null,
  entry_credential_scope_id text not null,
  entry_rule_label text not null,
  winner_token_name text not null,
  participation_token_name text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed')),
  participant_count integer not null default 0,
  winner_wallet text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create table if not exists public.tournament_registrations (
  tournament_id text not null references public.tournaments(id) on delete cascade,
  wallet text not null,
  credential_type integer not null,
  credential_instance_id text not null,
  credential_scope_id text not null,
  credential_value text not null,
  issuer text not null,
  expires_at timestamptz not null,
  registered_at timestamptz not null default timezone('utc', now()),
  primary key (tournament_id, wallet)
);

create index if not exists tournament_registrations_tournament_id_idx
  on public.tournament_registrations (tournament_id);

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

create table if not exists public.tournament_achievements (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tournaments(id) on delete cascade,
  wallet text not null,
  badge_kind text not null check (badge_kind in ('participation', 'winner')),
  badge_label text not null,
  awarded_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tournament_id, wallet, badge_kind)
);

create index if not exists tournament_achievements_wallet_idx
  on public.tournament_achievements (wallet, awarded_at desc);

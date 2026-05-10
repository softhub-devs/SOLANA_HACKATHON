# GameChain

**Verifiable on-chain credentials for competitive gaming — starting with Clash of Clans.**

Tournament organizers verify player eligibility via screenshots and spreadsheets today. GameChain replaces that with issuer-signed, instantly verifiable credentials on Solana.

---

## Architecture

| Layer | Stack | What It Does |
|-------|-------|--------------|
| Frontend | Next.js 15 + Tailwind | Landing page, wallet connect, credential profiles, player/organizer/admin login, tournament dashboard |
| Backend | Express + TypeScript | Auth (challenge-based + password), credential issuance, tournament CRUD, eligibility checks, Supabase storage |
| On-chain | Anchor (Solana) | Issuer registry, credential issuance/revocation, tournament lifecycle, player tournament badges |

---

## MVP Scope

- One trusted issuer (backend signs credential transactions)
- On-chain credential write + tournament registration
- Organizer dashboard for verification
- Wallet-based player profiles

---

## Repo Structure

```
apps/
├── web/              # Next.js frontend
│   ├── app/
│   │   ├── login/        # player, organizer, admin auth pages
│   │   ├── organizers/demo/  # organizer verification dashboard
│   │   ├── credentials/      # player credential profiles
│   │   └── api/              # route handlers → backend proxy
│   └── lib/              # API client, on-chain helpers, auth
└── api/               # Express backend
    └── src/
        ├── index.ts        # routes + server
        ├── auth.ts         # session + challenge auth
        ├── demoIssuer.ts   # credential issuance + tournament logic
        ├── storage.ts      # Supabase queries
        └── env.ts          # env validation
programs/
└── gamechain/         # Anchor program (issuer + credentials + tournaments)
tests/
└── gamechain.ts       # Anchor integration tests
```

---

## Vision

Tournament eligibility credentials today → portable competitive gaming reputation layer tomorrow. Credentials that are verifiable, portable, and programmable — for organizers and players across any game.
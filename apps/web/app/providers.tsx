"use client";

import { createClient, phantom } from "@solana/client";
import { SolanaProvider } from "@solana/react-hooks";

const endpoint =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
  "https://api.devnet.solana.com";
const websocketEndpoint =
  process.env.NEXT_PUBLIC_SOLANA_WS_URL?.trim() ||
  endpoint.replace(/^http/i, "ws");

const client = createClient({
  endpoint,
  websocketEndpoint,
  walletConnectors: phantom(),
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <SolanaProvider client={client}>{children}</SolanaProvider>;
}

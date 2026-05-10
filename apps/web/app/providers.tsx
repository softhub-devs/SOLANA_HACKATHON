"use client";

import { createClient, phantom } from "@solana/client";
import { SolanaProvider } from "@solana/react-hooks";

const client = createClient({
  endpoint: "https://api.devnet.solana.com",
  websocketEndpoint: "wss://api.devnet.solana.com",
  walletConnectors: phantom(),
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <SolanaProvider client={client}>{children}</SolanaProvider>;
}

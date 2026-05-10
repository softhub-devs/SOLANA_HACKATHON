import { OrganizerDemoClient } from "./OrganizerDemoClient";

export const dynamic = "force-dynamic";

export default async function OrganizerDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ wallet?: string }>;
}) {
  const { wallet } = await searchParams;
  return <OrganizerDemoClient initialWallet={wallet ?? ""} />;
}

import { cookies } from "next/headers";
import {
  Building2,
  ShieldCheck
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import type { SessionResponse } from "@/lib/apiTypes";

type Props = {
  params: Promise<{
    orgId: string;
  }>;
};

export default async function OrganizationPage({ params }: Props) {
  const { orgId } = await params;
  const cookieStore = await cookies();
  const sessionResponse = await fetch(`${API_BASE_URL}/auth/session`, {
    headers: {
      cookie: cookieStore.toString(),
    },
    cache: "no-store",
  });

  let organizerName = orgId;
  let organizerWallet = "";
  if (sessionResponse.ok) {
    const session = (await sessionResponse.json()) as SessionResponse;
    organizerName =
      session.user.displayName ??
      session.user.username ??
      session.user.orgId ??
      orgId;
    organizerWallet = session.user.walletAddress;
  }


  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-4xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),rgba(15,23,42,0.78)_45%,rgba(2,6,23,0.96))]">
        <div className="flex flex-col gap-8 p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-400/10">
                <Building2 className="h-9 w-9 text-cyan-300" />
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
                  Organizer Profile
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-white">
                  {organizerName}
                </h1>
                {organizerWallet ? (
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {organizerWallet}
                  </p>
                ) : null}
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Manage tournaments, verify players, and issue trusted credentials
                  from one organizer workspace.
                </p>
              </div>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Verified issuer
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

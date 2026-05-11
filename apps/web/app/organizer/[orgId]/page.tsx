"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Building2, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { SessionResponse } from "@/lib/apiTypes";

export default function OrganizationPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const [organizerName, setOrganizerName] = useState(orgId);
  const [organizerWallet, setOrganizerWallet] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const session = await apiFetch<SessionResponse>("/auth/session");
        if (!mounted) {
          return;
        }

        setOrganizerName(
          session.user.displayName ?? session.user.username ?? session.user.orgId ?? orgId
        );
        setOrganizerWallet(session.user.walletAddress ?? "");
      } catch {
        if (!mounted) {
          return;
        }

        setOrganizerName(orgId);
        setOrganizerWallet("");
      }
    }

    void loadSession();

    return () => {
      mounted = false;
    };
  }, [orgId]);

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

"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  ShieldCheck,
  Medal,
  User,
  Settings,
  Bell,
  Search,
  LogOut,
  Swords,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import type { SessionResponse } from "@/lib/apiTypes";

function getSidebarItems(userId: string | null) {
  const dashboardHref = userId ? `/player/${userId}` : "/player";
  const achievementsHref = userId
    ? `/player/${userId}/achievements`
    : "/player";

  return [
    {
      label: "Dashboard",
      href: dashboardHref,
      icon: LayoutDashboard,
      disabled: false,
    },
    {
      label: "Achievements",
      href: achievementsHref,
      icon: Trophy,
      disabled: !userId,
    },
    {
      label: "Credentials",
      href: "#",
      icon: ShieldCheck,
      disabled: true,
    },
    {
      label: "Matches",
      href: "#",
      icon: Swords,
      disabled: true,
    },
    {
      label: "Profile",
      href: "#",
      icon: User,
      disabled: true,
    },
    {
      label: "Ranking",
      href: "#",
      icon: Medal,
      disabled: true,
    },
    {
      label: "Settings",
      href: "#",
      icon: Settings,
      disabled: true,
    },
  ];
}

export default function PlayerDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  const params = useParams<{ userId?: string | string[] }>();

  const routeUserId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;

  const [storedUserId, setStoredUserId] = useState<string | null>(null);

  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    if (routeUserId) {
      localStorage.setItem("gamechain_player_user_id", routeUserId);
      setStoredUserId(routeUserId);
      return;
    }

    const saved = localStorage.getItem("gamechain_player_user_id");
    setStoredUserId(saved);
  }, [routeUserId]);

  useEffect(() => {
    if (routeUserId || storedUserId) {
      return;
    }

    let mounted = true;

    async function syncPlayerId() {
      try {
        const payload = await apiFetch<SessionResponse>("/auth/session");

        if (!payload.user.id || !mounted) {
          return;
        }

        localStorage.setItem(
          "gamechain_player_user_id",
          payload.user.id
        );

        setStoredUserId(payload.user.id);
      } catch {
        if (mounted) {
          setStoredUserId(null);
        }
      }
    }

    void syncPlayerId();

    return () => {
      mounted = false;
    };
  }, [routeUserId, storedUserId]);

  const userId = routeUserId ?? storedUserId;

  const sidebarItems = getSidebarItems(userId ?? null);

  async function handleLogout() {
    setLogoutLoading(true);

    try {
      await apiFetch<void>("/auth/logout", {
        method: "POST",
      });
    } catch {
      // ignore
    } finally {
      localStorage.removeItem("gamechain_player_user_id");

      setStoredUserId(null);

      setLogoutLoading(false);

      router.push("/");
    }
  }

  return (
    <div className="flex min-h-screen bg-[#020617] text-white">
      {/* SIDEBAR */}
      <aside className="hidden border-r border-white/10 bg-slate-950/70 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[270px] lg:flex-col lg:overflow-y-auto">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15">
              <ShieldCheck className="h-6 w-6 text-cyan-300" />
            </div>

            <div>
              <p className="text-lg font-semibold">GameChain</p>

              <p className="text-xs text-slate-400">
                Player Dashboard
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {sidebarItems.map((item) => {
            const Icon = item.icon;

            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-500 opacity-60"
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutLoading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-4 text-sm font-semibold text-red-100 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-5 w-5" />

            {logoutLoading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOPBAR */}
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#020617]/80 backdrop-blur-xl">
          <div className="flex h-[76px] items-center justify-between px-6">
            {/* LEFT */}
            <div>
              <p className="text-sm text-slate-400">
                GameChain / Player
                {userId ? ` / ${userId}` : ""}
              </p>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 lg:flex">
                <Search className="h-4 w-4 text-slate-400" />

                <input
                  placeholder="Search..."
                  className="bg-transparent text-sm outline-none placeholder:text-slate-500"
                />
              </div>

              <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition hover:bg-white/10">
                <Bell className="h-5 w-5 text-slate-300" />
              </button>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

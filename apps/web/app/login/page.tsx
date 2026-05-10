import Link from "next/link";

const options = [
  {
    href: "/login/player",
    title: "Player login",
    copy: "Connect wallet, sign the challenge, and enter your player dashboard.",
    tone: "border-[#f3c677]/30 bg-[#f3c677]/10 text-[#fff2db]",
  },
  {
    href: "/login/organizer",
    title: "Organizer login",
    copy: "Use the organizer-only access path to manage tournaments and verify players.",
    tone: "border-[#8de3f0]/30 bg-[#8de3f0]/10 text-[#e4fbff]",
  },
  {
    href: "/login/admin",
    title: "Admin login",
    copy: "Review organizer requests, approve trusted wallets, and manage access.",
    tone: "border-[#a78bfa]/30 bg-[#a78bfa]/10 text-[#f1eaff]",
  },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#111827_0%,#0f172a_46%,#1f2937_100%)] px-6 py-10 text-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Login
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              Choose the right sign-in flow
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Player and organizer access are intentionally separated so each role lands
              in the right experience.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white"
          >
            Back home
          </Link>
        </div>

        <section className="grid gap-5 md:grid-cols-3">
          {options.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              className={`rounded-[28px] border p-6 transition hover:-translate-y-0.5 ${option.tone}`}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.22em]">
                Access
              </p>
              <h2 className="mt-4 text-2xl font-semibold">{option.title}</h2>
              <p className="mt-3 text-sm leading-7 opacity-90">{option.copy}</p>
              <span className="mt-6 inline-flex rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-950">
                Open
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}

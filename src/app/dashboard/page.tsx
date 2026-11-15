import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <span className="font-semibold text-slate-900">Marina Shore Power</span>
          <div className="flex items-center gap-3">
            {user.role === "admin" ? (
              <Link
                href="/admin"
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Admin panel
              </Link>
            ) : null}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <DashboardClient />
      </main>
    </div>
  );
}

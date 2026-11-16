import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <span className="font-semibold text-ink">Marina Shore Power</span>
          <div className="flex items-center gap-3">
            {user.role === "admin" ? (
              <Link
                href="/admin"
                className="text-sm text-ink-muted hover:text-ink"
              >
                Admin panel
              </Link>
            ) : null}
            <ThemeToggle />
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

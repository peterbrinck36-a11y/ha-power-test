import Link from "next/link";
import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/auth";

import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-ink">Marina Admin</span>
            <Link href="/admin/users" className="text-ink-muted hover:text-ink">
              Users
            </Link>
            <Link href="/admin/meters" className="text-ink-muted hover:text-ink">
              Meters
            </Link>
            <Link href="/admin/reports" className="text-ink-muted hover:text-ink">
              Reports
            </Link>
            <Link href="/admin/settings" className="text-ink-muted hover:text-ink">
              Settings
            </Link>
            <Link href="/admin/debug" className="text-ink-muted hover:text-ink">
              Debug
            </Link>
            <Link href="/dashboard" className="text-ink-muted hover:text-ink">
              Owner view
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}

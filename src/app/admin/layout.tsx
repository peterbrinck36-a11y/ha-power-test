import Link from "next/link";
import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/auth";

import { LogoutButton } from "@/components/logout-button";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <span className="font-semibold text-slate-900">Marina Admin</span>
            <Link href="/admin/users" className="text-slate-600 hover:text-slate-900">
              Users
            </Link>
            <Link href="/admin/meters" className="text-slate-600 hover:text-slate-900">
              Meters
            </Link>
            <Link href="/admin/settings" className="text-slate-600 hover:text-slate-900">
              Settings
            </Link>
            <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
              Owner view
            </Link>
          </nav>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}

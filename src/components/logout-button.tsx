"use client";

import { logout } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-secondary hover:bg-surface-muted"
      >
        Sign out
      </button>
    </form>
  );
}

import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSessionUser } from "@/lib/auth";

import { SetPasswordForm } from "./set-password-form";

export const metadata = { title: "Choose your password — Marina Shore Power" };

export default async function AccountPasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) {
    redirect(user.role === "admin" ? "/admin" : "/dashboard");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Choose your password</h1>
            <p className="mt-1 text-sm text-ink-muted">Signed in as {user.username}.</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <p className="mb-5 text-sm text-ink-muted">
            Your account was created with a temporary password. Choose your own password to
            continue.
          </p>
          <SetPasswordForm />
        </div>
      </div>
    </main>
  );
}

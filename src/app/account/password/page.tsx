import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
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
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Choose your password</h1>
            <p className="mt-1 text-sm text-slate-600">Signed in as {user.username}.</p>
          </div>
          <LogoutButton />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-5 text-sm text-slate-600">
            Your account was created with a temporary password. Choose your own password to
            continue.
          </p>
          <SetPasswordForm />
        </div>
      </div>
    </main>
  );
}

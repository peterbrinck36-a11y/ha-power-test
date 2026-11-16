import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/dashboard");
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-ink">Marina Shore Power</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Sign in to monitor your boat&apos;s power usage
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

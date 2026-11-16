"use client";

import { useActionState } from "react";

import { initialFormState } from "@/lib/forms";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

import { setPassword } from "./actions";

const inputClasses =
  "mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";
const primaryButtonClasses =
  "w-full rounded-lg bg-sky-600 dark:bg-sky-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-700 dark:hover:bg-sky-600 disabled:opacity-60";

export function SetPasswordForm() {
  const [state, formAction, pending] = useActionState(setPassword, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-ink-secondary">
          New password
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className={inputClasses}
        />
        <p className="mt-1 text-xs text-ink-muted">
          At least {MIN_PASSWORD_LENGTH} characters. A passphrase of a few words works well.
        </p>
      </div>

      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-ink-secondary">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          name="confirm"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className={inputClasses}
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={primaryButtonClasses}>
        {pending ? "Saving…" : "Save password and continue"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";

import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

const inputClasses =
  "mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2.5 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form
      action={formAction}
      className="w-full space-y-5 rounded-2xl bg-surface p-8 shadow-lg"
    >
      <div>
        <label htmlFor="identifier" className="block text-sm font-medium text-ink-secondary">
          Email or username
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          required
          autoFocus
          autoComplete="username"
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink-secondary">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClasses}
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-sky-600 dark:bg-sky-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-sky-700 dark:hover:bg-sky-600 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

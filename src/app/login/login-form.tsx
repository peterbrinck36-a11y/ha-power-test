"use client";

import { useActionState } from "react";

import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

const inputClasses =
  "mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form
      action={formAction}
      className="w-full space-y-5 rounded-2xl bg-white p-8 shadow-lg"
    >
      <div>
        <label htmlFor="identifier" className="block text-sm font-medium text-slate-700">
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
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
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
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

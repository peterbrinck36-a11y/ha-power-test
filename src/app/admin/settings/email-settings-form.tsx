"use client";

import { useActionState } from "react";

import { initialFormState } from "@/lib/forms";

import { saveEmailSettingsAction, sendTestEmailAction } from "./actions";

const inputClasses =
  "mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";
const primaryButtonClasses =
  "rounded-lg bg-sky-600 dark:bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 dark:hover:bg-sky-600 disabled:opacity-60";
const secondaryButtonClasses =
  "rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm text-ink-secondary hover:bg-surface-muted disabled:opacity-60";

export type EmailSettingsView = {
  address: string;
  fromName: string;
  hasPassword: boolean;
  passwordReadable: boolean;
};

export function EmailSettingsForm({ settings }: { settings: EmailSettingsView }) {
  const [state, formAction, pending] = useActionState(
    saveEmailSettingsAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email-address" className="block text-sm font-medium text-ink-secondary">
          Gmail address
        </label>
        <input
          id="email-address"
          name="address"
          type="email"
          required
          defaultValue={settings.address}
          placeholder="marina.shorepower@gmail.com"
          className={inputClasses}
        />
        <p className="mt-1 text-xs text-ink-muted">
          The account that sends the emails. Its address is the visible sender.
        </p>
      </div>

      <div>
        <label htmlFor="email-from-name" className="block text-sm font-medium text-ink-secondary">
          Sender name
        </label>
        <input
          id="email-from-name"
          name="fromName"
          type="text"
          defaultValue={settings.fromName}
          placeholder="Marina Shore Power"
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="email-app-password" className="block text-sm font-medium text-ink-secondary">
          Google app password
        </label>
        <input
          id="email-app-password"
          name="appPassword"
          type="password"
          autoComplete="new-password"
          placeholder={
            settings.hasPassword ? "Stored — leave blank to keep it" : "16 letters from Google"
          }
          className={inputClasses}
        />
        <p className="mt-1 text-xs text-ink-muted">
          Create it at myaccount.google.com/apppasswords (2-Step Verification required). Stored
          encrypted; it is never shown again.
        </p>
      </div>

      <div className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink-muted">
        {settings.hasPassword && settings.passwordReadable ? (
          <span className="text-emerald-700 dark:text-emerald-300">Email is configured.</span>
        ) : settings.hasPassword ? (
          <span className="text-amber-700 dark:text-amber-300">
            A password is stored but cannot be decrypted (the signing secret changed) — enter it
            again.
          </span>
        ) : (
          <span className="text-amber-700 dark:text-amber-300">Email is not configured yet.</span>
        )}
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.notice ? (
        <p role="status" className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {state.notice}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={primaryButtonClasses}>
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}

export function TestEmailForm({ defaultRecipient }: { defaultRecipient: string }) {
  const [state, formAction, pending] = useActionState(sendTestEmailAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="test-email-to" className="block text-sm font-medium text-ink-secondary">
          Send a test email to
        </label>
        <input
          id="test-email-to"
          name="to"
          type="email"
          required
          defaultValue={defaultRecipient}
          className={inputClasses}
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.notice ? (
        <p role="status" className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {state.notice}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={secondaryButtonClasses}>
          {pending ? "Sending…" : "Send test email"}
        </button>
      </div>
    </form>
  );
}

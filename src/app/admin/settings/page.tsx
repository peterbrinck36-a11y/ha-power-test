import { requireAdmin } from "@/lib/auth";
import { getPublicEmailSettings } from "@/lib/email/settings";

import { EmailSettingsForm, TestEmailForm } from "./email-settings-form";

export const metadata = { title: "Email settings — Marina Admin" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = getPublicEmailSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Email settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Marina Shore Power sends account invitations through a Gmail account and a Google app
          password. Nothing is sent until these settings are saved.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Gmail sender</h2>
        <p className="mt-1 mb-5 text-sm text-slate-600">
          Enable 2-Step Verification on the Google account, then create an app password at{" "}
          <span className="font-mono text-xs">myaccount.google.com/apppasswords</span>. Use that
          16-letter password here — never the normal account password.
        </p>
        <EmailSettingsForm settings={settings} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Test sending</h2>
        <p className="mt-1 mb-5 text-sm text-slate-600">
          Sends one message so you can confirm Gmail accepts the credentials. Gmail limits
          free accounts to roughly 500 recipients per day.
        </p>
        <TestEmailForm defaultRecipient={settings.address} />
      </section>
    </div>
  );
}

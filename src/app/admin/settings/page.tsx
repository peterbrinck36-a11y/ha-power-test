import { requireAdmin } from "@/lib/auth";
import { getPublicEmailSettings } from "@/lib/email/settings";
import { CategoriesSection } from "@/components/admin/categories-section";

import { EmailSettingsForm, TestEmailForm } from "./email-settings-form";

export const metadata = { title: "Settings — Marina Admin" };

const tabs = [{ key: "advanced", label: "Advanced" }] as const;

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = getPublicEmailSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Marina-wide configuration. Changes apply immediately — no restart needed.
        </p>
      </div>

      <nav aria-label="Settings tabs" className="flex gap-1 border-b border-line">
        {tabs.map((tab) => (
          <span
            key={tab.key}
            aria-current="page"
            className="border-b-2 border-sky-500 px-3 py-2 text-sm font-medium text-ink"
          >
            {tab.label}
          </span>
        ))}
      </nav>

      <div role="tabpanel" aria-label="Advanced settings" className="space-y-6">
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold text-ink">Email sending</h2>
          <p className="mt-1 mb-5 text-sm text-ink-muted">
            Marina Shore Power sends account invitations through a Gmail account and a
            Google app password. Nothing is sent until these settings are saved.
          </p>
          <EmailSettingsForm settings={settings} />
        </section>

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold text-ink">Test sending</h2>
          <p className="mt-1 mb-5 text-sm text-ink-muted">
            Sends one message so you can confirm Gmail accepts the credentials. Gmail limits
            free accounts to roughly 500 recipients per day.
          </p>
          <TestEmailForm defaultRecipient={settings.address} />
        </section>

        <CategoriesSection />
      </div>
    </div>
  );
}

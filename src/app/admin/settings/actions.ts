"use server";

import { revalidatePath } from "next/cache";

import { getAppUrl } from "@/lib/app-url";
import { requireAdmin } from "@/lib/auth";
import { describeEmailError, sendEmail } from "@/lib/email/client";
import { getEmailSettings, saveEmailSettings } from "@/lib/email/settings";
import { testEmail } from "@/lib/email/templates";
import { type FormState } from "@/lib/forms";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function hasStoredPassword(): boolean {
  try {
    return Boolean(getEmailSettings().appPassword);
  } catch {
    // Undecryptable stored value counts as missing — the admin must re-enter it.
    return false;
  }
}

export async function saveEmailSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const address = str(formData, "address").toLowerCase();
  const fromName = str(formData, "fromName");
  const appPassword = str(formData, "appPassword").replace(/\s+/g, "");

  if (!EMAIL_RE.test(address)) return { error: "Enter a valid email address.", ok: false };
  if (!address.endsWith("@gmail.com") && !address.endsWith("@googlemail.com")) {
    return {
      error:
        "Gmail SMTP signs in as a Gmail account — use a @gmail.com or @googlemail.com address.",
      ok: false,
    };
  }
  if (appPassword && !/^[a-zA-Z]{12,64}$/.test(appPassword)) {
    return {
      error: "App passwords are 16 letters (spaces are fine). Paste the one Google generated.",
      ok: false,
    };
  }
  if (!appPassword && !hasStoredPassword()) {
    return { error: "Enter the Google app password (16 letters).", ok: false };
  }

  try {
    saveEmailSettings({
      address,
      fromName,
      appPassword: appPassword || null,
    });
  } catch (err) {
    return { error: describeEmailError(err), ok: false };
  }

  revalidatePath("/admin/settings");
  return { error: null, ok: true, notice: "Email settings saved." };
}

export async function sendTestEmailAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const to = str(formData, "to").toLowerCase();
  if (!EMAIL_RE.test(to)) return { error: "Enter a valid recipient address.", ok: false };

  try {
    const appUrl = await getAppUrl();
    const result = await sendEmail(testEmail({ to, appUrl }));
    return {
      error: null,
      ok: true,
      emailSent: true,
      notice:
        result.transport === "capture"
          ? "Test email captured by EMAIL_CAPTURE_FILE (test mode)."
          : `Test email sent to ${to}.`,
    };
  } catch (err) {
    return { error: describeEmailError(err), ok: false };
  }
}

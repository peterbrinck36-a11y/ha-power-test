import "server-only";

import fs from "node:fs/promises";

import nodemailer from "nodemailer";

import { getEmailSettings } from "./settings";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super(
      "Email is not configured yet. Add the Gmail address and app password under Admin → Settings.",
    );
    this.name = "EmailNotConfiguredError";
  }
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendResult = {
  transport: "gmail" | "capture";
};

const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465;

/**
 * Sends one email through Gmail SMTP (app password), or appends it to
 * `EMAIL_CAPTURE_FILE` when that test hook is set. Capture mode still requires
 * a saved configuration so tests can exercise the "not configured" path.
 */
export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const settings = getEmailSettings();
  if (!settings.address || !settings.appPassword) {
    throw new EmailNotConfiguredError();
  }

  const capturePath = process.env.EMAIL_CAPTURE_FILE?.trim();
  if (capturePath) {
    await fs.appendFile(
      capturePath,
      `${JSON.stringify({ ...email, at: new Date().toISOString() })}\n`,
      "utf8",
    );
    return { transport: "capture" };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true,
    auth: { user: settings.address, pass: settings.appPassword },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  await transporter.sendMail({
    from: `"${settings.fromName.replace(/"/g, "")}" <${settings.address}>`,
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  return { transport: "gmail" };
}

/** Turns transport/decryption failures into something an admin can act on. */
export function describeEmailError(err: unknown): string {
  if (err instanceof EmailNotConfiguredError) return err.message;

  const code = (err as { code?: string } | null)?.code;
  if (code === "EAUTH") {
    return "Gmail rejected the credentials — check the address and app password (2-Step Verification must be enabled).";
  }
  if (code === "ETIMEDOUT" || code === "ESOCKET" || code === "ECONNECTION") {
    return "Could not reach smtp.gmail.com — the network may block outbound SMTP (port 465).";
  }
  if (code === "EENVELOPE") {
    return "Gmail rejected the recipient address.";
  }
  if (err instanceof Error && err.message.includes("decrypt")) {
    return "The stored email password can no longer be decrypted (the signing secret changed) — re-enter it.";
  }
  return err instanceof Error ? err.message : "Unknown email error.";
}

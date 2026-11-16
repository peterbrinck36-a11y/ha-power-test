import "server-only";

import type { OutgoingEmail } from "./client";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function invitationEmail(params: {
  to: string;
  username: string;
  temporaryPassword: string;
  loginUrl: string;
  expiresAt: Date;
}): OutgoingEmail {
  const expires = params.expiresAt.toISOString().slice(0, 10);
  const subject = "Your Marina Shore Power account";

  const text = [
    `Hi ${params.username},`,
    "",
    "An account has been created for you at Marina Shore Power.",
    "",
    `Username: ${params.username}`,
    `Temporary password: ${params.temporaryPassword}`,
    "",
    `Sign in here: ${params.loginUrl}`,
    "",
    "You will be asked to choose your own password after signing in.",
    `The temporary password expires on ${expires}.`,
    "",
    "If you were not expecting this email, contact the marina admin.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #0f172a; line-height: 1.6;">
    <p>Hi ${escapeHtml(params.username)},</p>
    <p>An account has been created for you at <strong>Marina Shore Power</strong>.</p>
    <p>
      Username: <strong>${escapeHtml(params.username)}</strong><br />
      Temporary password: <strong style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${escapeHtml(params.temporaryPassword)}</strong>
    </p>
    <p><a href="${escapeHtml(params.loginUrl)}">Sign in to Marina Shore Power</a></p>
    <p>You will be asked to choose your own password after signing in.</p>
    <p style="color: #64748b; font-size: 14px;">The temporary password expires on ${escapeHtml(expires)}. If you were not expecting this email, contact the marina admin.</p>
  </body>
</html>`;

  return { to: params.to, subject, text, html };
}

export function testEmail(params: { to: string; appUrl: string }): OutgoingEmail {
  const subject = "Marina Shore Power — test email";
  const text = [
    "This is a test email from your Marina Shore Power installation.",
    "",
    `If you are reading this, Gmail sending works. App URL: ${params.appUrl}`,
  ].join("\n");
  const html = `<!doctype html>
<html>
  <body style="font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #0f172a; line-height: 1.6;">
    <p>This is a test email from your <strong>Marina Shore Power</strong> installation.</p>
    <p>If you are reading this, Gmail sending works.</p>
    <p style="color: #64748b; font-size: 14px;">App URL: ${escapeHtml(params.appUrl)}</p>
  </body>
</html>`;

  return { to: params.to, subject, text, html };
}

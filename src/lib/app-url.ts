import "server-only";

/** Builds the public base URL used in emailed links. */
export async function getAppUrl(): Promise<string> {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  // Fallback: derive from the incoming request (works locally and behind a
  // reverse proxy that forwards Host / X-Forwarded-*).
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";
  return `${proto}://${host}`;
}

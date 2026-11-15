import { NextResponse } from "next/server";

import { sqlite } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Unauthenticated health probe for Docker HEALTHCHECK / Dockge. */
export async function GET() {
  try {
    sqlite.prepare("select 1").get();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "database unavailable" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { sampleIntervalMs, sampleOnce } from "@/lib/sampler";

export const dynamic = "force-dynamic";

/**
 * Admin-only manual sampling pass. The background sampler runs this on a
 * timer; an explicit pass is useful right after assigning a meter (so the
 * owner does not wait up to 2 minutes for the first reading) and makes E2E
 * sampling deterministic.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await sampleOnce();
  return NextResponse.json(
    { ...result, intervalMs: sampleIntervalMs() },
    { status: result.recorded ? 200 : 409 },
  );
}

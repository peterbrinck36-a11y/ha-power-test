import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import type { ReadingsResponse } from "@/lib/api-types";
import { getSessionUser } from "@/lib/auth";
import { getMonthSummary } from "@/lib/categories";
import { db } from "@/lib/db";
import { buildReadings } from "@/lib/ha/readings";
import { meters } from "@/lib/schema";

export const dynamic = "force-dynamic";

/**
 * Live readings for the signed-in user's meters. Owners get only what is
 * assigned to them; admins get all meters (the preview path). HA secrets and
 * raw HA payloads never leave the server — this endpoint returns mapped,
 * owner-safe shapes only.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const rows =
    user.role === "admin"
      ? db.select().from(meters).all()
      : db.select().from(meters).where(eq(meters.ownerId, user.id)).all();

  const payload: ReadingsResponse = {
    ...(await buildReadings(rows)),
    // Owners see their own month-to-date category summary. Admins preview every
    // meter instead, so an account-level total would be meaningless there.
    month: user.role === "owner" ? getMonthSummary(user.id) : null,
  };
  return NextResponse.json(payload);
}

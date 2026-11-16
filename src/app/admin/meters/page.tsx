import { eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { meterAssignments, meters, users } from "@/lib/schema";
import { MeterRowActions, NewMeterButton } from "@/components/admin/meter-dialogs";

export default async function AdminMetersPage() {
  const meterRows = db
    .select({
      id: meters.id,
      name: meters.name,
      ownerId: meters.ownerId,
      powerEntityId: meters.powerEntityId,
      energyEntityId: meters.energyEntityId,
      ownerUsername: users.username,
    })
    .from(meters)
    .leftJoin(users, eq(meters.ownerId, users.id))
    .all();

  // Open ownership periods carry the DB-owned total shown to the owner.
  const openAssignments = db
    .select()
    .from(meterAssignments)
    .where(isNull(meterAssignments.endedAt))
    .all();
  const assignmentByMeter = new Map(
    openAssignments.map((assignment) => [assignment.meterId, assignment] as const),
  );

  const owners = db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      active: users.active,
    })
    .from(users)
    .where(eq(users.role, "owner"))
    .all();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Meters</h1>
        <NewMeterButton owners={owners} />
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Meter</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Power sensor</th>
              <th className="px-4 py-3">Energy sensor</th>
              <th className="px-4 py-3">Assigned since</th>
              <th className="px-4 py-3">Consumed</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {meterRows.map((row) => {
              const assignment = assignmentByMeter.get(row.id) ?? null;
              return (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.ownerUsername ?? <span className="text-slate-400">unassigned</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {row.powerEntityId}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {row.energyEntityId}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {assignment ? assignment.startedAt.toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {assignment ? `${assignment.consumedKwh.toFixed(2)} kWh` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <MeterRowActions
                      meter={{
                        id: row.id,
                        name: row.name,
                        ownerId: row.ownerId,
                        powerEntityId: row.powerEntityId,
                        energyEntityId: row.energyEntityId,
                      }}
                      owners={owners}
                    />
                  </td>
                </tr>
              );
            })}
            {meterRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  No meters yet — create one to get started.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Sensors are picked from Home Assistant (power/energy entities). When HA is
        unreachable you can still type an entity_id manually. Consumption is stored in
        this app and sampled every 2 minutes; assigning a meter to a different owner
        starts their total at 0.
      </p>
    </div>
  );
}

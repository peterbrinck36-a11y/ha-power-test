import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { meters, users } from "@/lib/schema";
import { MeterRowActions, NewMeterButton } from "@/components/admin/meter-dialogs";

export default async function AdminMetersPage() {
  const meterRows = db
    .select({
      id: meters.id,
      name: meters.name,
      ownerId: meters.ownerId,
      powerEntityId: meters.powerEntityId,
      energyEntityId: meters.energyEntityId,
      kwhOffset: meters.kwhOffset,
      ownerUsername: users.username,
    })
    .from(meters)
    .leftJoin(users, eq(meters.ownerId, users.id))
    .all();

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
              <th className="px-4 py-3">kWh offset</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {meterRows.map((row) => (
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
                  {row.kwhOffset === 0 ? "—" : `${row.kwhOffset} kWh`}
                </td>
                <td className="px-4 py-3">
                  <MeterRowActions
                    meter={{
                      id: row.id,
                      name: row.name,
                      ownerId: row.ownerId,
                      powerEntityId: row.powerEntityId,
                      energyEntityId: row.energyEntityId,
                      kwhOffset: row.kwhOffset,
                    }}
                    owners={owners}
                  />
                </td>
              </tr>
            ))}
            {meterRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No meters yet — create one to get started.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Sensors are picked from Home Assistant (power/energy entities). When HA is
        unreachable you can still type an entity_id manually.
      </p>
    </div>
  );
}

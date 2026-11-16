import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { meterAssignments, meters, users } from "@/lib/schema";
import { MeterRowActions, NewMeterButton } from "@/components/admin/meter-dialogs";

import { assignMeterToUser, unassignMeterFromUser } from "./actions";

export const metadata = { title: "User meters — Marina Admin" };

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) notFound();

  const user = db.select().from(users).where(eq(users.id, userId)).all()[0];
  if (!user) notFound();

  const meterRows = db
    .select()
    .from(meters)
    .where(eq(meters.ownerId, userId))
    .all();

  const openAssignments = db
    .select()
    .from(meterAssignments)
    .where(isNull(meterAssignments.endedAt))
    .all();
  const assignmentByMeter = new Map(
    openAssignments.map((assignment) => [assignment.meterId, assignment] as const),
  );

  const unassigned = db
    .select({ id: meters.id, name: meters.name, powerEntityId: meters.powerEntityId })
    .from(meters)
    .where(isNull(meters.ownerId))
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

  const totalKwh = meterRows.reduce(
    (sum, meter) => sum + (assignmentByMeter.get(meter.id)?.consumedKwh ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-sky-700 dark:text-sky-300 hover:underline">
          ← All users
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">{user.username}</h1>
            <p className="mt-0.5 text-sm text-ink-muted">{user.email}</p>
          </div>
          <NewMeterButton owners={owners} defaultOwnerId={user.id} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2 py-0.5 ${
              user.role === "admin"
                ? "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                : "bg-surface-muted text-ink-muted"
            }`}
          >
            {user.role}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 ${
              user.active
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
            }`}
          >
            {user.active ? "active" : "disabled"}
          </span>
          <span className="text-ink-muted">
            {meterRows.length} meter{meterRows.length === 1 ? "" : "s"} ·{" "}
            {totalKwh.toFixed(2)} kWh combined
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-3">Meter</th>
              <th className="hidden px-4 py-3 sm:table-cell">Power sensor</th>
              <th className="hidden px-4 py-3 sm:table-cell">Energy sensor</th>
              <th className="hidden px-4 py-3 sm:table-cell">Assigned since</th>
              <th className="px-4 py-3">Consumed</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {meterRows.map((meter) => {
              const assignment = assignmentByMeter.get(meter.id) ?? null;
              return (
                <tr key={meter.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{meter.name}</td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-ink-muted sm:table-cell">
                    {meter.powerEntityId}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-ink-muted sm:table-cell">
                    {meter.energyEntityId}
                  </td>
                  <td className="hidden px-4 py-3 text-ink-muted sm:table-cell">
                    {assignment ? assignment.startedAt.toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-muted">
                    {assignment ? `${assignment.consumedKwh.toFixed(2)} kWh` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <MeterRowActions
                        meter={{
                          id: meter.id,
                          name: meter.name,
                          ownerId: meter.ownerId,
                          powerEntityId: meter.powerEntityId,
                          energyEntityId: meter.energyEntityId,
                        }}
                        owners={owners}
                      />
                      <form action={unassignMeterFromUser}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="meterId" value={meter.id} />
                        <button
                          type="submit"
                          className="rounded-lg px-2 py-1 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink"
                        >
                          Unassign
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {meterRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-muted">
                  No meters assigned to this user yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {unassigned.length > 0 ? (
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold text-ink">Assign an existing meter</h2>
          <p className="mt-1 text-sm text-ink-muted">
            These meters are not connected to anyone. Assigning one starts its consumption
            at 0 kWh for this user.
          </p>
          <form action={assignMeterToUser} className="mt-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="userId" value={user.id} />
            <label htmlFor="assign-meter" className="flex-1 text-sm text-ink-secondary">
              Unassigned meter
              <select
                id="assign-meter"
                name="meterId"
                required
                className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-500/30"
              >
                {unassigned.map((meter) => (
                  <option key={meter.id} value={meter.id}>
                    {meter.name} ({meter.powerEntityId})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600"
            >
              Assign meter
            </button>
          </form>
        </section>
      ) : (
        <p className="text-sm text-ink-muted">
          Every meter is assigned. Create a new one above if this user needs another
          connection point.
        </p>
      )}
    </div>
  );
}

import Link from "next/link";
import { count, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { meters, users } from "@/lib/schema";
import { NewUserButton, UserRowActions } from "@/components/admin/user-dialogs";

export default async function AdminUsersPage() {
  const rows = db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
      meterCount: count(meters.id),
    })
    .from(users)
    .leftJoin(meters, eq(meters.ownerId, users.id))
    .groupBy(users.id)
    .all();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <NewUserButton />
      </div>

      <div className="overflow-x-auto rounded-2xl bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Meters</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${row.id}`}
                    className="font-medium text-ink hover:text-sky-700 hover:underline dark:hover:text-sky-300"
                  >
                    {row.username}
                  </Link>
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                      row.role === "admin"
                        ? "bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300"
                        : "bg-surface-muted text-ink-muted"
                    }`}
                  >
                    {row.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-muted">{row.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      row.active
                        ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {row.active ? "active" : "disabled"}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-muted">{row.meterCount}</td>
                <td className="px-4 py-3 text-ink-muted">
                  {row.createdAt.toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <UserRowActions
                    user={{
                      id: row.id,
                      email: row.email,
                      username: row.username,
                      role: row.role,
                      active: row.active,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-muted">
        Deleting a user unassigns their meters (they stay configured, just unowned).
        You cannot disable, demote, or delete your own account.
      </p>
    </div>
  );
}

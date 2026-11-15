import { count } from "drizzle-orm";

import { db } from "@/lib/db";
import { meters, users } from "@/lib/schema";

export default async function AdminOverviewPage() {
  const [{ n: userCount }] = db.select({ n: count() }).from(users).all();
  const [{ n: meterCount }] = db.select({ n: count() }).from(meters).all();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Overview</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Users</p>
          <p className="mt-1 text-3xl font-semibold">{userCount}</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Meters</p>
          <p className="mt-1 text-3xl font-semibold">{meterCount}</p>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        Manage boat owners under <span className="font-medium text-slate-700">Users</span>{" "}
        and their shore-power meters under <span className="font-medium text-slate-700">Meters</span>.
      </p>
    </div>
  );
}

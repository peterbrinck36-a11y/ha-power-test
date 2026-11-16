import type { CategoryMonthSummary } from "@/lib/api-types";
import { categoryColor } from "@/lib/category-colors";

function formatKwh(value: number): string {
  return value.toFixed(2);
}

/**
 * Account-level month-to-date consumption and the tier it reaches. Rendered at
 * the top of the owner dashboard; the server only sends `month` for owners, and
 * only while categories are configured.
 */
export function CategoryCard({ month }: { month: CategoryMonthSummary }) {
  const palette = categoryColor(month.current?.color ?? month.next?.color ?? "slate");
  const percent = Math.round(month.progress * 100);

  return (
    <section
      aria-label="Monthly category"
      className="rounded-2xl bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            This month · {month.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {formatKwh(month.totalKwh)}{" "}
            <span className="text-base font-normal text-slate-500">kWh</span>
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${palette.badge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${palette.dot}`} />
          {month.current ? month.current.name : "Not ranked yet"}
        </span>
      </div>

      <div className="mt-4">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={
            month.next
              ? `Progress towards ${month.next.name}`
              : "Progress towards the top category"
          }
          className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className={`h-full rounded-full ${palette.bar}`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <p className="mt-2 text-sm text-slate-600">
          {month.next ? (
            <>
              {formatKwh(month.next.remainingKwh)} kWh to{" "}
              <span className="font-medium text-slate-900">{month.next.name}</span>
            </>
          ) : (
            "Top category reached."
          )}
        </p>
      </div>
    </section>
  );
}

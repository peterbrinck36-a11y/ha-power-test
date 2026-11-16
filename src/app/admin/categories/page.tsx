import { listCategories } from "@/lib/categories";
import { categoryColor } from "@/lib/category-colors";
import {
  CategoryRowActions,
  NewCategoryButton,
} from "@/components/admin/category-dialogs";

function formatKwh(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default function AdminCategoriesPage() {
  const tiers = listCategories();
  const lastThreshold = tiers.length > 0 ? tiers[tiers.length - 1].minKwh : null;
  const hasZeroTier = tiers.some((tier) => tier.minKwh === 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Categories</h1>
        <NewCategoryButton nextThreshold={lastThreshold} />
      </div>

      {tiers.length === 0 ? (
        <div className="rounded-2xl bg-surface p-6 text-sm text-ink-muted shadow-sm">
          <p className="font-medium text-ink">No categories yet</p>
          <p className="mt-1">
            Create tiers like “Bronze — 0 kWh”, “Silver — 150 kWh” and “Gold — 300 kWh”.
            Until at least one exists, boat owners won’t see a category card.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Starts at</th>
                <th className="px-4 py-3">Range</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier, index) => {
                const next = tiers[index + 1] ?? null;
                const palette = categoryColor(tier.color);
                return (
                  <tr key={tier.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${palette.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${palette.dot}`} />
                        {tier.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-secondary">
                      {formatKwh(tier.minKwh)} kWh
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {next
                        ? `${formatKwh(tier.minKwh)} – ${formatKwh(next.minKwh)} kWh`
                        : `${formatKwh(tier.minKwh)} kWh and above`}
                    </td>
                    <td className="px-4 py-3">
                      <CategoryRowActions category={tier} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tiers.length > 0 && !hasZeroTier ? (
        <p className="rounded-xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          No category starts at 0 kWh, so owners stay “not ranked yet” until they reach
          the first tier ({formatKwh(tiers[0].minKwh)} kWh). Add a 0 kWh tier if everyone
          should always have a category.
        </p>
      ) : null}

      <p className="text-xs text-ink-muted">
        An owner’s category is the highest tier their <strong>calendar-month</strong>{" "}
        consumption has reached (all their meters combined, reset at the start of each
        month). The last tier has no upper limit.
      </p>
    </div>
  );
}

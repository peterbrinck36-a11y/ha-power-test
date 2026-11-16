"use client";

import { useActionState, useEffect, useState } from "react";

import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/app/admin/categories/actions";
import { Dialog } from "@/components/ui/dialog";
import type { CategoryTier } from "@/lib/api-types";
import { CATEGORY_COLORS, categoryColor } from "@/lib/category-colors";
import { initialFormState } from "@/lib/forms";

const inputClasses =
  "mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";
const primaryButtonClasses =
  "rounded-lg bg-sky-600 dark:bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 dark:hover:bg-sky-600 disabled:opacity-60";
const secondaryButtonClasses =
  "rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm text-ink-secondary hover:bg-surface-muted";

function formatKwh(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function CategoryDialog({
  category,
  defaultMinKwh,
  onClose,
}: {
  category: CategoryTier | null;
  defaultMinKwh: string;
  onClose: () => void;
}) {
  const isEdit = category !== null;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateCategory : createCategory,
    initialFormState,
  );
  const [color, setColor] = useState<string>(category?.color ?? "slate");

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? `Edit category — ${category.name}` : "New category"}
    >
      <form action={formAction} className="space-y-4">
        {isEdit ? <input type="hidden" name="id" value={category.id} /> : null}

        <div>
          <label htmlFor="category-name" className="block text-sm font-medium text-ink-secondary">
            Name
          </label>
          <input
            id="category-name"
            name="name"
            type="text"
            required
            maxLength={40}
            placeholder="Gold"
            defaultValue={category?.name ?? ""}
            className={inputClasses}
          />
        </div>

        <div>
          <label
            htmlFor="category-min-kwh"
            className="block text-sm font-medium text-ink-secondary"
          >
            Starts at (kWh)
          </label>
          <input
            id="category-min-kwh"
            name="minKwh"
            // Not type="number": comma-decimal locales silently block submission.
            type="text"
            inputMode="decimal"
            required
            defaultValue={isEdit ? formatKwh(category.minKwh) : defaultMinKwh}
            className={inputClasses}
          />
          <p className="mt-1 text-xs text-ink-muted">
            Lower bound of the tier for the calendar month. Tiers are ordered by this
            value and it must be unique.
          </p>
        </div>

        <div>
          <label
            htmlFor="category-color"
            className="block text-sm font-medium text-ink-secondary"
          >
            Color
          </label>
          <select
            id="category-color"
            name="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className={inputClasses}
          >
            {CATEGORY_COLORS.map((palette) => (
              <option key={palette.key} value={palette.key}>
                {palette.label}
              </option>
            ))}
          </select>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${categoryColor(color).badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${categoryColor(color).dot}`} />
              Preview
            </span>
          </div>
        </div>

        {state.error ? (
          <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {state.error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryButtonClasses}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={primaryButtonClasses}>
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create category"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function NewCategoryButton({ nextThreshold }: { nextThreshold: number | null }) {
  const [open, setOpen] = useState(false);
  // Start at 0 for the first tier, then a round step above the current top tier.
  const defaultMinKwh =
    nextThreshold === null ? "0" : String(Math.round(nextThreshold) + 100);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClasses}>
        New category
      </button>
      {open ? (
        <CategoryDialog
          category={null}
          defaultMinKwh={defaultMinKwh}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function CategoryRowActions({ category }: { category: CategoryTier }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteCategory,
    initialFormState,
  );

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="rounded-lg px-2 py-1 text-sm text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-500/10"
      >
        Edit
      </button>

      {editOpen ? (
        <CategoryDialog
          category={category}
          defaultMinKwh={formatKwh(category.minKwh)}
          onClose={() => setEditOpen(false)}
        />
      ) : null}

      <form action={deleteFormAction}>
        <input type="hidden" name="id" value={category.id} />
        <button
          type="submit"
          disabled={deletePending}
          onClick={(event) => {
            if (!confirm(`Delete category "${category.name}"?`)) {
              event.preventDefault();
            }
          }}
          className="rounded-lg px-2 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          Delete
        </button>
      </form>

      {deleteState.error ? (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {deleteState.error}
        </span>
      ) : null}
    </div>
  );
}

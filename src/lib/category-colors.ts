/**
 * Fixed palette for consumption categories (client-safe, no server imports).
 *
 * Colors are stored as keys, never as class strings, so every Tailwind class
 * below appears literally in the source and survives the production purge.
 */
import type { CategoryColor } from "./api-types";

export type CategoryPalette = {
  key: CategoryColor;
  label: string;
  /** Badge: category name chip. */
  badge: string;
  /** Small solid dot / accent. */
  dot: string;
  /** Progress bar fill. */
  bar: string;
};

export const CATEGORY_COLORS: CategoryPalette[] = [
  {
    key: "slate",
    label: "Slate",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
    dot: "bg-slate-400 dark:bg-slate-500",
    bar: "bg-slate-400 dark:bg-slate-500",
  },
  {
    key: "amber",
    label: "Amber",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    dot: "bg-amber-500 dark:bg-amber-400",
    bar: "bg-amber-500 dark:bg-amber-400",
  },
  {
    key: "zinc",
    label: "Silver",
    badge: "bg-zinc-200 text-zinc-700 dark:bg-zinc-400/20 dark:text-zinc-300",
    dot: "bg-zinc-400",
    bar: "bg-zinc-400",
  },
  {
    key: "yellow",
    label: "Gold",
    badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300",
    dot: "bg-yellow-500 dark:bg-yellow-400",
    bar: "bg-yellow-500 dark:bg-yellow-400",
  },
  {
    key: "emerald",
    label: "Green",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    dot: "bg-emerald-500 dark:bg-emerald-400",
    bar: "bg-emerald-500 dark:bg-emerald-400",
  },
  {
    key: "sky",
    label: "Blue",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
    dot: "bg-sky-500 dark:bg-sky-400",
    bar: "bg-sky-500 dark:bg-sky-400",
  },
  {
    key: "rose",
    label: "Rose",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    dot: "bg-rose-500 dark:bg-rose-400",
    bar: "bg-rose-500 dark:bg-rose-400",
  },
];

export function isCategoryColor(value: string): value is CategoryColor {
  return CATEGORY_COLORS.some((color) => color.key === value);
}

export function categoryColor(key: string | null | undefined): CategoryPalette {
  return CATEGORY_COLORS.find((color) => color.key === key) ?? CATEGORY_COLORS[0];
}

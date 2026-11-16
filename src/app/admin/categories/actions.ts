"use server";

import { revalidatePath } from "next/cache";
import { eq, ne, and } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { isCategoryColor } from "@/lib/category-colors";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { categories } from "@/lib/schema";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function parseMinKwh(raw: string): number | null {
  // Accept both "120.5" and "120,5" — the admin may be on a comma-decimal locale.
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value >= 0 && value <= 1_000_000 ? value : null;
}

function formatKwh(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function clashError(
  minKwh: number,
  excludeId: number | null,
): string | null {
  const conflict = db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(
      excludeId === null
        ? eq(categories.minKwh, minKwh)
        : and(eq(categories.minKwh, minKwh), ne(categories.id, excludeId)),
    )
    .limit(1)
    .all()[0];

  if (!conflict) return null;
  return `"${conflict.name}" already starts at ${formatKwh(minKwh)} kWh — every threshold must be unique.`;
}

function validate(
  formData: FormData,
): { name: string; minKwh: number; color: string } | { error: string } {
  const name = str(formData, "name");
  if (!name) return { error: "Enter a category name." };
  if (name.length > 40) return { error: "Keep the category name under 40 characters." };

  const minKwh = parseMinKwh(str(formData, "minKwh"));
  if (minKwh === null) return { error: "Enter a start threshold in kWh (0 or more)." };

  const rawColor = str(formData, "color");
  const color = isCategoryColor(rawColor) ? rawColor : "slate";

  return { name, minKwh, color };
}

function revalidateCategories() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function createCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = validate(formData);
  if ("error" in parsed) return { error: parsed.error, ok: false };

  const clash = clashError(parsed.minKwh, null);
  if (clash) return { error: clash, ok: false };

  db.insert(categories)
    .values({ name: parsed.name, minKwh: parsed.minKwh, color: parsed.color })
    .run();

  revalidateCategories();
  return { error: null, ok: true };
}

export async function updateCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid category.", ok: false };

  const existing = db.select().from(categories).where(eq(categories.id, id)).limit(1).all()[0];
  if (!existing) return { error: "Category not found.", ok: false };

  const parsed = validate(formData);
  if ("error" in parsed) return { error: parsed.error, ok: false };

  const clash = clashError(parsed.minKwh, id);
  if (clash) return { error: clash, ok: false };

  db.update(categories)
    .set({
      name: parsed.name,
      minKwh: parsed.minKwh,
      color: parsed.color,
      updatedAt: new Date(),
    })
    .where(eq(categories.id, id))
    .run();

  revalidateCategories();
  return { error: null, ok: true };
}

export async function deleteCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid category.", ok: false };

  const existing = db.select().from(categories).where(eq(categories.id, id)).limit(1).all()[0];
  if (!existing) return { error: "Category not found.", ok: false };

  db.delete(categories).where(eq(categories.id, id)).run();

  revalidateCategories();
  return { error: null, ok: true };
}

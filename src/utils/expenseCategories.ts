import type { ExpenseCategory } from "../types";

export const STANDARD_EXPENSE_CATEGORIES = [
  "Venue",
  "Artist",
  "Marketing",
  "Sound",
  "Lighting",
  "Food",
  "Security",
] as const;

export const CUSTOM_EXPENSE_CATEGORY_OPTION = "Custom";

export const EXPENSE_CATEGORY_OPTIONS = [
  ...STANDARD_EXPENSE_CATEGORIES,
  CUSTOM_EXPENSE_CATEGORY_OPTION,
];

export function isStandardExpenseCategory(category: string) {
  return STANDARD_EXPENSE_CATEGORIES.some((option) => option === category);
}

export function getExpenseCategoryFormValues(category: ExpenseCategory) {
  return isStandardExpenseCategory(category)
    ? { category, customCategory: "" }
    : { category: CUSTOM_EXPENSE_CATEGORY_OPTION, customCategory: category };
}

export function resolveExpenseCategory(category: string, customCategory: string): ExpenseCategory {
  return (category === CUSTOM_EXPENSE_CATEGORY_OPTION ? customCategory : category).trim();
}

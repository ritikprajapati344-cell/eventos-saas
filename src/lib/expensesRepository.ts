import type { Expense, ExpenseCategory } from "../types";
import { supabase } from "./supabase";

export type ExpensePaymentStatus = "Paid" | "Partial" | "Pending";

export type ExpenseRecord = Expense & {
  notes?: string;
  paymentStatus?: ExpensePaymentStatus;
  vendorId?: string;
};

export interface ExpenseWriteInput {
  amount: number;
  category: ExpenseCategory;
  date: string;
  description: string;
  eventId?: string;
  notes: string;
  paymentStatus: ExpensePaymentStatus;
  vendorId?: string;
}

interface ExpenseRow {
  amount: number | string;
  category: ExpenseCategory;
  description: string;
  event_id: string | null;
  expense_date: string;
  id: string;
  notes: string;
  payment_status: ExpensePaymentStatus;
  vendor_id: string | null;
  workspace_id: string;
}

const expenseColumns = "id,workspace_id,event_id,vendor_id,category,description,amount,expense_date,payment_status,notes";

export async function listWorkspaceExpenses(workspaceId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("expenses")
    .select(expenseColumns)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as ExpenseRow[]).map(mapExpenseRow);
}

export async function createWorkspaceExpense(workspaceId: string, input: ExpenseWriteInput) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("expenses")
    .insert(toExpenseRow(workspaceId, input))
    .select(expenseColumns)
    .single();

  if (error) throw error;
  return mapExpenseRow(data as ExpenseRow);
}

export async function updateWorkspaceExpense(
  workspaceId: string,
  expenseId: string,
  input: ExpenseWriteInput,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("expenses")
    .update(toExpenseRow(workspaceId, input))
    .eq("workspace_id", workspaceId)
    .eq("id", expenseId)
    .select(expenseColumns)
    .single();

  if (error) throw error;
  return mapExpenseRow(data as ExpenseRow);
}

export async function deleteWorkspaceExpense(workspaceId: string, expenseId: string) {
  const client = requireSupabase();
  const { error } = await client
    .from("expenses")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", expenseId);

  if (error) throw error;
}

function toExpenseRow(workspaceId: string, input: ExpenseWriteInput) {
  return {
    amount: input.amount,
    category: input.category,
    description: input.description,
    event_id: input.eventId ?? null,
    expense_date: input.date,
    notes: input.notes,
    payment_status: input.paymentStatus,
    vendor_id: input.vendorId ?? null,
    workspace_id: workspaceId,
  };
}

function mapExpenseRow(row: ExpenseRow): ExpenseRecord {
  return {
    amount: Number(row.amount),
    category: row.category,
    date: row.expense_date,
    description: row.description,
    eventId: row.event_id ?? undefined,
    id: row.id,
    notes: row.notes,
    paymentStatus: row.payment_status,
    vendorId: row.vendor_id ?? undefined,
  };
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

import { supabase } from "./supabase";

export type FinanceTransactionType = "Income" | "Expense";
export type FinanceTransactionSource = "Ticket" | "Sponsor" | "Vendor" | "Artist" | "Other";
export type FinancePaymentMode = "Cash" | "UPI" | "Bank Transfer" | "Cheque" | "Other";

export interface FinanceTransactionRecord {
  amount: number;
  date: string;
  eventId?: string;
  id: string;
  notes: string;
  paymentMode: FinancePaymentMode;
  source: FinanceTransactionSource;
  type: FinanceTransactionType;
}

export interface FinanceTransactionWriteInput {
  amount: number;
  date: string;
  eventId?: string;
  notes: string;
  paymentMode: FinancePaymentMode;
  source: FinanceTransactionSource;
  type: FinanceTransactionType;
}

interface FinanceTransactionRow {
  amount: number | string;
  event_id: string | null;
  id: string;
  notes: string;
  payment_mode: FinancePaymentMode;
  source: FinanceTransactionSource;
  transaction_date: string;
  transaction_type: FinanceTransactionType;
  workspace_id: string;
}

const financeTransactionColumns = "id,workspace_id,event_id,transaction_date,transaction_type,source,amount,payment_mode,notes";

export async function listWorkspaceFinanceTransactions(workspaceId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("finance_transactions")
    .select(financeTransactionColumns)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as FinanceTransactionRow[]).map(mapFinanceTransactionRow);
}

export async function createWorkspaceFinanceTransaction(
  workspaceId: string,
  input: FinanceTransactionWriteInput,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("finance_transactions")
    .insert(toFinanceTransactionRow(workspaceId, input))
    .select(financeTransactionColumns)
    .single();

  if (error) throw error;
  return mapFinanceTransactionRow(data as FinanceTransactionRow);
}

export async function updateWorkspaceFinanceTransaction(
  workspaceId: string,
  transactionId: string,
  input: FinanceTransactionWriteInput,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("finance_transactions")
    .update(toFinanceTransactionRow(workspaceId, input))
    .eq("workspace_id", workspaceId)
    .eq("id", transactionId)
    .select(financeTransactionColumns)
    .single();

  if (error) throw error;
  return mapFinanceTransactionRow(data as FinanceTransactionRow);
}

export async function deleteWorkspaceFinanceTransaction(
  workspaceId: string,
  transactionId: string,
) {
  const client = requireSupabase();
  const { error } = await client
    .from("finance_transactions")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", transactionId);

  if (error) throw error;
}

function toFinanceTransactionRow(
  workspaceId: string,
  input: FinanceTransactionWriteInput,
) {
  return {
    amount: input.amount,
    event_id: input.eventId ?? null,
    notes: input.notes,
    payment_mode: input.paymentMode,
    source: input.source,
    transaction_date: input.date,
    transaction_type: input.type,
    workspace_id: workspaceId,
  };
}

function mapFinanceTransactionRow(
  row: FinanceTransactionRow,
): FinanceTransactionRecord {
  return {
    amount: Number(row.amount),
    date: row.transaction_date,
    eventId: row.event_id ?? undefined,
    id: row.id,
    notes: row.notes,
    paymentMode: row.payment_mode,
    source: row.source,
    type: row.transaction_type,
  };
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

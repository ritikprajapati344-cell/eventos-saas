import type { Vendor, VendorCategory } from "../types";
import { supabase } from "./supabase";

export type VendorPaymentStatus = Vendor["status"] | "Partial";

export interface VendorWriteInput {
  advancePaid: number;
  amount: number;
  category: string;
  dueDate: string;
  eventId?: string;
  name: string;
  owner: string;
  status: VendorPaymentStatus;
}

interface VendorRow {
  amount: number | string;
  category: string;
  due_date: string;
  event_id: string | null;
  id: string;
  name: string;
  owner: string;
  paid_amount: number | string;
  payment_status: VendorPaymentStatus;
  workspace_id: string;
}

const vendorColumns = "id,workspace_id,event_id,name,category,owner,amount,paid_amount,due_date,payment_status";

export async function listWorkspaceVendors(workspaceId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("vendors")
    .select(vendorColumns)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as VendorRow[]).map(mapVendorRow);
}

export async function createWorkspaceVendor(workspaceId: string, input: VendorWriteInput) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("vendors")
    .insert(toVendorRow(workspaceId, input))
    .select(vendorColumns)
    .single();

  if (error) throw error;
  return mapVendorRow(data as VendorRow);
}

export async function updateWorkspaceVendor(
  workspaceId: string,
  vendorId: string,
  input: VendorWriteInput,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("vendors")
    .update(toVendorRow(workspaceId, input))
    .eq("workspace_id", workspaceId)
    .eq("id", vendorId)
    .select(vendorColumns)
    .single();

  if (error) throw error;
  return mapVendorRow(data as VendorRow);
}

export async function deleteWorkspaceVendor(workspaceId: string, vendorId: string) {
  const client = requireSupabase();
  const { error } = await client
    .from("vendors")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", vendorId);

  if (error) throw error;
}

function toVendorRow(workspaceId: string, input: VendorWriteInput) {
  return {
    amount: input.amount,
    category: input.category,
    due_date: input.dueDate,
    event_id: input.eventId ?? null,
    name: input.name,
    owner: input.owner,
    paid_amount: input.status === "Paid" ? input.amount : input.advancePaid,
    workspace_id: workspaceId,
  };
}

function mapVendorRow(row: VendorRow): Vendor {
  return {
    advancePaid: Number(row.paid_amount),
    amount: Number(row.amount),
    category: row.category as VendorCategory,
    dueDate: row.due_date,
    eventId: row.event_id ?? undefined,
    id: row.id,
    name: row.name,
    owner: row.owner,
    status: row.payment_status === "Paid" ? "Paid" : "Pending",
  };
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

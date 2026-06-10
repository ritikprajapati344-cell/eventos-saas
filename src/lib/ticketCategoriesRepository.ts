import type { CheckInStatus, TicketCategory } from "../types";
import { supabase } from "./supabase";

export interface TicketCategoryWriteInput {
  checkedIn: number;
  eventId: string;
  inventory: number;
  name: string;
  price: number;
  sold: number;
}

interface TicketCategoryRow {
  checked_in: number;
  event_id: string;
  id: string;
  inventory: number;
  name: string;
  price: number | string;
  sold: number;
  status: "Not Started" | "Active" | "Low Stock" | "Sold Out";
  workspace_id: string;
}

const ticketCategoryColumns = "id,workspace_id,event_id,name,price,inventory,sold,checked_in,status";

export async function listWorkspaceTicketCategories(workspaceId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("ticket_categories")
    .select(ticketCategoryColumns)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as TicketCategoryRow[]).map(mapTicketCategoryRow);
}

export async function createWorkspaceTicketCategory(
  workspaceId: string,
  input: TicketCategoryWriteInput,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("ticket_categories")
    .insert(toTicketCategoryRow(workspaceId, input))
    .select(ticketCategoryColumns)
    .single();

  if (error) throw error;
  return mapTicketCategoryRow(data as TicketCategoryRow);
}

export async function updateWorkspaceTicketCategory(
  workspaceId: string,
  ticketCategoryId: string,
  input: TicketCategoryWriteInput,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("ticket_categories")
    .update(toTicketCategoryRow(workspaceId, input))
    .eq("workspace_id", workspaceId)
    .eq("id", ticketCategoryId)
    .select(ticketCategoryColumns)
    .single();

  if (error) throw error;
  return mapTicketCategoryRow(data as TicketCategoryRow);
}

export async function deleteWorkspaceTicketCategory(
  workspaceId: string,
  ticketCategoryId: string,
) {
  const client = requireSupabase();
  const { error } = await client
    .from("ticket_categories")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", ticketCategoryId);

  if (error) throw error;
}

function toTicketCategoryRow(workspaceId: string, input: TicketCategoryWriteInput) {
  return {
    checked_in: input.checkedIn,
    event_id: input.eventId,
    inventory: input.inventory,
    name: input.name,
    price: input.price,
    sold: input.sold,
    workspace_id: workspaceId,
  };
}

function mapTicketCategoryRow(row: TicketCategoryRow): TicketCategory {
  return {
    checkedIn: row.checked_in,
    eventId: row.event_id,
    id: row.id,
    inventory: row.inventory,
    name: row.name,
    price: Number(row.price),
    sold: row.sold,
    status: normalizeStoredStatus(row.status),
  };
}

function normalizeStoredStatus(status: TicketCategoryRow["status"]): CheckInStatus {
  return status === "Low Stock" ? "Active" : status;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

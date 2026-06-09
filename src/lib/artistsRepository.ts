import type { Artist, ContractStatus, PaymentStatus } from "../types";
import { supabase } from "./supabase";

export type ArtistContractStatus = ContractStatus | "Cancelled";

export interface ArtistWriteInput {
  contractStatus: ArtistContractStatus;
  eventId?: string;
  fee: number;
  greenRoomCost: number;
  hotelCost: number;
  name: string;
  paymentStatus: PaymentStatus;
  performanceSlot: string;
  profile: string;
  technicalRiderStatus: "Pending" | "Received" | "Approved";
  travelCost: number;
}

interface ArtistRow {
  contract_status: ArtistContractStatus;
  event_id: string | null;
  green_room_cost: number | string;
  hotel_cost: number | string;
  id: string;
  name: string;
  payment_status: PaymentStatus;
  performance_fee: number | string;
  performance_slot: string;
  profile: string;
  technical_rider_status: "Pending" | "Received" | "Approved";
  travel_cost: number | string;
  workspace_id: string;
}

const artistColumns = "id,workspace_id,event_id,name,profile,performance_slot,performance_fee,travel_cost,hotel_cost,green_room_cost,technical_rider_status,contract_status,payment_status";

export async function listWorkspaceArtists(workspaceId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("artists")
    .select(artistColumns)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as ArtistRow[]).map(mapArtistRow);
}

export async function createWorkspaceArtist(workspaceId: string, input: ArtistWriteInput) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("artists")
    .insert(toArtistRow(workspaceId, input))
    .select(artistColumns)
    .single();

  if (error) throw error;
  return mapArtistRow(data as ArtistRow);
}

export async function updateWorkspaceArtist(
  workspaceId: string,
  artistId: string,
  input: ArtistWriteInput,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("artists")
    .update(toArtistRow(workspaceId, input))
    .eq("workspace_id", workspaceId)
    .eq("id", artistId)
    .select(artistColumns)
    .single();

  if (error) throw error;
  return mapArtistRow(data as ArtistRow);
}

export async function updateWorkspaceArtistContract(
  workspaceId: string,
  artistId: string,
  contractStatus: ArtistContractStatus,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("artists")
    .update({ contract_status: contractStatus })
    .eq("workspace_id", workspaceId)
    .eq("id", artistId)
    .select(artistColumns)
    .single();

  if (error) throw error;
  return mapArtistRow(data as ArtistRow);
}

export async function deleteWorkspaceArtist(workspaceId: string, artistId: string) {
  const client = requireSupabase();
  const { error } = await client
    .from("artists")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", artistId);

  if (error) throw error;
}

function toArtistRow(workspaceId: string, input: ArtistWriteInput) {
  const totalCost = input.fee + input.travelCost + input.hotelCost + input.greenRoomCost;

  return {
    contract_status: input.contractStatus,
    event_id: input.eventId ?? null,
    green_room_cost: input.greenRoomCost,
    hotel_cost: input.hotelCost,
    name: input.name,
    paid_amount: getPaidAmount(input.paymentStatus, totalCost),
    performance_fee: input.fee,
    performance_slot: input.performanceSlot,
    profile: input.profile,
    technical_rider_status: input.technicalRiderStatus,
    travel_cost: input.travelCost,
    workspace_id: workspaceId,
  };
}

function getPaidAmount(paymentStatus: PaymentStatus, totalCost: number) {
  if (paymentStatus === "Paid") return totalCost;
  if (paymentStatus === "Partial") return totalCost / 2;
  return 0;
}

function mapArtistRow(row: ArtistRow): Artist {
  return {
    contractStatus: row.contract_status as ContractStatus,
    eventId: row.event_id ?? undefined,
    fee: Number(row.performance_fee),
    greenRoomCost: Number(row.green_room_cost),
    hotelCost: Number(row.hotel_cost),
    id: row.id,
    name: row.name,
    paymentStatus: row.payment_status,
    performanceSlot: row.performance_slot,
    profile: row.profile,
    technicalRiderStatus: row.technical_rider_status,
    travelCost: Number(row.travel_cost),
  };
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

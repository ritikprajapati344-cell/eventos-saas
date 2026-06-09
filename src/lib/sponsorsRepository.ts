import type { Sponsor, SponsorStatus } from "../types";
import { supabase } from "./supabase";

export interface SponsorWriteInput {
  agreementUploaded: boolean;
  companyName: string;
  contactPerson: string;
  email: string;
  eventId?: string;
  nextFollowUp: string;
  notes: string;
  paymentReceived: boolean;
  phone: string;
  sponsorshipAmount: number;
  status: SponsorStatus;
}

interface SponsorRow {
  agreement_uploaded: boolean;
  amount_received: number | string;
  company_name: string;
  contact_person: string;
  deal_amount: number | string;
  email: string;
  event_id: string | null;
  id: string;
  next_follow_up: string | null;
  notes: string;
  phone: string;
  stage: SponsorStatus;
  workspace_id: string;
}

const sponsorColumns = "id,workspace_id,event_id,company_name,contact_person,phone,email,deal_amount,amount_received,stage,notes,next_follow_up,agreement_uploaded";

export async function listWorkspaceSponsors(workspaceId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("sponsors")
    .select(sponsorColumns)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as SponsorRow[]).map(mapSponsorRow);
}

export async function createWorkspaceSponsor(workspaceId: string, input: SponsorWriteInput) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("sponsors")
    .insert(toSponsorRow(workspaceId, input))
    .select(sponsorColumns)
    .single();

  if (error) throw error;
  return mapSponsorRow(data as SponsorRow);
}

export async function updateWorkspaceSponsor(
  workspaceId: string,
  sponsorId: string,
  input: SponsorWriteInput,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("sponsors")
    .update(toSponsorRow(workspaceId, input))
    .eq("workspace_id", workspaceId)
    .eq("id", sponsorId)
    .select(sponsorColumns)
    .single();

  if (error) throw error;
  return mapSponsorRow(data as SponsorRow);
}

export async function updateWorkspaceSponsorStage(
  workspaceId: string,
  sponsorId: string,
  status: SponsorStatus,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("sponsors")
    .update({ stage: status })
    .eq("workspace_id", workspaceId)
    .eq("id", sponsorId)
    .select(sponsorColumns)
    .single();

  if (error) throw error;
  return mapSponsorRow(data as SponsorRow);
}

export async function deleteWorkspaceSponsor(workspaceId: string, sponsorId: string) {
  const client = requireSupabase();
  const { error } = await client
    .from("sponsors")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", sponsorId);

  if (error) throw error;
}

function toSponsorRow(workspaceId: string, input: SponsorWriteInput) {
  return {
    agreement_uploaded: input.agreementUploaded,
    amount_received: input.paymentReceived ? input.sponsorshipAmount : 0,
    company_name: input.companyName,
    contact_person: input.contactPerson,
    deal_amount: input.sponsorshipAmount,
    email: input.email,
    event_id: input.eventId ?? null,
    next_follow_up: input.nextFollowUp || null,
    notes: input.notes,
    phone: input.phone,
    stage: input.status,
    workspace_id: workspaceId,
  };
}

function mapSponsorRow(row: SponsorRow): Sponsor {
  const sponsorshipAmount = Number(row.deal_amount);

  return {
    agreementUploaded: row.agreement_uploaded,
    companyName: row.company_name,
    contactPerson: row.contact_person,
    email: row.email,
    eventId: row.event_id ?? undefined,
    id: row.id,
    nextFollowUp: row.next_follow_up ?? "",
    notes: row.notes,
    paymentReceived: Number(row.amount_received) >= sponsorshipAmount,
    phone: row.phone,
    sponsorshipAmount,
    status: row.stage,
  };
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

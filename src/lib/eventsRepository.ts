import type { EventItem, EventStatus, EventType } from "../types";
import { supabase } from "./supabase";

export interface EventWriteInput {
  archived: boolean;
  capacity: number;
  city: string;
  date: string;
  eventTime: string;
  eventType: EventType;
  expectedExpense: number;
  expectedRevenue: number;
  mainArtist: string;
  name: string;
  notes: string;
  owner: string;
  status: EventStatus;
  venue: string;
}

export interface SafeEventDeletionResult {
  deletedEventId: string;
  queuedFileCount: number;
}

interface EventRow {
  archived: boolean;
  capacity: number;
  city: string;
  event_date: string;
  event_time: string;
  event_type: EventType;
  expected_expense: number | string;
  expected_revenue: number | string;
  id: string;
  main_artist: string;
  name: string;
  notes: string;
  owner: string;
  status: EventStatus;
  venue: string;
  workspace_id: string;
}

const eventColumns = "id,workspace_id,name,venue,city,event_date,event_time,event_type,main_artist,capacity,status,owner,expected_revenue,expected_expense,archived,notes";

export async function listWorkspaceEvents(workspaceId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("events")
    .select(eventColumns)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as EventRow[]).map(mapEventRow);
}

export async function createWorkspaceEvent(workspaceId: string, input: EventWriteInput) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("events")
    .insert(toEventRow(workspaceId, input))
    .select(eventColumns)
    .single();

  if (error) throw error;
  return mapEventRow(data as EventRow);
}

export async function updateWorkspaceEvent(
  workspaceId: string,
  eventId: string,
  input: EventWriteInput,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("events")
    .update(toEventRow(workspaceId, input))
    .eq("workspace_id", workspaceId)
    .eq("id", eventId)
    .select(eventColumns)
    .single();

  if (error) throw error;
  return mapEventRow(data as EventRow);
}

export async function updateWorkspaceEventNotes(
  workspaceId: string,
  eventId: string,
  notes: string,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("events")
    .update({ notes })
    .eq("workspace_id", workspaceId)
    .eq("id", eventId)
    .select(eventColumns)
    .single();

  if (error) throw error;
  return mapEventRow(data as EventRow);
}

export async function deleteWorkspaceEvent(workspaceId: string, eventId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .rpc("delete_event_safely", { target_event_id: eventId })
    .single();

  if (error) throw error;

  const result = data as {
    deleted_event_id: string;
    queued_file_count: number;
  };

  if (result.deleted_event_id !== eventId) {
    throw new Error("Supabase returned an unexpected deleted event ID.");
  }

  return {
    deletedEventId: result.deleted_event_id,
    queuedFileCount: Number(result.queued_file_count),
  } satisfies SafeEventDeletionResult;
}

function toEventRow(workspaceId: string, input: EventWriteInput) {
  return {
    archived: input.archived,
    capacity: input.capacity,
    city: input.city,
    event_date: input.date,
    event_time: input.eventTime,
    event_type: input.eventType,
    expected_expense: input.expectedExpense,
    expected_revenue: input.expectedRevenue,
    main_artist: input.mainArtist,
    name: input.name,
    notes: input.notes,
    owner: input.owner,
    status: input.status,
    venue: input.venue,
    workspace_id: workspaceId,
  };
}

function mapEventRow(row: EventRow): EventItem {
  return {
    archived: row.archived,
    capacity: row.capacity,
    city: row.city,
    date: row.event_date,
    eventTime: row.event_time.slice(0, 5),
    eventType: row.event_type,
    expectedExpense: Number(row.expected_expense),
    expectedRevenue: Number(row.expected_revenue),
    files: [],
    id: row.id,
    mainArtist: row.main_artist,
    name: row.name,
    notes: row.notes,
    owner: row.owner,
    progress: 0,
    status: row.status,
    ticketPrice: 0,
    ticketsSold: 0,
    venue: row.venue,
  };
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

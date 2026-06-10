import type { TimelineItem } from "../types";
import { supabase } from "./supabase";

export interface TimelineWriteInput {
  date: string;
  description: string;
  eventId: string;
  status: TimelineItem["status"];
  title: string;
}

interface TimelineRow {
  description: string;
  event_id: string;
  id: string;
  status: TimelineItem["status"];
  timeline_date: string;
  title: string;
  workspace_id: string;
}

const timelineColumns = "id,workspace_id,event_id,title,description,timeline_date,status";

export async function listWorkspaceTimelineItems(workspaceId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("event_timeline_items")
    .select(timelineColumns)
    .eq("workspace_id", workspaceId)
    .order("timeline_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as TimelineRow[]).map(mapTimelineRow);
}

export async function createWorkspaceTimelineItem(
  workspaceId: string,
  input: TimelineWriteInput,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("event_timeline_items")
    .insert(toTimelineRow(workspaceId, input))
    .select(timelineColumns)
    .single();

  if (error) throw error;
  return mapTimelineRow(data as TimelineRow);
}

export async function updateWorkspaceTimelineItem(
  workspaceId: string,
  timelineItemId: string,
  input: TimelineWriteInput,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("event_timeline_items")
    .update(toTimelineRow(workspaceId, input))
    .eq("workspace_id", workspaceId)
    .eq("id", timelineItemId)
    .select(timelineColumns)
    .single();

  if (error) throw error;
  return mapTimelineRow(data as TimelineRow);
}

export async function deleteWorkspaceTimelineItem(
  workspaceId: string,
  timelineItemId: string,
) {
  const client = requireSupabase();
  const { error } = await client
    .from("event_timeline_items")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", timelineItemId);

  if (error) throw error;
}

function toTimelineRow(workspaceId: string, input: TimelineWriteInput) {
  return {
    description: input.description,
    event_id: input.eventId,
    status: input.status,
    timeline_date: input.date,
    title: input.title,
    workspace_id: workspaceId,
  };
}

function mapTimelineRow(row: TimelineRow): TimelineItem {
  return {
    date: row.timeline_date,
    description: row.description,
    eventId: row.event_id,
    id: row.id,
    status: row.status,
    title: row.title,
  };
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

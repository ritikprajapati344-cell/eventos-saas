import type { Activity, ActivityType } from "../types";
import { supabase } from "./supabase";

export interface ActivityWriteInput {
  entity: string;
  entityId?: string;
  eventId?: string;
  message: string;
  metadata?: Record<string, unknown>;
  type: ActivityType;
}

interface ActivityRow {
  entity_id: string | null;
  entity_type: ActivityType;
  event_id: string | null;
  id: string;
  message: string;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  workspace_id: string;
}

const activityColumns = "id,workspace_id,event_id,entity_type,entity_id,message,occurred_at,metadata";

export async function listWorkspaceActivities(workspaceId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("activities")
    .select(activityColumns)
    .eq("workspace_id", workspaceId)
    .order("occurred_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data as ActivityRow[]).map(mapActivityRow);
}

export async function createWorkspaceActivity(
  workspaceId: string,
  input: ActivityWriteInput,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("activities")
    .insert({
      entity_id: input.entityId ?? null,
      entity_type: input.type,
      event_id: input.eventId ?? null,
      message: input.message,
      metadata: {
        ...input.metadata,
        entity: input.entity,
      },
      workspace_id: workspaceId,
    })
    .select(activityColumns)
    .single();

  if (error) throw error;
  return mapActivityRow(data as ActivityRow);
}

function mapActivityRow(row: ActivityRow): Activity {
  const metadata = row.metadata ?? {};

  return {
    entity: typeof metadata.entity === "string"
      ? metadata.entity
      : getDefaultEntityLabel(row.entity_type),
    entityId: row.entity_id ?? undefined,
    eventId: row.event_id ?? undefined,
    id: row.id,
    message: row.message,
    metadata,
    occurredAt: row.occurred_at,
    time: formatActivityTime(row.occurred_at),
    type: row.entity_type,
  };
}

function getDefaultEntityLabel(type: ActivityType) {
  const labels: Record<ActivityType, string> = {
    Artist: "Artists",
    Event: "Events",
    File: "Files",
    Finance: "Finance",
    Sponsor: "Sponsors",
    Task: "Tasks",
    Ticketing: "Ticketing",
    Vendor: "Vendors",
  };
  return labels[type];
}

function formatActivityTime(occurredAt: string) {
  const occurred = new Date(occurredAt);
  const now = new Date();
  const elapsed = Math.max(0, now.getTime() - occurred.getTime());
  const time = occurred.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (elapsed < 60_000) return "Just now";
  if (isSameDay(occurred, now)) return `Today, ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(occurred, yesterday)) return `Yesterday, ${time}`;

  return occurred.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: occurred.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

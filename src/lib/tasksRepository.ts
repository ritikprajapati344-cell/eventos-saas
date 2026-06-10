import type { Task, TaskPriority, TaskStatus } from "../types";
import { supabase } from "./supabase";

export interface TaskWriteInput {
  dueDate: string;
  eventId: string;
  owner: string;
  priority: TaskPriority;
  status: TaskStatus;
  title: string;
}

interface TaskRow {
  completed_at: string | null;
  due_date: string;
  event_id: string;
  id: string;
  owner: string;
  priority: TaskPriority;
  status: TaskStatus;
  title: string;
  workspace_id: string;
}

const taskColumns = "id,workspace_id,event_id,title,owner,due_date,priority,status,completed_at";

export async function listWorkspaceTasks(workspaceId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("tasks")
    .select(taskColumns)
    .eq("workspace_id", workspaceId)
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as TaskRow[]).map(mapTaskRow);
}

export async function createWorkspaceTask(workspaceId: string, input: TaskWriteInput) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("tasks")
    .insert(toTaskRow(workspaceId, input))
    .select(taskColumns)
    .single();

  if (error) throw error;
  return mapTaskRow(data as TaskRow);
}

export async function updateWorkspaceTask(
  workspaceId: string,
  taskId: string,
  input: TaskWriteInput,
  currentCompletedAt?: string,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("tasks")
    .update(toTaskRow(workspaceId, input, currentCompletedAt))
    .eq("workspace_id", workspaceId)
    .eq("id", taskId)
    .select(taskColumns)
    .single();

  if (error) throw error;
  return mapTaskRow(data as TaskRow);
}

export async function completeWorkspaceTask(
  workspaceId: string,
  taskId: string,
  currentCompletedAt?: string,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("tasks")
    .update({
      completed_at: currentCompletedAt ?? new Date().toISOString(),
      status: "Done",
    })
    .eq("workspace_id", workspaceId)
    .eq("id", taskId)
    .select(taskColumns)
    .single();

  if (error) throw error;
  return mapTaskRow(data as TaskRow);
}

export async function deleteWorkspaceTask(workspaceId: string, taskId: string) {
  const client = requireSupabase();
  const { error } = await client
    .from("tasks")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", taskId);

  if (error) throw error;
}

function toTaskRow(
  workspaceId: string,
  input: TaskWriteInput,
  currentCompletedAt?: string,
) {
  return {
    completed_at: input.status === "Done"
      ? currentCompletedAt ?? new Date().toISOString()
      : null,
    due_date: input.dueDate,
    event_id: input.eventId,
    owner: input.owner,
    priority: input.priority,
    status: input.status,
    title: input.title,
    workspace_id: workspaceId,
  };
}

function mapTaskRow(row: TaskRow): Task {
  return {
    completedAt: row.completed_at ?? undefined,
    dueDate: row.due_date,
    eventId: row.event_id,
    id: row.id,
    owner: row.owner,
    priority: row.priority,
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

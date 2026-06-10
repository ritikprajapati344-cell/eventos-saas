import { useCallback, useEffect, useState } from "react";
import {
  completeWorkspaceTask,
  createWorkspaceTask,
  deleteWorkspaceTask,
  listWorkspaceTasks,
  updateWorkspaceTask,
  type TaskWriteInput,
} from "../lib/tasksRepository";
import { supabaseConfiguration } from "../lib/supabase";
import type { Task } from "../types";

export interface TasksDataSource {
  clearError: () => void;
  completeTask: (taskId: string) => Promise<Task>;
  createTask: (input: TaskWriteInput) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
  isSupabaseMode: boolean;
  tasks: Task[];
  updateTask: (taskId: string, input: TaskWriteInput) => Promise<Task>;
}

export function useTasksData(workspaceId: string | null): TasksDataSource {
  const isSupabaseMode = supabaseConfiguration.dataMode === "supabase";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseMode);

  useEffect(() => {
    let active = true;

    if (!isSupabaseMode) {
      setTasks([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!workspaceId) {
      setTasks([]);
      setError("No authenticated EventOS workspace is available.");
      setIsLoading(false);
      return;
    }

    setTasks([]);
    setError(null);
    setIsLoading(true);

    void listWorkspaceTasks(workspaceId)
      .then((nextTasks) => {
        if (active) setTasks(nextTasks);
      })
      .catch((loadError) => {
        if (!active) return;
        setTasks([]);
        setError(getErrorMessage(loadError, "Unable to load tasks from Supabase."));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isSupabaseMode, workspaceId]);

  const requireWorkspace = useCallback(() => {
    if (!isSupabaseMode) {
      throw new Error("Supabase Task operations are unavailable in local mode.");
    }
    if (!workspaceId) {
      throw new Error("No authenticated EventOS workspace is available.");
    }
    return workspaceId;
  }, [isSupabaseMode, workspaceId]);

  const createTask = useCallback(async (input: TaskWriteInput) => {
    setError(null);
    try {
      const createdTask = await createWorkspaceTask(requireWorkspace(), input);
      setTasks((current) => sortTasks([createdTask, ...current]));
      return createdTask;
    } catch (createError) {
      const message = getErrorMessage(createError, "Unable to create the task in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const updateTask = useCallback(async (taskId: string, input: TaskWriteInput) => {
    setError(null);
    try {
      const currentTask = tasks.find((task) => task.id === taskId);
      const updatedTask = await updateWorkspaceTask(
        requireWorkspace(),
        taskId,
        input,
        currentTask?.completedAt,
      );
      setTasks((current) => sortTasks(current.map((task) => (
        task.id === taskId ? updatedTask : task
      ))));
      return updatedTask;
    } catch (updateError) {
      const message = getErrorMessage(updateError, "Unable to update the task in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace, tasks]);

  const completeTask = useCallback(async (taskId: string) => {
    setError(null);
    try {
      const currentTask = tasks.find((task) => task.id === taskId);
      const completedTask = await completeWorkspaceTask(
        requireWorkspace(),
        taskId,
        currentTask?.completedAt,
      );
      setTasks((current) => sortTasks(current.map((task) => (
        task.id === taskId ? completedTask : task
      ))));
      return completedTask;
    } catch (completeError) {
      const message = getErrorMessage(completeError, "Unable to complete the task in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace, tasks]);

  const deleteTask = useCallback(async (taskId: string) => {
    setError(null);
    try {
      await deleteWorkspaceTask(requireWorkspace(), taskId);
      setTasks((current) => current.filter((task) => task.id !== taskId));
    } catch (deleteError) {
      const message = getErrorMessage(deleteError, "Unable to delete the task from Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  return {
    clearError: () => setError(null),
    completeTask,
    createTask,
    deleteTask,
    error,
    isLoading,
    isSupabaseMode,
    tasks,
    updateTask,
  };
}

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => (
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  ));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

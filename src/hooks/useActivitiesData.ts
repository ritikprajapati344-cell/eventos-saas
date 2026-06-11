import { useCallback, useEffect, useState } from "react";
import {
  createWorkspaceActivity,
  listWorkspaceActivities,
  type ActivityWriteInput,
} from "../lib/activitiesRepository";
import { supabaseConfiguration } from "../lib/supabase";
import type { Activity } from "../types";

export interface ActivitiesDataSource {
  activities: Activity[];
  clearError: () => void;
  createActivity: (input: ActivityWriteInput) => Promise<Activity>;
  error: string | null;
  isLoading: boolean;
  isSupabaseMode: boolean;
}

export function useActivitiesData(workspaceId: string | null): ActivitiesDataSource {
  const isSupabaseMode = supabaseConfiguration.dataMode === "supabase";
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseMode);

  useEffect(() => {
    let active = true;

    if (!isSupabaseMode) {
      setActivities([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!workspaceId) {
      setActivities([]);
      setError("No authenticated EventOS workspace is available.");
      setIsLoading(false);
      return;
    }

    setActivities([]);
    setError(null);
    setIsLoading(true);

    void listWorkspaceActivities(workspaceId)
      .then((nextActivities) => {
        if (active) setActivities(nextActivities);
      })
      .catch((loadError) => {
        if (!active) return;
        setActivities([]);
        setError(getErrorMessage(loadError, "Unable to load activities from Supabase."));
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
      throw new Error("Supabase Activity operations are unavailable in local mode.");
    }
    if (!workspaceId) {
      throw new Error("No authenticated EventOS workspace is available.");
    }
    return workspaceId;
  }, [isSupabaseMode, workspaceId]);

  const createActivity = useCallback(async (input: ActivityWriteInput) => {
    setError(null);
    try {
      const createdActivity = await createWorkspaceActivity(requireWorkspace(), input);
      setActivities((current) => [createdActivity, ...current]);
      return createdActivity;
    } catch (createError) {
      const message = getErrorMessage(createError, "Unable to save the activity in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  return {
    activities,
    clearError: () => setError(null),
    createActivity,
    error,
    isLoading,
    isSupabaseMode,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

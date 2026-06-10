import { useCallback, useEffect, useState } from "react";
import {
  createWorkspaceTimelineItem,
  deleteWorkspaceTimelineItem,
  listWorkspaceTimelineItems,
  updateWorkspaceTimelineItem,
  type TimelineWriteInput,
} from "../lib/timelineRepository";
import { supabaseConfiguration } from "../lib/supabase";
import type { TimelineItem } from "../types";

export interface TimelineDataSource {
  clearError: () => void;
  createTimelineItem: (input: TimelineWriteInput) => Promise<TimelineItem>;
  deleteTimelineItem: (timelineItemId: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
  isSupabaseMode: boolean;
  timeline: TimelineItem[];
  updateTimelineItem: (timelineItemId: string, input: TimelineWriteInput) => Promise<TimelineItem>;
}

export function useTimelineData(workspaceId: string | null): TimelineDataSource {
  const isSupabaseMode = supabaseConfiguration.dataMode === "supabase";
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseMode);

  useEffect(() => {
    let active = true;

    if (!isSupabaseMode) {
      setTimeline([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!workspaceId) {
      setTimeline([]);
      setError("No authenticated EventOS workspace is available.");
      setIsLoading(false);
      return;
    }

    setTimeline([]);
    setError(null);
    setIsLoading(true);

    void listWorkspaceTimelineItems(workspaceId)
      .then((nextTimeline) => {
        if (active) setTimeline(nextTimeline);
      })
      .catch((loadError) => {
        if (!active) return;
        setTimeline([]);
        setError(getErrorMessage(loadError, "Unable to load timeline items from Supabase."));
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
      throw new Error("Supabase Timeline operations are unavailable in local mode.");
    }
    if (!workspaceId) {
      throw new Error("No authenticated EventOS workspace is available.");
    }
    return workspaceId;
  }, [isSupabaseMode, workspaceId]);

  const createTimelineItem = useCallback(async (input: TimelineWriteInput) => {
    setError(null);
    try {
      const createdItem = await createWorkspaceTimelineItem(requireWorkspace(), input);
      setTimeline((current) => sortTimeline([createdItem, ...current]));
      return createdItem;
    } catch (createError) {
      const message = getErrorMessage(createError, "Unable to create the timeline item in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const updateTimelineItem = useCallback(async (
    timelineItemId: string,
    input: TimelineWriteInput,
  ) => {
    setError(null);
    try {
      const updatedItem = await updateWorkspaceTimelineItem(
        requireWorkspace(),
        timelineItemId,
        input,
      );
      setTimeline((current) => sortTimeline(current.map((item) => (
        item.id === timelineItemId ? updatedItem : item
      ))));
      return updatedItem;
    } catch (updateError) {
      const message = getErrorMessage(updateError, "Unable to update the timeline item in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const deleteTimelineItem = useCallback(async (timelineItemId: string) => {
    setError(null);
    try {
      await deleteWorkspaceTimelineItem(requireWorkspace(), timelineItemId);
      setTimeline((current) => current.filter((item) => item.id !== timelineItemId));
    } catch (deleteError) {
      const message = getErrorMessage(deleteError, "Unable to delete the timeline item from Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  return {
    clearError: () => setError(null),
    createTimelineItem,
    deleteTimelineItem,
    error,
    isLoading,
    isSupabaseMode,
    timeline,
    updateTimelineItem,
  };
}

function sortTimeline(timeline: TimelineItem[]) {
  return [...timeline].sort((a, b) => (
    new Date(a.date).getTime() - new Date(b.date).getTime()
  ));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

import { useCallback, useEffect, useState } from "react";
import {
  createWorkspaceEvent,
  deleteWorkspaceEvent,
  listWorkspaceEvents,
  updateWorkspaceEvent,
  updateWorkspaceEventNotes,
  type EventWriteInput,
  type SafeEventDeletionResult,
} from "../lib/eventsRepository";
import { supabaseConfiguration } from "../lib/supabase";
import type { EventItem } from "../types";

export interface EventsDataSource {
  clearError: () => void;
  createEvent: (input: EventWriteInput) => Promise<EventItem>;
  deleteEvent: (eventId: string) => Promise<SafeEventDeletionResult>;
  error: string | null;
  events: EventItem[];
  isLoading: boolean;
  isSupabaseMode: boolean;
  updateEvent: (eventId: string, input: EventWriteInput) => Promise<EventItem>;
  updateEventNotes: (eventId: string, notes: string) => Promise<EventItem>;
}

export function useEventsData(workspaceId: string | null): EventsDataSource {
  const isSupabaseMode = supabaseConfiguration.dataMode === "supabase";
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseMode);

  useEffect(() => {
    let active = true;

    if (!isSupabaseMode) {
      setEvents([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!workspaceId) {
      setEvents([]);
      setError("No authenticated EventOS workspace is available.");
      setIsLoading(false);
      return;
    }

    setEvents([]);
    setError(null);
    setIsLoading(true);

    void listWorkspaceEvents(workspaceId)
      .then((nextEvents) => {
        if (active) setEvents(nextEvents);
      })
      .catch((loadError) => {
        if (!active) return;
        setEvents([]);
        setError(getErrorMessage(loadError, "Unable to load events from Supabase."));
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
      throw new Error("Supabase Events operations are unavailable in local mode.");
    }
    if (!workspaceId) {
      throw new Error("No authenticated EventOS workspace is available.");
    }
    return workspaceId;
  }, [isSupabaseMode, workspaceId]);

  const createEvent = useCallback(async (input: EventWriteInput) => {
    setError(null);
    try {
      const createdEvent = await createWorkspaceEvent(requireWorkspace(), input);
      setEvents((current) => [createdEvent, ...current]);
      return createdEvent;
    } catch (createError) {
      const message = getErrorMessage(createError, "Unable to create the event in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const updateEvent = useCallback(async (eventId: string, input: EventWriteInput) => {
    setError(null);
    try {
      const updatedEvent = await updateWorkspaceEvent(requireWorkspace(), eventId, input);
      setEvents((current) => current.map((event) => (event.id === eventId ? updatedEvent : event)));
      return updatedEvent;
    } catch (updateError) {
      const message = getErrorMessage(updateError, "Unable to update the event in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const updateEventNotes = useCallback(async (eventId: string, notes: string) => {
    setError(null);
    try {
      const updatedEvent = await updateWorkspaceEventNotes(requireWorkspace(), eventId, notes);
      setEvents((current) => current.map((event) => (event.id === eventId ? updatedEvent : event)));
      return updatedEvent;
    } catch (updateError) {
      const message = getErrorMessage(updateError, "Unable to save event notes in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const deleteEvent = useCallback(async (eventId: string) => {
    setError(null);
    try {
      const result = await deleteWorkspaceEvent(requireWorkspace(), eventId);
      setEvents((current) => current.filter((event) => event.id !== eventId));
      return result;
    } catch (deleteError) {
      const message = getErrorMessage(deleteError, "Unable to delete the event from Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  return {
    clearError: () => setError(null),
    createEvent,
    deleteEvent,
    error,
    events,
    isLoading,
    isSupabaseMode,
    updateEvent,
    updateEventNotes,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

import { useCallback, useEffect, useState } from "react";
import {
  createWorkspaceTicketCategory,
  deleteWorkspaceTicketCategory,
  listWorkspaceTicketCategories,
  updateWorkspaceTicketCategory,
  type TicketCategoryWriteInput,
} from "../lib/ticketCategoriesRepository";
import { supabaseConfiguration } from "../lib/supabase";
import type { TicketCategory } from "../types";

export interface TicketingDataSource {
  clearError: () => void;
  createTicketCategory: (input: TicketCategoryWriteInput) => Promise<TicketCategory>;
  deleteTicketCategory: (ticketCategoryId: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
  isSupabaseMode: boolean;
  ticketCategories: TicketCategory[];
  updateTicketCategory: (
    ticketCategoryId: string,
    input: TicketCategoryWriteInput,
  ) => Promise<TicketCategory>;
}

export function useTicketingData(workspaceId: string | null): TicketingDataSource {
  const isSupabaseMode = supabaseConfiguration.dataMode === "supabase";
  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseMode);

  useEffect(() => {
    let active = true;

    if (!isSupabaseMode) {
      setTicketCategories([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!workspaceId) {
      setTicketCategories([]);
      setError("No authenticated EventOS workspace is available.");
      setIsLoading(false);
      return;
    }

    setTicketCategories([]);
    setError(null);
    setIsLoading(true);

    void listWorkspaceTicketCategories(workspaceId)
      .then((nextTicketCategories) => {
        if (active) setTicketCategories(nextTicketCategories);
      })
      .catch((loadError) => {
        if (!active) return;
        setTicketCategories([]);
        setError(getErrorMessage(loadError, "Unable to load ticket categories from Supabase."));
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
      throw new Error("Supabase Ticketing operations are unavailable in local mode.");
    }
    if (!workspaceId) {
      throw new Error("No authenticated EventOS workspace is available.");
    }
    return workspaceId;
  }, [isSupabaseMode, workspaceId]);

  const createTicketCategory = useCallback(async (input: TicketCategoryWriteInput) => {
    setError(null);
    try {
      const createdTicketCategory = await createWorkspaceTicketCategory(requireWorkspace(), input);
      setTicketCategories((current) => [createdTicketCategory, ...current]);
      return createdTicketCategory;
    } catch (createError) {
      const message = getErrorMessage(createError, "Unable to create the ticket category in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const updateTicketCategory = useCallback(async (
    ticketCategoryId: string,
    input: TicketCategoryWriteInput,
  ) => {
    setError(null);
    try {
      const updatedTicketCategory = await updateWorkspaceTicketCategory(
        requireWorkspace(),
        ticketCategoryId,
        input,
      );
      setTicketCategories((current) => current.map((ticketCategory) => (
        ticketCategory.id === ticketCategoryId ? updatedTicketCategory : ticketCategory
      )));
      return updatedTicketCategory;
    } catch (updateError) {
      const message = getErrorMessage(updateError, "Unable to update the ticket category in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const deleteTicketCategory = useCallback(async (ticketCategoryId: string) => {
    setError(null);
    try {
      await deleteWorkspaceTicketCategory(requireWorkspace(), ticketCategoryId);
      setTicketCategories((current) => current.filter((ticketCategory) => ticketCategory.id !== ticketCategoryId));
    } catch (deleteError) {
      const message = getErrorMessage(deleteError, "Unable to delete the ticket category from Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  return {
    clearError: () => setError(null),
    createTicketCategory,
    deleteTicketCategory,
    error,
    isLoading,
    isSupabaseMode,
    ticketCategories,
    updateTicketCategory,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

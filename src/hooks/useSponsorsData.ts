import { useCallback, useEffect, useState } from "react";
import {
  createWorkspaceSponsor,
  deleteWorkspaceSponsor,
  listWorkspaceSponsors,
  updateWorkspaceSponsor,
  updateWorkspaceSponsorStage,
  type SponsorWriteInput,
} from "../lib/sponsorsRepository";
import { supabaseConfiguration } from "../lib/supabase";
import type { Sponsor, SponsorStatus } from "../types";

export interface SponsorsDataSource {
  changeStage: (sponsorId: string, status: SponsorStatus) => Promise<Sponsor>;
  clearError: () => void;
  createSponsor: (input: SponsorWriteInput) => Promise<Sponsor>;
  deleteSponsor: (sponsorId: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
  isSupabaseMode: boolean;
  sponsors: Sponsor[];
  updateSponsor: (sponsorId: string, input: SponsorWriteInput) => Promise<Sponsor>;
}

export function useSponsorsData(workspaceId: string | null): SponsorsDataSource {
  const isSupabaseMode = supabaseConfiguration.dataMode === "supabase";
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseMode);

  useEffect(() => {
    let active = true;

    if (!isSupabaseMode) {
      setSponsors([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!workspaceId) {
      setSponsors([]);
      setError("No authenticated EventOS workspace is available.");
      setIsLoading(false);
      return;
    }

    setSponsors([]);
    setError(null);
    setIsLoading(true);

    void listWorkspaceSponsors(workspaceId)
      .then((nextSponsors) => {
        if (active) setSponsors(nextSponsors);
      })
      .catch((loadError) => {
        if (!active) return;
        setSponsors([]);
        setError(getErrorMessage(loadError, "Unable to load sponsors from Supabase."));
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
      throw new Error("Supabase Sponsor operations are unavailable in local mode.");
    }
    if (!workspaceId) {
      throw new Error("No authenticated EventOS workspace is available.");
    }
    return workspaceId;
  }, [isSupabaseMode, workspaceId]);

  const createSponsor = useCallback(async (input: SponsorWriteInput) => {
    setError(null);
    try {
      const createdSponsor = await createWorkspaceSponsor(requireWorkspace(), input);
      setSponsors((current) => [createdSponsor, ...current]);
      return createdSponsor;
    } catch (createError) {
      const message = getErrorMessage(createError, "Unable to create the sponsor in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const updateSponsor = useCallback(async (sponsorId: string, input: SponsorWriteInput) => {
    setError(null);
    try {
      const updatedSponsor = await updateWorkspaceSponsor(requireWorkspace(), sponsorId, input);
      setSponsors((current) => current.map((sponsor) => (sponsor.id === sponsorId ? updatedSponsor : sponsor)));
      return updatedSponsor;
    } catch (updateError) {
      const message = getErrorMessage(updateError, "Unable to update the sponsor in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const changeStage = useCallback(async (sponsorId: string, status: SponsorStatus) => {
    setError(null);
    try {
      const updatedSponsor = await updateWorkspaceSponsorStage(requireWorkspace(), sponsorId, status);
      setSponsors((current) => current.map((sponsor) => (sponsor.id === sponsorId ? updatedSponsor : sponsor)));
      return updatedSponsor;
    } catch (stageError) {
      const message = getErrorMessage(stageError, "Unable to change the sponsor stage in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const deleteSponsor = useCallback(async (sponsorId: string) => {
    setError(null);
    try {
      await deleteWorkspaceSponsor(requireWorkspace(), sponsorId);
      setSponsors((current) => current.filter((sponsor) => sponsor.id !== sponsorId));
    } catch (deleteError) {
      const message = getErrorMessage(deleteError, "Unable to delete the sponsor from Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  return {
    changeStage,
    clearError: () => setError(null),
    createSponsor,
    deleteSponsor,
    error,
    isLoading,
    isSupabaseMode,
    sponsors,
    updateSponsor,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

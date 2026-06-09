import { useCallback, useEffect, useState } from "react";
import {
  createWorkspaceArtist,
  deleteWorkspaceArtist,
  listWorkspaceArtists,
  updateWorkspaceArtist,
  updateWorkspaceArtistContract,
  type ArtistContractStatus,
  type ArtistWriteInput,
} from "../lib/artistsRepository";
import { supabaseConfiguration } from "../lib/supabase";
import type { Artist } from "../types";

export interface ArtistsDataSource {
  changeContractStatus: (artistId: string, status: ArtistContractStatus) => Promise<Artist>;
  clearError: () => void;
  createArtist: (input: ArtistWriteInput) => Promise<Artist>;
  deleteArtist: (artistId: string) => Promise<void>;
  error: string | null;
  artists: Artist[];
  isLoading: boolean;
  isSupabaseMode: boolean;
  updateArtist: (artistId: string, input: ArtistWriteInput) => Promise<Artist>;
}

export function useArtistsData(workspaceId: string | null): ArtistsDataSource {
  const isSupabaseMode = supabaseConfiguration.dataMode === "supabase";
  const [artists, setArtists] = useState<Artist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseMode);

  useEffect(() => {
    let active = true;

    if (!isSupabaseMode) {
      setArtists([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!workspaceId) {
      setArtists([]);
      setError("No authenticated EventOS workspace is available.");
      setIsLoading(false);
      return;
    }

    setArtists([]);
    setError(null);
    setIsLoading(true);

    void listWorkspaceArtists(workspaceId)
      .then((nextArtists) => {
        if (active) setArtists(nextArtists);
      })
      .catch((loadError) => {
        if (!active) return;
        setArtists([]);
        setError(getErrorMessage(loadError, "Unable to load artists from Supabase."));
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
      throw new Error("Supabase Artist operations are unavailable in local mode.");
    }
    if (!workspaceId) {
      throw new Error("No authenticated EventOS workspace is available.");
    }
    return workspaceId;
  }, [isSupabaseMode, workspaceId]);

  const createArtist = useCallback(async (input: ArtistWriteInput) => {
    setError(null);
    try {
      const createdArtist = await createWorkspaceArtist(requireWorkspace(), input);
      setArtists((current) => [createdArtist, ...current]);
      return createdArtist;
    } catch (createError) {
      const message = getErrorMessage(createError, "Unable to create the artist in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const updateArtist = useCallback(async (artistId: string, input: ArtistWriteInput) => {
    setError(null);
    try {
      const updatedArtist = await updateWorkspaceArtist(requireWorkspace(), artistId, input);
      setArtists((current) => current.map((artist) => (artist.id === artistId ? updatedArtist : artist)));
      return updatedArtist;
    } catch (updateError) {
      const message = getErrorMessage(updateError, "Unable to update the artist in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const changeContractStatus = useCallback(async (
    artistId: string,
    status: ArtistContractStatus,
  ) => {
    setError(null);
    try {
      const updatedArtist = await updateWorkspaceArtistContract(requireWorkspace(), artistId, status);
      setArtists((current) => current.map((artist) => (artist.id === artistId ? updatedArtist : artist)));
      return updatedArtist;
    } catch (contractError) {
      const message = getErrorMessage(contractError, "Unable to change the artist contract status.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const deleteArtist = useCallback(async (artistId: string) => {
    setError(null);
    try {
      await deleteWorkspaceArtist(requireWorkspace(), artistId);
      setArtists((current) => current.filter((artist) => artist.id !== artistId));
    } catch (deleteError) {
      const message = getErrorMessage(deleteError, "Unable to delete the artist from Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  return {
    artists,
    changeContractStatus,
    clearError: () => setError(null),
    createArtist,
    deleteArtist,
    error,
    isLoading,
    isSupabaseMode,
    updateArtist,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

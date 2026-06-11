import { useCallback, useEffect, useState } from "react";
import {
  createEventFileSignedUrl,
  deleteWorkspaceEventFile,
  listWorkspaceEventFiles,
  removeWorkspaceEventStorageObjects,
  uploadWorkspaceEventFile,
} from "../lib/eventFilesRepository";
import { supabaseConfiguration } from "../lib/supabase";
import type { EventFile } from "../types";

export interface EventFilesDataSource {
  clearError: () => void;
  createDownloadUrl: (file: EventFile) => Promise<string>;
  createViewUrl: (file: EventFile) => Promise<string>;
  deleteFile: (file: EventFile) => Promise<void>;
  error: string | null;
  files: EventFile[];
  forgetEventFiles: (eventId: string) => void;
  isLoading: boolean;
  isSupabaseMode: boolean;
  removeEventStorageObjects: (eventId: string) => Promise<void>;
  uploadFile: (eventId: string, file: File) => Promise<EventFile>;
}

export function useEventFilesData(
  workspaceId: string | null,
  userId: string | null,
): EventFilesDataSource {
  const isSupabaseMode = supabaseConfiguration.dataMode === "supabase";
  const [files, setFiles] = useState<EventFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseMode);

  useEffect(() => {
    let active = true;

    if (!isSupabaseMode) {
      setFiles([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!workspaceId) {
      setFiles([]);
      setError("No authenticated EventOS workspace is available.");
      setIsLoading(false);
      return;
    }

    setFiles([]);
    setError(null);
    setIsLoading(true);

    void listWorkspaceEventFiles(workspaceId)
      .then((nextFiles) => {
        if (active) setFiles(nextFiles);
      })
      .catch((loadError) => {
        if (!active) return;
        setFiles([]);
        setError(getErrorMessage(loadError, "Unable to load event files from Supabase."));
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
      throw new Error("Supabase Event File operations are unavailable in local mode.");
    }
    if (!workspaceId) {
      throw new Error("No authenticated EventOS workspace is available.");
    }
    return workspaceId;
  }, [isSupabaseMode, workspaceId]);

  const requireUser = useCallback(() => {
    if (!userId) {
      throw new Error("No authenticated EventOS user is available.");
    }
    return userId;
  }, [userId]);

  const uploadFile = useCallback(async (eventId: string, file: File) => {
    setError(null);
    try {
      const uploadedFile = await uploadWorkspaceEventFile(
        requireWorkspace(),
        eventId,
        requireUser(),
        file,
      );
      setFiles((current) => [uploadedFile, ...current]);
      return uploadedFile;
    } catch (uploadError) {
      const message = getErrorMessage(uploadError, "Unable to upload the event file to Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireUser, requireWorkspace]);

  const createViewUrl = useCallback(async (file: EventFile) => {
    setError(null);
    try {
      return await createEventFileSignedUrl(file);
    } catch (viewError) {
      const message = getErrorMessage(viewError, "Unable to open the event file.");
      setError(message);
      throw new Error(message);
    }
  }, []);

  const createDownloadUrl = useCallback(async (file: EventFile) => {
    setError(null);
    try {
      return await createEventFileSignedUrl(file, { download: true });
    } catch (downloadError) {
      const message = getErrorMessage(downloadError, "Unable to download the event file.");
      setError(message);
      throw new Error(message);
    }
  }, []);

  const deleteFile = useCallback(async (file: EventFile) => {
    setError(null);
    try {
      await deleteWorkspaceEventFile(requireWorkspace(), file);
      setFiles((current) => current.filter((item) => item.id !== file.id));
    } catch (deleteError) {
      const message = getErrorMessage(deleteError, "Unable to delete the event file.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const removeEventStorageObjects = useCallback(async (eventId: string) => {
    setError(null);
    try {
      await removeWorkspaceEventStorageObjects(requireWorkspace(), eventId);
    } catch (cleanupError) {
      const message = getErrorMessage(cleanupError, "Unable to clean up the event files from Storage.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const forgetEventFiles = useCallback((eventId: string) => {
    setFiles((current) => current.filter((file) => file.eventId !== eventId));
  }, []);

  return {
    clearError: () => setError(null),
    createDownloadUrl,
    createViewUrl,
    deleteFile,
    error,
    files,
    forgetEventFiles,
    isLoading,
    isSupabaseMode,
    removeEventStorageObjects,
    uploadFile,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

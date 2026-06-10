import { useCallback, useEffect, useState } from "react";
import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
  type WorkspaceSettingsRecord,
  type WorkspaceSettingsWriteInput,
} from "../lib/workspaceSettingsRepository";
import { supabaseConfiguration } from "../lib/supabase";

export interface SettingsDataSource {
  clearError: () => void;
  error: string | null;
  isLoading: boolean;
  isSupabaseMode: boolean;
  saveSettings: (
    input: WorkspaceSettingsWriteInput,
  ) => Promise<WorkspaceSettingsRecord>;
  settings: WorkspaceSettingsRecord | null;
}

export function useSettingsData(workspaceId: string | null): SettingsDataSource {
  const isSupabaseMode = supabaseConfiguration.dataMode === "supabase";
  const [settings, setSettings] = useState<WorkspaceSettingsRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseMode);

  useEffect(() => {
    let active = true;

    if (!isSupabaseMode) {
      setSettings(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!workspaceId) {
      setSettings(null);
      setError("No authenticated EventOS workspace is available.");
      setIsLoading(false);
      return;
    }

    setSettings(null);
    setError(null);
    setIsLoading(true);

    void getWorkspaceSettings(workspaceId)
      .then((nextSettings) => {
        if (active) setSettings(nextSettings);
      })
      .catch((loadError) => {
        if (!active) return;
        setSettings(null);
        setError(
          getErrorMessage(
            loadError,
            "Unable to load workspace settings from Supabase.",
          ),
        );
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
      throw new Error(
        "Supabase Settings operations are unavailable in local mode.",
      );
    }
    if (!workspaceId) {
      throw new Error("No authenticated EventOS workspace is available.");
    }
    return workspaceId;
  }, [isSupabaseMode, workspaceId]);

  const saveSettings = useCallback(
    async (input: WorkspaceSettingsWriteInput) => {
      setError(null);
      try {
        const updatedSettings = await updateWorkspaceSettings(
          requireWorkspace(),
          input,
          settings?.preferences ?? {},
        );
        setSettings(updatedSettings);
        return updatedSettings;
      } catch (saveError) {
        const message = getErrorMessage(
          saveError,
          "Unable to save workspace settings to Supabase.",
        );
        setError(message);
        throw new Error(message);
      }
    },
    [requireWorkspace, settings?.preferences],
  );

  return {
    clearError: () => setError(null),
    error,
    isLoading,
    isSupabaseMode,
    saveSettings,
    settings,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

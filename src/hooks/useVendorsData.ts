import { useCallback, useEffect, useState } from "react";
import {
  createWorkspaceVendor,
  deleteWorkspaceVendor,
  listWorkspaceVendors,
  updateWorkspaceVendor,
  type VendorWriteInput,
} from "../lib/vendorsRepository";
import { supabaseConfiguration } from "../lib/supabase";
import type { Vendor } from "../types";

export interface VendorsDataSource {
  clearError: () => void;
  createVendor: (input: VendorWriteInput) => Promise<Vendor>;
  deleteVendor: (vendorId: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
  isSupabaseMode: boolean;
  updateVendor: (vendorId: string, input: VendorWriteInput) => Promise<Vendor>;
  vendors: Vendor[];
}

export function useVendorsData(workspaceId: string | null): VendorsDataSource {
  const isSupabaseMode = supabaseConfiguration.dataMode === "supabase";
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseMode);

  useEffect(() => {
    let active = true;

    if (!isSupabaseMode) {
      setVendors([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!workspaceId) {
      setVendors([]);
      setError("No authenticated EventOS workspace is available.");
      setIsLoading(false);
      return;
    }

    setVendors([]);
    setError(null);
    setIsLoading(true);

    void listWorkspaceVendors(workspaceId)
      .then((nextVendors) => {
        if (active) setVendors(nextVendors);
      })
      .catch((loadError) => {
        if (!active) return;
        setVendors([]);
        setError(getErrorMessage(loadError, "Unable to load vendors from Supabase."));
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
      throw new Error("Supabase Vendor operations are unavailable in local mode.");
    }
    if (!workspaceId) {
      throw new Error("No authenticated EventOS workspace is available.");
    }
    return workspaceId;
  }, [isSupabaseMode, workspaceId]);

  const createVendor = useCallback(async (input: VendorWriteInput) => {
    setError(null);
    try {
      const createdVendor = await createWorkspaceVendor(requireWorkspace(), input);
      setVendors((current) => [createdVendor, ...current]);
      return createdVendor;
    } catch (createError) {
      const message = getErrorMessage(createError, "Unable to create the vendor in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const updateVendor = useCallback(async (vendorId: string, input: VendorWriteInput) => {
    setError(null);
    try {
      const updatedVendor = await updateWorkspaceVendor(requireWorkspace(), vendorId, input);
      setVendors((current) => current.map((vendor) => (vendor.id === vendorId ? updatedVendor : vendor)));
      return updatedVendor;
    } catch (updateError) {
      const message = getErrorMessage(updateError, "Unable to update the vendor in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const deleteVendor = useCallback(async (vendorId: string) => {
    setError(null);
    try {
      await deleteWorkspaceVendor(requireWorkspace(), vendorId);
      setVendors((current) => current.filter((vendor) => vendor.id !== vendorId));
    } catch (deleteError) {
      const message = getErrorMessage(deleteError, "Unable to delete the vendor from Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  return {
    clearError: () => setError(null),
    createVendor,
    deleteVendor,
    error,
    isLoading,
    isSupabaseMode,
    updateVendor,
    vendors,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

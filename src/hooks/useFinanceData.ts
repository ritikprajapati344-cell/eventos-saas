import { useCallback, useEffect, useState } from "react";
import {
  createWorkspaceFinanceTransaction,
  deleteWorkspaceFinanceTransaction,
  listWorkspaceFinanceTransactions,
  updateWorkspaceFinanceTransaction,
  type FinanceTransactionRecord,
  type FinanceTransactionWriteInput,
} from "../lib/financeTransactionsRepository";
import { supabaseConfiguration } from "../lib/supabase";

export interface FinanceDataSource {
  clearError: () => void;
  createTransaction: (
    input: FinanceTransactionWriteInput,
  ) => Promise<FinanceTransactionRecord>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
  isSupabaseMode: boolean;
  transactions: FinanceTransactionRecord[];
  updateTransaction: (
    transactionId: string,
    input: FinanceTransactionWriteInput,
  ) => Promise<FinanceTransactionRecord>;
}

export function useFinanceData(workspaceId: string | null): FinanceDataSource {
  const isSupabaseMode = supabaseConfiguration.dataMode === "supabase";
  const [transactions, setTransactions] = useState<FinanceTransactionRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseMode);

  useEffect(() => {
    let active = true;

    if (!isSupabaseMode) {
      setTransactions([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!workspaceId) {
      setTransactions([]);
      setError("No authenticated EventOS workspace is available.");
      setIsLoading(false);
      return;
    }

    setTransactions([]);
    setError(null);
    setIsLoading(true);

    void listWorkspaceFinanceTransactions(workspaceId)
      .then((nextTransactions) => {
        if (active) setTransactions(nextTransactions);
      })
      .catch((loadError) => {
        if (!active) return;
        setTransactions([]);
        setError(
          getErrorMessage(
            loadError,
            "Unable to load finance transactions from Supabase.",
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
        "Supabase Finance operations are unavailable in local mode.",
      );
    }
    if (!workspaceId) {
      throw new Error("No authenticated EventOS workspace is available.");
    }
    return workspaceId;
  }, [isSupabaseMode, workspaceId]);

  const createTransaction = useCallback(
    async (input: FinanceTransactionWriteInput) => {
      setError(null);
      try {
        const createdTransaction = await createWorkspaceFinanceTransaction(
          requireWorkspace(),
          input,
        );
        setTransactions((current) => [createdTransaction, ...current]);
        return createdTransaction;
      } catch (createError) {
        const message = getErrorMessage(
          createError,
          "Unable to create the finance transaction in Supabase.",
        );
        setError(message);
        throw new Error(message);
      }
    },
    [requireWorkspace],
  );

  const updateTransaction = useCallback(
    async (
      transactionId: string,
      input: FinanceTransactionWriteInput,
    ) => {
      setError(null);
      try {
        const updatedTransaction = await updateWorkspaceFinanceTransaction(
          requireWorkspace(),
          transactionId,
          input,
        );
        setTransactions((current) =>
          current.map((transaction) =>
            transaction.id === transactionId
              ? updatedTransaction
              : transaction,
          ),
        );
        return updatedTransaction;
      } catch (updateError) {
        const message = getErrorMessage(
          updateError,
          "Unable to update the finance transaction in Supabase.",
        );
        setError(message);
        throw new Error(message);
      }
    },
    [requireWorkspace],
  );

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
      setError(null);
      try {
        await deleteWorkspaceFinanceTransaction(
          requireWorkspace(),
          transactionId,
        );
        setTransactions((current) =>
          current.filter((transaction) => transaction.id !== transactionId),
        );
      } catch (deleteError) {
        const message = getErrorMessage(
          deleteError,
          "Unable to delete the finance transaction from Supabase.",
        );
        setError(message);
        throw new Error(message);
      }
    },
    [requireWorkspace],
  );

  return {
    clearError: () => setError(null),
    createTransaction,
    deleteTransaction,
    error,
    isLoading,
    isSupabaseMode,
    transactions,
    updateTransaction,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

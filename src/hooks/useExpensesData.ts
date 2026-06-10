import { useCallback, useEffect, useState } from "react";
import {
  createWorkspaceExpense,
  deleteWorkspaceExpense,
  listWorkspaceExpenses,
  updateWorkspaceExpense,
  type ExpenseRecord,
  type ExpenseWriteInput,
} from "../lib/expensesRepository";
import { supabaseConfiguration } from "../lib/supabase";

export interface ExpensesDataSource {
  clearError: () => void;
  createExpense: (input: ExpenseWriteInput) => Promise<ExpenseRecord>;
  deleteExpense: (expenseId: string) => Promise<void>;
  error: string | null;
  expenses: ExpenseRecord[];
  isLoading: boolean;
  isSupabaseMode: boolean;
  updateExpense: (expenseId: string, input: ExpenseWriteInput) => Promise<ExpenseRecord>;
}

export function useExpensesData(workspaceId: string | null): ExpensesDataSource {
  const isSupabaseMode = supabaseConfiguration.dataMode === "supabase";
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseMode);

  useEffect(() => {
    let active = true;

    if (!isSupabaseMode) {
      setExpenses([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!workspaceId) {
      setExpenses([]);
      setError("No authenticated EventOS workspace is available.");
      setIsLoading(false);
      return;
    }

    setExpenses([]);
    setError(null);
    setIsLoading(true);

    void listWorkspaceExpenses(workspaceId)
      .then((nextExpenses) => {
        if (active) setExpenses(nextExpenses);
      })
      .catch((loadError) => {
        if (!active) return;
        setExpenses([]);
        setError(getErrorMessage(loadError, "Unable to load expenses from Supabase."));
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
      throw new Error("Supabase Expense operations are unavailable in local mode.");
    }
    if (!workspaceId) {
      throw new Error("No authenticated EventOS workspace is available.");
    }
    return workspaceId;
  }, [isSupabaseMode, workspaceId]);

  const createExpense = useCallback(async (input: ExpenseWriteInput) => {
    setError(null);
    try {
      const createdExpense = await createWorkspaceExpense(requireWorkspace(), input);
      setExpenses((current) => [createdExpense, ...current]);
      return createdExpense;
    } catch (createError) {
      const message = getErrorMessage(createError, "Unable to create the expense in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const updateExpense = useCallback(async (expenseId: string, input: ExpenseWriteInput) => {
    setError(null);
    try {
      const updatedExpense = await updateWorkspaceExpense(requireWorkspace(), expenseId, input);
      setExpenses((current) => current.map((expense) => (expense.id === expenseId ? updatedExpense : expense)));
      return updatedExpense;
    } catch (updateError) {
      const message = getErrorMessage(updateError, "Unable to update the expense in Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  const deleteExpense = useCallback(async (expenseId: string) => {
    setError(null);
    try {
      await deleteWorkspaceExpense(requireWorkspace(), expenseId);
      setExpenses((current) => current.filter((expense) => expense.id !== expenseId));
    } catch (deleteError) {
      const message = getErrorMessage(deleteError, "Unable to delete the expense from Supabase.");
      setError(message);
      throw new Error(message);
    }
  }, [requireWorkspace]);

  return {
    clearError: () => setError(null),
    createExpense,
    deleteExpense,
    error,
    expenses,
    isLoading,
    isSupabaseMode,
    updateExpense,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

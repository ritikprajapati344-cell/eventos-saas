import type { Session, User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export interface AuthContextValue {
  error: string | null;
  isLoading: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  user: User | null;
  workspaceId: string | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const workspaceRequests = useRef(new Map<string, Promise<string>>());

  const ensureWorkspace = useCallback(async (userId: string) => {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const existingRequest = workspaceRequests.current.get(userId);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      const { data, error: workspaceError } = await supabase.rpc("ensure_user_workspace");

      if (workspaceError) throw workspaceError;
      if (typeof data !== "string" || !data) {
        throw new Error("Workspace initialization did not return a workspace ID.");
      }

      return data;
    })();

    workspaceRequests.current.set(userId, request);

    try {
      return await request;
    } catch (requestError) {
      workspaceRequests.current.delete(userId);
      throw requestError;
    }
  }, []);

  const applySession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);

    if (!nextSession?.user) {
      setWorkspaceId(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextWorkspaceId = await ensureWorkspace(nextSession.user.id);
      setWorkspaceId(nextWorkspaceId);
    } catch (sessionError) {
      setWorkspaceId(null);
      setError(getErrorMessage(sessionError));
    } finally {
      setIsLoading(false);
    }
  }, [ensureWorkspace]);

  useEffect(() => {
    let active = true;

    if (!supabase) {
      setError("Supabase is not configured.");
      setIsLoading(false);
      return;
    }

    const client = supabase;

    const initialize = async () => {
      const { data, error: sessionError } = await client.auth.getSession();

      if (!active) return;

      if (sessionError) {
        setError(sessionError.message);
        setIsLoading(false);
        return;
      }

      await applySession(data.session);
    };

    void initialize();

    const { data: authListener } = client.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => {
        if (active) void applySession(nextSession);
      }, 0);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    setIsLoading(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setIsLoading(false);
      setError(signInError.message);
      throw signInError;
    }

    await applySession(data.session);
  }, [applySession]);

  const signOut = useCallback(async () => {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    setIsLoading(true);
    setError(null);

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setIsLoading(false);
      setError(signOutError.message);
      throw signOutError;
    }

    workspaceRequests.current.clear();
    setSession(null);
    setWorkspaceId(null);
    setIsLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    error,
    isLoading,
    session,
    signIn,
    signOut,
    user: session?.user ?? null,
    workspaceId,
  }), [error, isLoading, session, signIn, signOut, workspaceId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return "Unable to initialize the EventOS workspace.";
}

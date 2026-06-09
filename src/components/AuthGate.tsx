import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";

interface AuthGateProps {
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
}

export function AuthGate({
  children,
  fallback = null,
  loadingFallback = null,
}: AuthGateProps) {
  const { isLoading, session, workspaceId } = useAuth();

  if (isLoading) return loadingFallback;
  if (!session || !workspaceId) return fallback;

  return children;
}

import { supabase } from "./supabase";

export interface AIPlanTicketCategory {
  inventory: number;
  name: string;
  price: number;
}

export interface AIEventPlan {
  capacity: number;
  eventName: string;
  revenueForecast: number;
  risks: string[];
  suggestedSponsors: string[];
  suggestedTasks: string[];
  ticketCategories: AIPlanTicketCategory[];
  venue: string;
}

export type AICenterBackendMode = "gemini" | "gemini-fallback" | "missing-secret" | "mock-backend";

export interface AIEventPlanResponse {
  message: string;
  mode: AICenterBackendMode;
  ok: true;
  plan: AIEventPlan;
  warning?: string;
}

export async function generateAIEventPlan(prompt: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured for AI Center requests.");
  }

  const { data, error } = await supabase.functions.invoke<AIEventPlanResponse>("ai-center", {
    body: { prompt },
  });

  if (error) throw error;
  if (!data?.ok || !data.plan) {
    throw new Error("AI Center returned an invalid response.");
  }

  return {
    ...data,
    plan: {
      ...data.plan,
      risks: Array.isArray(data.plan.risks) ? data.plan.risks : [],
    },
  };
}

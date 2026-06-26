import { supabase } from "./supabase";

export interface BlueprintPlannerClarificationAnswers {
  brandingGoal: string;
  budget: number;
  capacity: number;
  city: string;
  eventDate: string;
  eventName: string;
  eventType: string;
  notes: string;
  profitGoal: string;
  revenueTarget: number;
  sponsorPriority: string;
  targetAudience: string;
  ticketSalesGoal: string;
}

export interface BlueprintPlannerRequest {
  blueprintJsonContractVersion: "v1";
  clarificationAnswers: BlueprintPlannerClarificationAnswers;
  currentDate: string;
  futureMemoryContext: {
    enabled: false;
    items: unknown[];
  };
  futureResearchContext: {
    enabled: false;
    sources: unknown[];
  };
  originalCommand: string;
  workspaceContext: {
    currency: "INR";
    eventTypes: string[];
    existingEventsSummary: {
      activeEvents: number;
      completedEvents: number;
      totalEvents: number;
    };
    primaryCities: string[];
    timezone: "Asia/Kolkata";
    workspaceName: string;
  };
}

export interface BlueprintJson {
  approvals: {
    executionPreview?: Record<string, unknown>;
    items?: Array<Record<string, unknown>>;
    requiresApproval?: boolean;
    [key: string]: unknown;
  };
  budget: {
    budgetRisks?: Array<Record<string, unknown>>;
    confidence?: number;
    currency?: string;
    estimatedExpenses?: number;
    expenseBreakdown?: Array<Record<string, unknown>>;
    totalBudget?: number;
    [key: string]: unknown;
  };
  eventSummary: {
    capacity?: number;
    city?: string;
    confidence?: number;
    eventDate?: string;
    eventName?: string;
    eventType?: string;
    executiveSummary?: string;
    targetAudience?: string;
    venueRecommendation?: string;
    [key: string]: unknown;
  };
  jsonVersion?: string;
  marketing: {
    campaignStrategy?: string;
    channels?: string[];
    confidence?: number;
    contentIdeas?: string[];
    launchPlan?: Array<Record<string, unknown>>;
    recommendations?: string[];
    [key: string]: unknown;
  };
  metadata: {
    assumptions: string[];
    contractVersion: string;
    generatedAt?: string;
    generatedBy?: string;
    model?: string;
    schemaNotes: string[];
    warnings: string[];
    [key: string]: unknown;
  };
  revenue: {
    assumptions?: string[];
    breakEvenRevenue?: number;
    confidence?: number;
    currency?: string;
    estimatedProfit?: number;
    projectedRevenue?: number;
    recommendations?: string[];
    sponsorRevenueForecast?: number;
    targetRevenue?: number;
    ticketRevenueForecast?: number;
    [key: string]: unknown;
  };
  risks: {
    confidence?: number;
    items?: Array<Record<string, unknown>>;
    overallRiskLevel?: string;
    overallRiskScore?: number;
    [key: string]: unknown;
  };
  sponsors: {
    categories?: string[];
    confidence?: number;
    outreachPlan?: string[];
    packages?: Array<Record<string, unknown>>;
    pitchStrategy?: string;
    recommendedSponsors?: Array<Record<string, unknown>>;
    targetRevenue?: number;
    [key: string]: unknown;
  };
  status?: string;
  taskChecklist: {
    confidence?: number;
    tasks?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  timeline: {
    confidence?: number;
    milestones?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
}

export interface BlueprintPlannerResponse {
  blueprint: BlueprintJson;
  message: string;
  mode: "gemini";
  ok: true;
}

export async function generateEventBlueprint(request: BlueprintPlannerRequest) {
  if (!supabase) {
    throw new Error("Supabase is not configured for blueprint generation.");
  }

  const { data, error } = await supabase.functions.invoke<unknown>("blueprint-planner", {
    body: request,
  });

  if (error) throw error;

  const response = parseBlueprintPlannerResponse(data);
  return {
    ...response,
    blueprint: validateBlueprintJson(response.blueprint),
  };
}

function parseBlueprintPlannerResponse(value: unknown): BlueprintPlannerResponse {
  if (!isRecord(value)) {
    throw new Error("The AI blueprint response was incomplete. Please try again.");
  }

  if (value.ok !== true || value.mode !== "gemini") {
    const message = typeof value.message === "string" ? value.message : "The AI blueprint response was incomplete. Please try again.";
    throw new Error(message);
  }

  return {
    blueprint: parseMaybeJson(value.blueprint),
    message: typeof value.message === "string" ? value.message : "AI Blueprint Generated",
    mode: "gemini",
    ok: true,
  };
}

export function validateBlueprintJson(value: unknown): BlueprintJson {
  const blueprint = parseMaybeJson(value);

  if (!isRecord(blueprint)) {
    throw new Error("The AI blueprint response was incomplete. Please try again.");
  }

  const requiredSections = [
    "eventSummary",
    "budget",
    "revenue",
    "timeline",
    "sponsors",
    "marketing",
    "risks",
    "taskChecklist",
    "approvals",
    "metadata",
  ];

  const missingSection = requiredSections.find((section) => !isRecord(blueprint[section]));
  if (missingSection) {
    throw new Error("The AI blueprint response was incomplete. Please try again.");
  }

  const metadata = blueprint.metadata;
  if (!isRecord(metadata)) {
    throw new Error("The AI blueprint response was incomplete. Please try again.");
  }

  if (
    typeof metadata.contractVersion !== "string"
    || !Array.isArray(metadata.assumptions)
    || !Array.isArray(metadata.warnings)
    || !Array.isArray(metadata.schemaNotes)
  ) {
    throw new Error("The AI blueprint response was incomplete. Please try again.");
  }

  return blueprint as unknown as BlueprintJson;
}

function parseMaybeJson(value: unknown) {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    const extracted = extractJsonObject(value);
    if (!extracted) throw new Error("The AI blueprint response was incomplete. Please try again.");
    return JSON.parse(extracted);
  }
}

function extractJsonObject(value: string) {
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return "";
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const corsHeaders = {
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*",
  "content-type": "application/json; charset=utf-8",
};

type GeminiPayload = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

type PlannerRequest = {
  blueprintJsonContractVersion?: unknown;
  clarificationAnswers?: unknown;
  currentDate?: unknown;
  futureMemoryContext?: unknown;
  futureResearchContext?: unknown;
  originalCommand?: unknown;
  workspaceContext?: unknown;
};

const requiredBlueprintSections = [
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let body: PlannerRequest;
  try {
    body = await request.json() as PlannerRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  if (!isValidPlannerRequest(body)) {
    return jsonResponse({ error: "Planner request is incomplete." }, 400);
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!geminiApiKey) {
    return jsonResponse({
      error: "missing-secret",
      message: "Blueprint generation is unavailable because the planner AI secret is not configured.",
      ok: false,
    }, 503);
  }

  try {
    const blueprint = await generateBlueprint(geminiApiKey, body);
    validateBlueprint(blueprint);

    return jsonResponse({
      blueprint,
      message: "AI Blueprint Generated",
      mode: "gemini",
      ok: true,
    });
  } catch (error) {
    console.warn("[blueprint-planner]", {
      message: getErrorMessage(error),
      stage: error instanceof PlannerError ? error.stage : "unknown",
    });

    return jsonResponse({
      error: "blueprint-generation-failed",
      message: "The AI blueprint response was incomplete. Please try again.",
      ok: false,
    }, 502);
  }
});

async function generateBlueprint(geminiApiKey: string, request: PlannerRequest) {
  const model = "gemini-2.0-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: buildPlannerPrompt(request) }],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: blueprintResponseSchema,
        temperature: 0.25,
      },
      systemInstruction: {
        parts: [{
          text: [
            "You are EventOS AI Planner Agent.",
            "You are a senior event planning strategist for Indian live events, comedy shows, corporate events, and concerts.",
            "Transform the user command and clarification answers into a Blueprint JSON Contract v1 object.",
            "Never execute actions, create records, approve anything, send messages, or claim external research was performed.",
            "Return JSON only. No markdown, no code fences, no commentary.",
          ].join(" "),
        }],
      },
    }),
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": geminiApiKey,
    },
    method: "POST",
  });

  const responseBody = await response.text();
  if (!response.ok) {
    throw new PlannerError("gemini-http", `Gemini request failed with HTTP ${response.status}.`);
  }

  let payload: GeminiPayload;
  try {
    payload = JSON.parse(responseBody) as GeminiPayload;
  } catch (error) {
    throw new PlannerError("gemini-response-parse", getErrorMessage(error));
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new PlannerError("gemini-empty-text", "Gemini returned no blueprint text.");
  }

  return parseBlueprintText(text);
}

function buildPlannerPrompt(request: PlannerRequest) {
  return [
    "Follow the EventOS AI V2 Planner Agent Contract v1 and Blueprint JSON Contract v1.",
    "Return exactly one valid JSON object.",
    "Required top-level sections: eventSummary, budget, revenue, timeline, sponsors, marketing, risks, taskChecklist, approvals, metadata.",
    "metadata must include contractVersion, assumptions, warnings, and schemaNotes.",
    "metadata.contractVersion must be \"v1\".",
    "Use realistic Indian live event planning assumptions.",
    "Record every safe assumption in metadata.assumptions.",
    "Use metadata.warnings for uncertainty, contradictions, or low confidence.",
    "Use metadata.schemaNotes for schema/version notes.",
    "Approval items must stay proposed. Nothing is approved or executed.",
    "MVP execution preview may propose only event, tasks, timeline items, and ticket categories.",
    "Do not propose sponsor, finance, vendor, artist, email, WhatsApp, payment, or delete execution.",
    "If information is missing, keep all required sections present and mark uncertainty with warnings and assumptions.",
    "Input payload:",
    JSON.stringify(request),
  ].join("\n");
}

function parseBlueprintText(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const extracted = extractJsonObject(text);
    if (!extracted) {
      throw new PlannerError("blueprint-json-extract", "No JSON object found in Gemini response.");
    }

    try {
      return JSON.parse(extracted);
    } catch (error) {
      throw new PlannerError("blueprint-json-parse", getErrorMessage(error));
    }
  }
}

function extractJsonObject(text: string) {
  const cleaned = text
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

function validateBlueprint(value: unknown) {
  if (!isRecord(value)) {
    throw new PlannerError("blueprint-shape", "Blueprint root is not an object.");
  }

  const missingSection = requiredBlueprintSections.find((section) => !isRecord(value[section]));
  if (missingSection) {
    throw new PlannerError("blueprint-section", `Missing required blueprint section: ${missingSection}.`);
  }

  const metadata = value.metadata;
  if (!isRecord(metadata)) {
    throw new PlannerError("blueprint-metadata", "Metadata is missing.");
  }

  if (
    typeof metadata.contractVersion !== "string"
    || !Array.isArray(metadata.assumptions)
    || !Array.isArray(metadata.warnings)
    || !Array.isArray(metadata.schemaNotes)
  ) {
    throw new PlannerError("blueprint-metadata-fields", "Metadata contractVersion, assumptions, warnings, or schemaNotes are missing.");
  }
}

function isValidPlannerRequest(value: PlannerRequest) {
  return (
    typeof value.originalCommand === "string"
    && value.originalCommand.trim().length > 0
    && typeof value.currentDate === "string"
    && value.currentDate.trim().length > 0
    && value.blueprintJsonContractVersion === "v1"
    && isRecord(value.clarificationAnswers)
    && isRecord(value.workspaceContext)
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

class PlannerError extends Error {
  stage: string;

  constructor(stage: string, message: string) {
    super(message);
    this.name = "PlannerError";
    this.stage = stage;
  }
}

const blueprintResponseSchema = {
  type: "object",
  required: requiredBlueprintSections,
  properties: {
    jsonVersion: { type: "string" },
    blueprintId: { type: "string" },
    status: { type: "string" },
    eventSummary: {
      type: "object",
      required: ["eventName", "eventType", "city", "eventDate", "capacity", "targetAudience", "executiveSummary", "confidence"],
      properties: {
        eventName: { type: "string" },
        eventType: { type: "string" },
        city: { type: "string" },
        venueRecommendation: { type: "string" },
        eventDate: { type: "string" },
        capacity: { type: "number" },
        targetAudience: { type: "string" },
        executiveSummary: { type: "string" },
        confidence: { type: "number" },
      },
    },
    budget: {
      type: "object",
      required: ["currency", "totalBudget", "estimatedExpenses", "expenseBreakdown", "budgetRisks", "confidence"],
      properties: {
        currency: { type: "string" },
        totalBudget: { type: "number" },
        estimatedExpenses: { type: "number" },
        expenseBreakdown: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              amount: { type: "number" },
              reason: { type: "string" },
            },
          },
        },
        budgetRisks: { type: "array", items: { type: "object" } },
        confidence: { type: "number" },
      },
    },
    revenue: {
      type: "object",
      required: ["currency", "targetRevenue", "projectedRevenue", "estimatedProfit", "breakEvenRevenue", "ticketRevenueForecast", "sponsorRevenueForecast", "assumptions", "recommendations", "confidence"],
      properties: {
        currency: { type: "string" },
        targetRevenue: { type: "number" },
        projectedRevenue: { type: "number" },
        estimatedProfit: { type: "number" },
        breakEvenRevenue: { type: "number" },
        ticketRevenueForecast: { type: "number" },
        sponsorRevenueForecast: { type: "number" },
        assumptions: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } },
        confidence: { type: "number" },
      },
    },
    timeline: {
      type: "object",
      required: ["milestones", "confidence"],
      properties: {
        milestones: { type: "array", items: { type: "object" } },
        confidence: { type: "number" },
      },
    },
    sponsors: {
      type: "object",
      required: ["targetRevenue", "categories", "recommendedSponsors", "packages", "pitchStrategy", "outreachPlan", "confidence"],
      properties: {
        targetRevenue: { type: "number" },
        categories: { type: "array", items: { type: "string" } },
        recommendedSponsors: { type: "array", items: { type: "object" } },
        packages: { type: "array", items: { type: "object" } },
        pitchStrategy: { type: "string" },
        outreachPlan: { type: "array", items: { type: "string" } },
        confidence: { type: "number" },
      },
    },
    marketing: {
      type: "object",
      required: ["campaignStrategy", "channels", "contentIdeas", "launchPlan", "recommendations", "confidence"],
      properties: {
        campaignStrategy: { type: "string" },
        channels: { type: "array", items: { type: "string" } },
        contentIdeas: { type: "array", items: { type: "string" } },
        launchPlan: { type: "array", items: { type: "object" } },
        estimatedReach: { type: "number" },
        recommendations: { type: "array", items: { type: "string" } },
        confidence: { type: "number" },
      },
    },
    risks: {
      type: "object",
      required: ["overallRiskScore", "overallRiskLevel", "items", "confidence"],
      properties: {
        overallRiskScore: { type: "number" },
        overallRiskLevel: { type: "string" },
        items: { type: "array", items: { type: "object" } },
        confidence: { type: "number" },
      },
    },
    taskChecklist: {
      type: "object",
      required: ["tasks", "confidence"],
      properties: {
        tasks: { type: "array", items: { type: "object" } },
        confidence: { type: "number" },
      },
    },
    approvals: {
      type: "object",
      required: ["requiresApproval", "approvalMode", "items", "executionPreview"],
      properties: {
        requiresApproval: { type: "boolean" },
        approvalMode: { type: "string" },
        items: { type: "array", items: { type: "object" } },
        executionPreview: { type: "object" },
      },
    },
    metadata: {
      type: "object",
      required: ["contractVersion", "assumptions", "warnings", "schemaNotes"],
      properties: {
        contractVersion: { type: "string" },
        generatedAt: { type: "string" },
        generatedBy: { type: "string" },
        model: { type: "string" },
        agentsUsed: { type: "array", items: { type: "string" } },
        researchUsed: { type: "boolean" },
        memoryUsed: { type: "boolean" },
        sourceRequestId: { type: "string" },
        assumptions: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
        schemaNotes: { type: "array", items: { type: "string" } },
      },
    },
  },
};

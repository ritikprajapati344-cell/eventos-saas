const corsHeaders = {
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*",
  "content-type": "application/json; charset=utf-8",
};

type BackendMode = "fallback" | "gemini-backup" | "groq" | "missing-secret";

type EventPlan = {
  capacity: number;
  eventName: string;
  revenueForecast: number;
  risks: string[];
  suggestedSponsors: string[];
  suggestedTasks: string[];
  ticketCategories: Array<{
    inventory: number;
    name: string;
    price: number;
  }>;
  venue: string;
};

type GeminiPayload = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

type GroqPayload = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type PlanCandidate = Partial<EventPlan> & {
  revenue?: unknown;
  sponsors?: unknown;
  tasks?: unknown;
  venueRecommendation?: unknown;
};

type TicketCategoryCandidate = {
  inventory?: unknown;
  name?: unknown;
  price?: unknown;
};

class DiagnosticError extends Error {
  stage: string;

  constructor(stage: string, message: string) {
    super(message);
    this.name = "DiagnosticError";
    this.stage = stage;
  }
}

const fallbackPlan: EventPlan = {
  eventName: "AI-Powered Event Plan",
  venue: "Suggested premium venue",
  capacity: 1200,
  ticketCategories: [
    { name: "Diamond", price: 4500, inventory: 200 },
    { name: "Platinum", price: 3500, inventory: 400 },
    { name: "Gold", price: 3000, inventory: 400 },
    { name: "Silver", price: 2500, inventory: 200 },
  ],
  revenueForecast: 4050000,
  suggestedSponsors: ["Real Estate", "Jewellers", "Automobile", "Education"],
  suggestedTasks: ["Finalize venue", "Confirm artist contract", "Prepare sponsor deck", "Launch ticket campaign"],
  risks: ["Venue dates may be unavailable", "Artist contract delays can affect launch", "Sponsor conversion may take longer than expected"],
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const prompt = typeof body === "object" && body !== null && "prompt" in body
    ? String((body as { prompt?: unknown }).prompt ?? "").trim()
    : "";

  if (!prompt) {
    return jsonResponse({ error: "Prompt is required." }, 400);
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  const groqApiKey = Deno.env.get("GROQ_API_KEY")?.trim();

  if (!groqApiKey && !geminiApiKey) {
    logDiagnostic("fallback-trigger", {
      reason: "Both GROQ_API_KEY and GEMINI_API_KEY are missing.",
      stage: "missing-provider-secrets",
    });
    return planResponse("missing-secret", "AI provider secrets are not configured. Showing a safe fallback plan.", fallbackPlan);
  }

  if (groqApiKey) {
    try {
      const plan = await generateGroqPlan(groqApiKey, prompt);
      return planResponse("groq", "Groq generated this read-only event plan.", plan);
    } catch (error) {
      const diagnostic = normalizeDiagnosticError(error);
      logDiagnostic("provider-fallback", {
        from: "groq",
        reason: diagnostic.message,
        stage: diagnostic.stage,
        to: geminiApiKey ? "gemini" : "fallback",
      });
    }
  }

  if (geminiApiKey) {
    try {
      const plan = await generateGeminiPlan(geminiApiKey, prompt);
      return planResponse("gemini-backup", "Gemini backup generated this read-only event plan.", plan);
    } catch (error) {
      const diagnostic = normalizeDiagnosticError(error);
      logDiagnostic("provider-fallback", {
        from: "gemini",
        reason: diagnostic.message,
        stage: diagnostic.stage,
        to: "fallback",
      });
    }
  }

  logDiagnostic("fallback-trigger", {
    reason: "All configured AI providers failed.",
    stage: "all-providers-failed",
  });
  return planResponse("fallback", "AI providers could not return a valid plan. Showing a safe fallback plan.", fallbackPlan);
});

async function generateGroqPlan(groqApiKey: string, prompt: string) {
  const model = "openai/gpt-oss-20b";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    body: JSON.stringify({
      messages: [
        {
          content: "You are a world-class event planning strategist for Indian live events. Return practical, commercially realistic plans. Return only valid JSON.",
          role: "system",
        },
        {
          content: buildUserPrompt(prompt),
          role: "user",
        },
      ],
      model,
      response_format: {
        json_schema: {
          name: "eventos_event_plan",
          schema: eventPlanJsonSchema,
          strict: false,
        },
        type: "json_schema",
      },
      temperature: 0.35,
    }),
    headers: {
      authorization: `Bearer ${groqApiKey}`,
      "content-type": "application/json",
    },
    method: "POST",
  });

  const responseBody = await response.text();
  logDiagnostic("groq-http-response", {
    bodyPreview: preview(responseBody),
    status: response.status,
  });

  if (!response.ok) {
    throw new DiagnosticError("groq-http", `Groq request failed with HTTP ${response.status}.`);
  }

  let payload: GroqPayload;
  try {
    payload = JSON.parse(responseBody) as GroqPayload;
  } catch (error) {
    throw new DiagnosticError("groq-response-json-parse", getErrorMessage(error));
  }

  const text = payload.choices?.[0]?.message?.content?.trim();
  logDiagnostic("groq-extracted-text", {
    textPreview: preview(text ?? ""),
  });

  if (!text) throw new DiagnosticError("groq-empty-text", "Groq response was empty.");

  return parseAndValidatePlan(text, "groq");
}

async function generateGeminiPlan(geminiApiKey: string, prompt: string) {
  const model = "gemini-3.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: buildUserPrompt(prompt) }],
      }],
      generationConfig: {
        responseJsonSchema: eventPlanJsonSchema,
        responseMimeType: "application/json",
        temperature: 0.35,
      },
      systemInstruction: {
        parts: [{
          text: "You are a world-class event planning strategist for Indian live events. Return practical, commercially realistic plans. Never include markdown.",
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
  logDiagnostic("gemini-http-response", {
    bodyPreview: preview(responseBody),
    status: response.status,
  });

  if (!response.ok) {
    throw new DiagnosticError("gemini-http", `Gemini request failed with HTTP ${response.status}.`);
  }

  let payload: GeminiPayload;
  try {
    payload = JSON.parse(responseBody) as GeminiPayload;
  } catch (error) {
    throw new DiagnosticError("gemini-response-json-parse", getErrorMessage(error));
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  logDiagnostic("gemini-extracted-text", {
    textPreview: preview(text ?? ""),
  });

  if (!text) throw new DiagnosticError("gemini-empty-text", "Gemini response was empty.");

  return parseAndValidatePlan(text, "gemini");
}

function buildUserPrompt(prompt: string) {
  return [
    "Create an EventOS event plan from this user brief:",
    prompt,
    "",
    "Return ONLY valid JSON. Do not include markdown, code fences, comments, or explanation.",
    "Return exactly this shape:",
    "{",
    '  "eventName": "string",',
    '  "venue": "string",',
    '  "capacity": 1200,',
    '  "ticketCategories": [{"name":"string","price":4500,"inventory":200}],',
    '  "revenueForecast": 4050000,',
    '  "suggestedSponsors": ["string"],',
    '  "suggestedTasks": ["string"],',
    '  "risks": ["string"]',
    "}",
    "",
    "Rules:",
    "- Use INR pricing as plain numbers.",
    "- Do not use rupee symbols, commas, or formatted currency strings in numeric fields.",
    "- Keep capacity, inventory, and revenue realistic for Indian live events.",
    "- Include 3 to 5 ticket categories.",
    "- Include 4 to 6 sponsor categories.",
    "- Include 4 to 8 task checklist items.",
    "- Include 3 to 5 practical risks.",
  ].join("\n");
}

function validateEventPlan(value: unknown): EventPlan {
  if (!value || typeof value !== "object") throw new DiagnosticError("plan-validation", "Plan is not an object.");
  const candidate = value as PlanCandidate;
  const ticketCategories = Array.isArray(candidate.ticketCategories)
    ? candidate.ticketCategories.map(validateTicketCategory).filter(Boolean)
    : [];
  const plan: EventPlan = {
    capacity: toPositiveInteger(candidate.capacity, "capacity"),
    eventName: toNonEmptyString(candidate.eventName, "eventName"),
    revenueForecast: toPositiveNumber(candidate.revenueForecast ?? candidate.revenue, "revenueForecast"),
    risks: toStringList(candidate.risks, "risks"),
    suggestedSponsors: toStringList(candidate.suggestedSponsors ?? candidate.sponsors, "suggestedSponsors"),
    suggestedTasks: toStringList(candidate.suggestedTasks ?? candidate.tasks, "suggestedTasks"),
    ticketCategories,
    venue: toNonEmptyString(candidate.venue ?? candidate.venueRecommendation, "venue"),
  };

  if (plan.ticketCategories.length === 0) throw new DiagnosticError("plan-validation", "Ticket categories are missing.");
  return plan;
}

function parseAndValidatePlan(text: string, provider: "gemini" | "groq") {
  let parsed: unknown;
  try {
    parsed = extractFirstJsonObject(text);
  } catch (error) {
    logDiagnostic("json-parse-error", {
      message: getErrorMessage(error),
      provider,
      textPreview: preview(text),
    });
    throw new DiagnosticError(`${provider}-plan-json-parse`, getErrorMessage(error));
  }

  try {
    return validateEventPlan(parsed);
  } catch (error) {
    logDiagnostic("validation-failure", {
      provider,
      reason: getErrorMessage(error),
    });
    throw new DiagnosticError(`${provider}-plan-validation`, getErrorMessage(error));
  }
}

function validateTicketCategory(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const candidate = value as TicketCategoryCandidate;
  return {
    inventory: toPositiveInteger(candidate.inventory, "ticket inventory"),
    name: toNonEmptyString(candidate.name, "ticket name"),
    price: toPositiveNumber(candidate.price, "ticket price"),
  };
}

function toNonEmptyString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new DiagnosticError("plan-validation", `${field} is invalid.`);
  return value.trim();
}

function toPositiveInteger(value: unknown, field: string) {
  const numberValue = normalizeNumber(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) throw new DiagnosticError("plan-validation", `${field} is invalid.`);
  return Math.round(numberValue);
}

function toPositiveNumber(value: unknown, field: string) {
  const numberValue = normalizeNumber(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) throw new DiagnosticError("plan-validation", `${field} is invalid.`);
  return Math.round(numberValue);
}

function toStringList(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new DiagnosticError("plan-validation", `${field} is invalid.`);
  const list = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
  if (list.length === 0) throw new DiagnosticError("plan-validation", `${field} is empty.`);
  return list;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number(value);

  const normalized = value
    .replace(/inr/gi, "")
    .replace(/rs\.?/gi, "")
    .replace(/[₹,\s]/g, "")
    .trim();

  return Number(normalized);
}

function extractFirstJsonObject(value: string) {
  const trimmed = stripJsonFence(value);

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Continue to object scanning below.
  }

  for (const jsonText of findJsonObjects(trimmed)) {
    try {
      return JSON.parse(jsonText) as unknown;
    } catch {
      // Keep scanning for the first valid JSON object.
    }
  }

  throw new DiagnosticError("plan-json-parse", "No valid JSON object found in Gemini response.");
}

function findJsonObjects(value: string) {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(value.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function stripJsonFence(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function normalizeDiagnosticError(error: unknown) {
  if (error instanceof DiagnosticError) return error;
  return new DiagnosticError("unknown", getErrorMessage(error));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function logDiagnostic(stage: string, details: Record<string, unknown>) {
  console.warn("[ai-center]", {
    ...details,
    stage,
  });
}

function preview(value: string) {
  return value.slice(0, 1000);
}

function planResponse(mode: BackendMode, message: string, plan: EventPlan) {
  return jsonResponse({
    ok: true,
    mode,
    message,
    plan,
    warning: mode === "groq" || mode === "gemini-backup" ? "" : message,
  });
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });
}

const eventPlanJsonSchema = {
  properties: {
    capacity: { type: "integer" },
    eventName: { type: "string" },
    revenueForecast: { type: "number" },
    risks: {
      items: { type: "string" },
      type: "array",
    },
    suggestedSponsors: {
      items: { type: "string" },
      type: "array",
    },
    suggestedTasks: {
      items: { type: "string" },
      type: "array",
    },
    ticketCategories: {
      items: {
        properties: {
          inventory: { type: "integer" },
          name: { type: "string" },
          price: { type: "number" },
        },
        required: ["name", "price", "inventory"],
        type: "object",
      },
      type: "array",
    },
    venue: { type: "string" },
  },
  required: [
    "eventName",
    "venue",
    "capacity",
    "ticketCategories",
    "revenueForecast",
    "suggestedSponsors",
    "suggestedTasks",
    "risks",
  ],
  type: "object",
};

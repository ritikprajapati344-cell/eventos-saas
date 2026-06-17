const corsHeaders = {
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*",
  "content-type": "application/json; charset=utf-8",
};

type BackendMode = "gemini" | "gemini-fallback" | "missing-secret";

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
  if (!geminiApiKey) {
    return planResponse("missing-secret", "Gemini secret is not configured. Showing a safe fallback plan.", fallbackPlan);
  }

  try {
    const plan = await generateGeminiPlan(geminiApiKey, prompt);
    return planResponse("gemini", "Gemini generated this read-only event plan.", plan);
  } catch {
    return planResponse("gemini-fallback", "Gemini could not return a valid plan. Showing a safe fallback plan.", fallbackPlan);
  }
});

async function generateGeminiPlan(geminiApiKey: string, prompt: string) {
  const model = "gemini-3.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: buildUserPrompt(prompt) }],
      }],
      generationConfig: {
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

  if (!response.ok) {
    throw new Error("Gemini request failed.");
  }

  const payload = await response.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("Gemini response was empty.");

  const parsed = JSON.parse(stripJsonFence(text)) as unknown;
  return validateEventPlan(parsed);
}

function buildUserPrompt(prompt: string) {
  return [
    "Create an EventOS event plan from this user brief:",
    prompt,
    "",
    "Return JSON only with exactly this shape:",
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
    "- Keep capacity, inventory, and revenue realistic for Indian live events.",
    "- Include 3 to 5 ticket categories.",
    "- Include 4 to 6 sponsor categories.",
    "- Include 4 to 8 task checklist items.",
    "- Include 3 to 5 practical risks.",
  ].join("\n");
}

function validateEventPlan(value: unknown): EventPlan {
  if (!value || typeof value !== "object") throw new Error("Plan is not an object.");
  const candidate = value as Partial<EventPlan>;
  const ticketCategories = Array.isArray(candidate.ticketCategories)
    ? candidate.ticketCategories.map(validateTicketCategory).filter(Boolean)
    : [];
  const plan: EventPlan = {
    capacity: toPositiveInteger(candidate.capacity, "capacity"),
    eventName: toNonEmptyString(candidate.eventName, "eventName"),
    revenueForecast: toPositiveNumber(candidate.revenueForecast, "revenueForecast"),
    risks: toStringList(candidate.risks, "risks"),
    suggestedSponsors: toStringList(candidate.suggestedSponsors, "suggestedSponsors"),
    suggestedTasks: toStringList(candidate.suggestedTasks, "suggestedTasks"),
    ticketCategories,
    venue: toNonEmptyString(candidate.venue, "venue"),
  };

  if (plan.ticketCategories.length === 0) throw new Error("Ticket categories are missing.");
  return plan;
}

function validateTicketCategory(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { inventory?: unknown; name?: unknown; price?: unknown };
  return {
    inventory: toPositiveInteger(candidate.inventory, "ticket inventory"),
    name: toNonEmptyString(candidate.name, "ticket name"),
    price: toPositiveNumber(candidate.price, "ticket price"),
  };
}

function toNonEmptyString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is invalid.`);
  return value.trim();
}

function toPositiveInteger(value: unknown, field: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) throw new Error(`${field} is invalid.`);
  return Math.round(numberValue);
}

function toPositiveNumber(value: unknown, field: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) throw new Error(`${field} is invalid.`);
  return Math.round(numberValue);
}

function toStringList(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new Error(`${field} is invalid.`);
  const list = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
  if (list.length === 0) throw new Error(`${field} is empty.`);
  return list;
}

function stripJsonFence(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function planResponse(mode: BackendMode, message: string, plan: EventPlan) {
  return jsonResponse({
    ok: true,
    mode,
    message,
    plan,
    warning: mode === "gemini" ? "" : message,
  });
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });
}

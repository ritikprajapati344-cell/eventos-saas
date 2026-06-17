const corsHeaders = {
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*",
  "content-type": "application/json; charset=utf-8",
};

const mockPlan = {
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

  return jsonResponse({
    ok: true,
    mode: "mock-backend",
    message: "AI Center backend is reachable",
    plan: mockPlan,
  });
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders,
    status,
  });
}

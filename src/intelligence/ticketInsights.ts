type TicketInsightTone = "danger" | "primary" | "success" | "warning";

type TicketInsightInput = {
  inventory: number;
  name: string;
  price: number;
  sold: number;
};

type PricingSuggestionAction = "Decrease" | "Increase" | "Maintain";

function getCopilotTone(tone: TicketInsightTone) {
  return tone;
}

export function getTicketPricingAdvisor(tickets: TicketInsightInput[]) {
  const ticketSummaries = tickets
    .filter((ticket) => ticket.inventory > 0)
    .map((ticket) => ({
      ...ticket,
      remaining: Math.max(ticket.inventory - ticket.sold, 0),
      sellThrough: ticket.sold / ticket.inventory,
    }));

  if (ticketSummaries.length === 0) {
    return {
      strongCategory: "Not configured",
      suggestedAction: "Create ticket categories before adjusting pricing or promotion strategy.",
      tone: getCopilotTone("danger"),
      weakCategory: "Not configured",
    };
  }

  const sortedByDemand = [...ticketSummaries].sort((a, b) => b.sellThrough - a.sellThrough);
  const strongest = sortedByDemand[0];
  const weakest = [...ticketSummaries].sort((a, b) => a.sellThrough - b.sellThrough)[0];
  const strongCategory = `${strongest.name} (${Math.round(strongest.sellThrough * 100)}% sold)`;
  const weakCategory = weakest.sellThrough < 0.35 ? `${weakest.name} (${Math.round(weakest.sellThrough * 100)}% sold)` : "None";
  const suggestedAction = strongest.sellThrough >= 0.8 && strongest.remaining > 0
    ? `${strongest.name} is moving strongly. Consider a higher next-batch price or premium bundle for future releases.`
    : weakest.sellThrough < 0.25
      ? `${weakest.name} is underperforming. Market this category more clearly before reducing price.`
      : weakest.sellThrough < 0.45
        ? `${weakest.name} needs attention. Test targeted offers or better placement in campaigns.`
        : "Ticket categories are balanced. Keep pricing stable and monitor sell-through by category.";

  return {
    strongCategory,
    suggestedAction,
    tone: getCopilotTone(strongest.sellThrough >= 0.65 ? "success" : weakest.sellThrough < 0.25 ? "warning" : "primary"),
    weakCategory,
  };
}

export function getTicketPricingEngine(tickets: TicketInsightInput[]) {
  const ticketSummaries = tickets
    .filter((ticket) => ticket.inventory > 0)
    .map((ticket) => ({
      ...ticket,
      currentRevenue: ticket.sold * ticket.price,
      potentialRevenue: ticket.inventory * ticket.price,
      remaining: Math.max(ticket.inventory - ticket.sold, 0),
      sellThrough: ticket.sold / ticket.inventory,
    }));
  const totalInventory = ticketSummaries.reduce((sum, ticket) => sum + ticket.inventory, 0);
  const totalSold = ticketSummaries.reduce((sum, ticket) => sum + ticket.sold, 0);
  const sellThrough = totalInventory > 0 ? totalSold / totalInventory : 0;
  const sellThroughPercent = Math.round(sellThrough * 100);
  const currentRevenue = ticketSummaries.reduce((sum, ticket) => sum + ticket.currentRevenue, 0);
  const basePotentialRevenue = ticketSummaries.reduce((sum, ticket) => sum + ticket.potentialRevenue, 0);
  const optimizationLift = ticketSummaries.reduce((sum, ticket) => {
    if (ticket.sellThrough >= 0.8 && ticket.remaining > 0) return sum + Math.round(ticket.remaining * ticket.price * 0.12);
    if (ticket.sellThrough <= 0.2 && ticket.remaining > 0) return sum - Math.round(ticket.remaining * ticket.price * 0.05);
    return sum;
  }, 0);
  const potentialRevenue = Math.max(currentRevenue, basePotentialRevenue + optimizationLift);
  const revenueOpportunity = Math.max(potentialRevenue - currentRevenue, 0);
  const demandLevel = totalInventory === 0
    ? "No inventory"
    : sellThrough >= 0.75
      ? "High"
      : sellThrough >= 0.35
        ? "Medium"
        : "Low";
  const demandTone = getCopilotTone(demandLevel === "High" ? "success" : demandLevel === "Medium" ? "warning" : "danger");

  if (ticketSummaries.length === 0) {
    return {
      currentRevenue: 0,
      demandLevel,
      demandTone,
      potentialRevenue: 0,
      pricingRecommendation: "Configure ticket categories before using pricing recommendations.",
      primarySuggestion: "Maintain" as PricingSuggestionAction,
      revenueOpportunity: 0,
      sellThroughPercent,
      strongestCategory: "Not configured",
      suggestions: [{
        action: "Maintain" as const,
        category: "Ticket setup",
        reason: "No ticket categories are configured yet, so pricing should stay unchanged.",
      }],
      weakestCategory: "Not configured",
    };
  }

  const strongest = [...ticketSummaries].sort((left, right) => right.sellThrough - left.sellThrough)[0];
  const weakest = [...ticketSummaries].sort((left, right) => left.sellThrough - right.sellThrough)[0];
  const suggestions = ticketSummaries.map((ticket) => {
    if (ticket.sellThrough >= 0.8 && ticket.remaining > 0) {
      return {
        action: "Increase" as const,
        category: ticket.name,
        reason: `${ticket.name} is ${Math.round(ticket.sellThrough * 100)}% sold with inventory left, so a premium next-batch price can be tested.`,
      };
    }
    if (ticket.sellThrough <= 0.2 && ticket.remaining > 0) {
      return {
        action: "Decrease" as const,
        category: ticket.name,
        reason: `${ticket.name} has low sell-through. Use discounting only after improving visibility and campaign placement.`,
      };
    }
    return {
      action: "Maintain" as const,
      category: ticket.name,
      reason: `${ticket.name} is moving in a stable range. Keep price steady and monitor daily sell-through.`,
    };
  });
  const primarySuggestion = suggestions.find((suggestion) => suggestion.action === "Increase")?.action
    ?? suggestions.find((suggestion) => suggestion.action === "Decrease")?.action
    ?? "Maintain";
  const pricingRecommendation = primarySuggestion === "Increase"
    ? "Demand is strong in at least one category. Consider increasing future batch pricing for high-performing categories only."
    : primarySuggestion === "Decrease"
      ? "Some categories are underperforming. Improve marketing first, then consider selective price relief."
      : "Ticket demand is balanced. Maintain current pricing and keep monitoring category movement.";

  return {
    currentRevenue,
    demandLevel,
    demandTone,
    potentialRevenue,
    pricingRecommendation,
    primarySuggestion,
    revenueOpportunity,
    sellThroughPercent,
    strongestCategory: `${strongest.name} (${Math.round(strongest.sellThrough * 100)}% sold)`,
    suggestions,
    weakestCategory: weakest.sellThrough < 0.35 ? `${weakest.name} (${Math.round(weakest.sellThrough * 100)}% sold)` : "None",
  };
}

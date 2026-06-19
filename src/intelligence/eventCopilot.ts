import { getEventHealthScore, getEventReadiness } from "./eventHealth";
import type { calculateEventWorkspace } from "./eventWorkspace";
import { getRevenueInsightMetrics } from "./revenueInsights";
import {
  getSponsorCategorySuggestions,
  getSponsorInsightMetrics,
  getSponsorLeadAdvisor,
} from "./sponsorInsights";
import {
  buildMissingChecklist,
  buildNextSevenDayActions,
  getLaunchRisk,
  getTaskRiskAdvisor,
  getTaskRiskMetrics,
} from "./taskRisk";
import {
  getTicketPricingAdvisor,
  getTicketPricingEngine,
} from "./ticketInsights";
import type { EventOSData } from "../types";
import { formatCurrency, formatNumber } from "../utils/finance";

type CopilotTone = "danger" | "primary" | "success" | "warning";
type EventWorkspace = NonNullable<ReturnType<typeof calculateEventWorkspace>>;

export function getCopilotInsights(
  event: EventOSData["events"][number],
  scoped: EventWorkspace,
) {
  const ticketInventory = scoped.tickets.reduce((sum, ticket) => sum + ticket.inventory, 0);
  const ticketSellThrough = ticketInventory > 0 ? scoped.totalTicketsSold / ticketInventory : 0;
  const unsoldTicketValue = scoped.tickets.reduce((sum, ticket) => sum + Math.max(ticket.inventory - ticket.sold, 0) * ticket.price, 0);
  const {
    dueSoonTasks,
    incompleteTasks,
    openHighPriorityTasks,
    overdueTasks,
    taskCompletion,
  } = getTaskRiskMetrics(scoped.tasks);
  const initialRevenueGap = Math.max(scoped.expectedRevenue - scoped.actualRevenue, 0);
  const {
    activeSponsorCount,
    closedSponsorAmount,
    expectedSponsorAmount,
    sponsorGap,
    sponsorOpportunityValue,
    sponsorScore,
    wonSponsorCount,
  } = getSponsorInsightMetrics({
    revenueGap: initialRevenueGap,
    sponsorRevenue: scoped.sponsorRevenue,
    sponsors: scoped.sponsors,
  });
  const revenueInsights = getRevenueInsightMetrics({
    actualRevenue: scoped.actualRevenue,
    expectedRevenue: scoped.expectedRevenue,
    sponsorOpportunityValue,
    unsoldTicketValue,
  });
  const { potentialRevenueGain, revenueGap, revenueProgress } = revenueInsights;
  const healthScore = getEventHealthScore({ revenueProgress, sponsorScore, taskCompletion, ticketSellThrough });
  const unsoldTickets = Math.max(ticketInventory - scoped.totalTicketsSold, 0);
  const ticketPricingAdvisor = getTicketPricingAdvisor(scoped.tickets);
  const ticketPricingEngine = getTicketPricingEngine(scoped.tickets);
  const sponsorCategories = getSponsorCategorySuggestions(event.eventType);
  const sponsorLeadAdvisor = getSponsorLeadAdvisor({
    activeSponsorCount,
    event,
    expectedSponsorAmount,
    revenueGap,
    scoped,
    sponsorCategories,
    sponsorOpportunityValue,
    ticketSellThrough,
    wonSponsorCount,
  });
  const taskRiskAdvisor = getTaskRiskAdvisor({ openHighPriorityTasks, overdueTasks, taskCompletion });
  const readiness = getEventReadiness({
    artistsCount: scoped.artists.length,
    healthScore,
    openHighPriorityTasks,
    overdueTasks,
    revenueProgress,
    sponsorScore,
    taskCompletion,
    ticketInventory,
    ticketSellThrough,
    timelineCount: scoped.timeline.length,
    vendorsCount: scoped.vendors.length,
  });
  const missingChecklist = buildMissingChecklist({
    activeSponsorCount,
    artistsCount: scoped.artists.length,
    openHighPriorityTasks,
    overdueTasks,
    revenueGap,
    scoped,
    ticketInventory,
    timelineCount: scoped.timeline.length,
    vendorsCount: scoped.vendors.length,
  });
  const launchRisk = getLaunchRisk({
    dueSoonTasks,
    missingChecklist,
    openHighPriorityTasks,
    overdueTasks,
    readinessScore: readiness.score,
    revenueGap,
    ticketInventory,
    ticketSellThrough,
  });
  const nextSevenDayActions = buildNextSevenDayActions({
    dueSoonTasks,
    missingChecklist,
    openHighPriorityTasks,
    overdueTasks,
    revenueGap,
    sponsorGap,
    taskCompletion,
    unsoldTickets,
  });
  const priorityActions = buildPriorityActions({
    activeSponsorCount,
    incompleteTasks,
    openHighPriorityTasks,
    revenueGap,
    scoped,
    sponsorGap,
    ticketPricingAction: ticketPricingAdvisor.suggestedAction,
    unsoldTickets,
  });
  const recommendations = buildCopilotRecommendations({
    activeSponsorCount,
    event,
    openHighPriorityTasks,
    revenueGap,
    revenueProgress,
    scoped,
    taskCompletion,
    ticketInventory,
    ticketSellThrough,
    unsoldTickets,
  });

  return {
    healthScore,
    launchRisk,
    missingChecklist,
    nextSevenDayActions,
    priorityActions,
    readiness,
    recommendations,
    revenue: revenueInsights.revenue,
    revenueAdvisor: revenueInsights.revenueAdvisor,
    sponsor: {
      helper: scoped.sponsors.length === 0
        ? "No sponsor pipeline attached to this event yet."
        : `${formatNumber(activeSponsorCount)} active deals, ${formatNumber(wonSponsorCount)} closed won.`,
      tone: getCopilotTone(wonSponsorCount > 0 ? "success" : activeSponsorCount > 0 ? "warning" : "danger"),
      value: `${formatCurrency(scoped.sponsorRevenue)} received`,
    },
    sponsorAdvisor: {
      closedAmount: closedSponsorAmount,
      opportunityValue: sponsorOpportunityValue,
      receivedAmount: scoped.sponsorRevenue,
      sponsorGap,
      suggestedCategories: sponsorCategories,
      tone: getCopilotTone(sponsorGap === 0 && scoped.sponsorRevenue > 0 ? "success" : activeSponsorCount > 0 ? "warning" : "danger"),
    },
    sponsorLeadAdvisor,
    task: {
      helper: scoped.tasks.length === 0
        ? "No event tasks are tracked yet."
        : `${formatNumber(openHighPriorityTasks)} high-priority tasks still open.`,
      tone: getCopilotTone(openHighPriorityTasks === 0 && taskCompletion >= 0.7 ? "success" : openHighPriorityTasks <= 2 ? "warning" : "danger"),
      value: `${Math.round(taskCompletion * 100)}% complete`,
    },
    taskRiskAdvisor,
    ticket: {
      helper: ticketInventory === 0
        ? "No ticket inventory has been configured."
        : `${formatNumber(unsoldTickets)} tickets remain available.`,
      tone: getCopilotTone(ticketInventory === 0 ? "danger" : ticketSellThrough >= 0.65 ? "success" : ticketSellThrough >= 0.25 ? "warning" : "danger"),
      value: `${Math.round(ticketSellThrough * 100)}% sold`,
    },
    ticketPricingAdvisor,
    ticketPricingEngine,
  };
}

export function buildPriorityActions({
  activeSponsorCount,
  incompleteTasks,
  openHighPriorityTasks,
  revenueGap,
  scoped,
  sponsorGap,
  ticketPricingAction,
  unsoldTickets,
}: {
  activeSponsorCount: number;
  incompleteTasks: number;
  openHighPriorityTasks: number;
  revenueGap: number;
  scoped: EventWorkspace;
  sponsorGap: number;
  ticketPricingAction: string;
  unsoldTickets: number;
}) {
  const actions: string[] = [];

  if (revenueGap > 0) {
    actions.push(`Close the ${formatCurrency(revenueGap)} revenue gap before expanding expense commitments.`);
  }
  if (unsoldTickets > 0) {
    actions.push(`Push ticket conversion for ${formatNumber(unsoldTickets)} unsold seats with category-specific campaigns.`);
  }
  if (sponsorGap > 0 || activeSponsorCount > 0) {
    actions.push("Move sponsor conversations toward proposal, agreement and payment milestones.");
  } else if (scoped.sponsors.length === 0) {
    actions.push("Build a sponsor target list for this event to reduce dependence on ticket revenue.");
  }
  if (openHighPriorityTasks > 0) {
    actions.push(`Resolve ${formatNumber(openHighPriorityTasks)} open high-priority task ${openHighPriorityTasks === 1 ? "risk" : "risks"}.`);
  } else if (incompleteTasks > 0) {
    actions.push(`Review ${formatNumber(incompleteTasks)} incomplete task ${incompleteTasks === 1 ? "item" : "items"} and confirm owners.`);
  }
  if (!actions.some((action) => action === ticketPricingAction)) {
    actions.push(ticketPricingAction);
  }

  if (actions.length === 0) {
    actions.push("Keep monitoring revenue, sponsor collection, ticket movement and task completion as the event date approaches.");
  }

  return actions.slice(0, 5);
}

export function buildCopilotRecommendations({
  activeSponsorCount,
  event,
  openHighPriorityTasks,
  revenueGap,
  revenueProgress,
  scoped,
  taskCompletion,
  ticketInventory,
  ticketSellThrough,
  unsoldTickets,
}: {
  activeSponsorCount: number;
  event: EventOSData["events"][number];
  openHighPriorityTasks: number;
  revenueGap: number;
  revenueProgress: number;
  scoped: EventWorkspace;
  taskCompletion: number;
  ticketInventory: number;
  ticketSellThrough: number;
  unsoldTickets: number;
}) {
  const recommendations: string[] = [];

  if (ticketInventory === 0) {
    recommendations.push("Set up ticket categories so EventOS can track sales health for this event.");
  } else if (ticketSellThrough < 0.25) {
    recommendations.push(`Ticket sales are early. Push campaign focus toward the ${formatNumber(unsoldTickets)} remaining seats.`);
  } else if (ticketSellThrough > 0.8) {
    recommendations.push("Ticket demand is strong. Consider premium upsells, add-ons, or capacity expansion if the venue allows it.");
  }

  if (revenueProgress < 0.5 && revenueGap > 0) {
    recommendations.push(`Prioritize revenue actions worth at least ${formatCurrency(revenueGap)} to close the expected revenue gap.`);
  } else {
    recommendations.push("Revenue is tracking well against the current event plan. Keep monitoring payment collection.");
  }

  if (scoped.sponsors.length === 0) {
    recommendations.push("Add sponsor leads for this event to improve non-ticket revenue visibility.");
  } else if (activeSponsorCount > 0 && scoped.sponsorRevenue === 0) {
    recommendations.push("Move active sponsor conversations toward proposal and payment milestones.");
  }

  if (scoped.tasks.length === 0) {
    recommendations.push("Create a task checklist for production, marketing, sponsor follow-up and show-day operations.");
  } else if (openHighPriorityTasks > 0) {
    recommendations.push(`Resolve ${formatNumber(openHighPriorityTasks)} high-priority task ${openHighPriorityTasks === 1 ? "blocker" : "blockers"} before the next planning review.`);
  } else if (taskCompletion < 0.6) {
    recommendations.push("Task completion is still building. Review owners and due dates with the event team.");
  }

  if (event.status === "Planning" && new Date(event.date).getTime() - Date.now() < 14 * 24 * 60 * 60 * 1000) {
    recommendations.push("The event date is close while status is still Planning. Confirm operations readiness and update status if needed.");
  }

  return recommendations.slice(0, 6);
}

function getCopilotTone(tone: CopilotTone) {
  return tone;
}

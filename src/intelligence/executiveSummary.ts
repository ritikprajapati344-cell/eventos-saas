import type { FinanceTransactionRecord } from "../lib/financeTransactionsRepository";
import type { EventOSData, TaskPriority } from "../types";
import {
  formatCurrency,
  formatNumber,
  getPipelineValue,
  getSponsorRevenue,
  getTicketInventory,
  getTicketRevenue,
  getTicketsSold,
} from "../utils/finance";

export function buildExecutiveInsights(data: EventOSData, financeTransactions: FinanceTransactionRecord[], scopeLabel: string) {
  const eventRiskItems = data.events
    .filter((event) => !event.archived)
    .map((event) => getExecutiveEventRisk(event, data, financeTransactions))
    .sort((left, right) => right.riskScore - left.riskScore);
  const topRiskEvents = eventRiskItems.filter((event) => event.riskScore >= 45).slice(0, 3);
  const expectedRevenue = data.events.filter((event) => !event.archived).reduce((sum, event) => sum + event.expectedRevenue, 0);
  const ticketRevenue = getTicketRevenue(data.events, data.ticketCategories);
  const sponsorRevenue = getSponsorRevenue(data.sponsors);
  const financeIncome = financeTransactions
    .filter((transaction) => transaction.type === "Income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const recordedRevenue = Math.max(ticketRevenue + sponsorRevenue, financeIncome);
  const revenueAtRisk = Math.max(expectedRevenue - recordedRevenue, 0);
  const sponsorPipeline = getExecutiveSponsorPipeline(data.sponsors);
  const criticalTasks = getExecutiveCriticalTasks(data.tasks);
  const taskCompletion = data.tasks.length > 0
    ? data.tasks.filter((task) => task.status === "Done").length / data.tasks.length
    : 0.5;
  const ticketInventory = getTicketInventory(data.events, data.ticketCategories);
  const ticketSold = getTicketsSold(data.events, data.ticketCategories);
  const ticketScore = ticketInventory > 0 ? Math.min(100, (ticketSold / ticketInventory) * 100) : (data.events.length > 0 ? 20 : 60);
  const revenueScore = expectedRevenue > 0 ? Math.min(100, (recordedRevenue / expectedRevenue) * 100) : (data.events.length > 0 ? 45 : 70);
  const taskScore = taskCompletion * 100;
  const sponsorScore = sponsorPipeline.healthScore;
  const riskPenalty = Math.min(35, topRiskEvents.length * 8 + criticalTasks.filter((task) => task.priority === "High").length * 3);
  const healthScore = clampDashboardScore(Math.round((revenueScore * 0.32) + (ticketScore * 0.22) + (taskScore * 0.24) + (sponsorScore * 0.22) - riskPenalty));
  const healthSummary = healthScore >= 75
    ? `Workspace health is strong for ${scopeLabel}.`
    : healthScore >= 50
      ? `Workspace health needs attention in ${scopeLabel}.`
      : `Workspace health is at risk in ${scopeLabel}.`;
  const summary = buildExecutiveSummary({
    criticalTasks,
    healthScore,
    revenueAtRisk,
    scopeLabel,
    sponsorPipeline,
    ticketInventory,
    ticketSold,
    topRiskEvents,
  });

  return {
    criticalTasks,
    healthScore,
    healthSummary,
    revenueAtRisk,
    sponsorPipeline,
    summary,
    topRiskEvents,
  };
}

export function getExecutiveEventRisk(event: EventOSData["events"][number], data: EventOSData, financeTransactions: FinanceTransactionRecord[]) {
  const tickets = data.ticketCategories.filter((ticket) => ticket.eventId === event.id);
  const sponsors = data.sponsors.filter((sponsor) => sponsor.eventId === event.id);
  const tasks = data.tasks.filter((task) => task.eventId === event.id);
  const ticketInventory = tickets.reduce((sum, ticket) => sum + ticket.inventory, 0);
  const ticketsSold = tickets.reduce((sum, ticket) => sum + ticket.sold, 0);
  const ticketSellThrough = ticketInventory > 0 ? ticketsSold / ticketInventory : 0;
  const ticketRevenue = tickets.reduce((sum, ticket) => sum + ticket.sold * ticket.price, 0);
  const sponsorRevenue = sponsors
    .filter((sponsor) => sponsor.status === "Closed Won" && sponsor.paymentReceived)
    .reduce((sum, sponsor) => sum + sponsor.sponsorshipAmount, 0);
  const financeIncome = financeTransactions
    .filter((transaction) => transaction.eventId === event.id && transaction.type === "Income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const recordedRevenue = Math.max(ticketRevenue + sponsorRevenue, financeIncome);
  const revenueGap = Math.max(event.expectedRevenue - recordedRevenue, 0);
  const overdueTasks = tasks.filter((task) => task.status !== "Done" && parseDashboardDate(task.dueDate).getTime() < startOfDashboardDay(new Date()).getTime()).length;
  const highPriorityPending = tasks.filter((task) => task.status !== "Done" && task.priority === "High").length;
  const daysToEvent = Math.ceil((parseDashboardDate(event.date).getTime() - startOfDashboardDay(new Date()).getTime()) / (24 * 60 * 60 * 1000));
  const reasons: string[] = [];
  let riskScore = 0;

  if (event.expectedRevenue > 0 && revenueGap > 0) {
    riskScore += Math.min(35, (revenueGap / event.expectedRevenue) * 35);
    reasons.push(`${formatCurrency(revenueGap)} revenue gap`);
  }
  if (ticketInventory === 0) {
    riskScore += 25;
    reasons.push("ticket setup missing");
  } else if (ticketSellThrough < 0.25) {
    riskScore += 18;
    reasons.push("low ticket sell-through");
  }
  if (overdueTasks > 0) {
    riskScore += Math.min(22, overdueTasks * 8);
    reasons.push(`${formatNumber(overdueTasks)} overdue tasks`);
  }
  if (highPriorityPending > 0) {
    riskScore += Math.min(20, highPriorityPending * 6);
    reasons.push(`${formatNumber(highPriorityPending)} high-priority pending`);
  }
  if (sponsors.length === 0) {
    riskScore += 10;
    reasons.push("no sponsor pipeline");
  }
  if (daysToEvent >= 0 && daysToEvent <= 14 && event.status === "Planning") {
    riskScore += 12;
    reasons.push("near event date while still planning");
  }

  return {
    id: event.id,
    name: event.name,
    reason: reasons.slice(0, 3).join(" • ") || "No major risk signals detected",
    riskScore: clampDashboardScore(Math.round(riskScore)),
  };
}

export function getExecutiveSponsorPipeline(sponsors: EventOSData["sponsors"]) {
  const activeDeals = sponsors.filter((sponsor) => !["Closed Won", "Closed Lost"].includes(sponsor.status)).length;
  const wonDeals = sponsors.filter((sponsor) => sponsor.status === "Closed Won").length;
  const lostDeals = sponsors.filter((sponsor) => sponsor.status === "Closed Lost").length;
  const totalResolved = wonDeals + lostDeals;
  const conversionRate = totalResolved > 0 ? Math.round((wonDeals / totalResolved) * 100) : 0;
  const pipelineValue = getPipelineValue(sponsors);
  const receivedValue = getSponsorRevenue(sponsors);
  const healthScore = sponsors.length === 0
    ? 35
    : clampDashboardScore(Math.round((conversionRate * 0.45) + (activeDeals > 0 ? 30 : 10) + (receivedValue > 0 ? 25 : pipelineValue > 0 ? 15 : 0)));

  return {
    activeDeals,
    conversionRate,
    healthScore,
    pipelineValue,
    receivedValue,
    tone: healthScore >= 70 ? "success" as const : healthScore >= 45 ? "warning" as const : "danger" as const,
    wonDeals,
  };
}

export function getExecutiveCriticalTasks(tasks: EventOSData["tasks"]) {
  const today = startOfDashboardDay(new Date());
  return [...tasks]
    .filter((task) => task.status !== "Done")
    .sort((left, right) => {
      const leftOverdue = parseDashboardDate(left.dueDate).getTime() < today.getTime() ? 0 : 1;
      const rightOverdue = parseDashboardDate(right.dueDate).getTime() < today.getTime() ? 0 : 1;
      if (leftOverdue !== rightOverdue) return leftOverdue - rightOverdue;
      if (left.priority !== right.priority) return priorityWeight(left.priority) - priorityWeight(right.priority);
      return left.dueDate.localeCompare(right.dueDate);
    })
    .slice(0, 5);
}

export function buildExecutiveSummary({
  criticalTasks,
  healthScore,
  revenueAtRisk,
  scopeLabel,
  sponsorPipeline,
  ticketInventory,
  ticketSold,
  topRiskEvents,
}: {
  criticalTasks: EventOSData["tasks"];
  healthScore: number;
  revenueAtRisk: number;
  scopeLabel: string;
  sponsorPipeline: ReturnType<typeof getExecutiveSponsorPipeline>;
  ticketInventory: number;
  ticketSold: number;
  topRiskEvents: Array<{ id: string; name: string; reason: string; riskScore: number }>;
}) {
  const summary: string[] = [];

  summary.push(healthScore >= 75
    ? `${scopeLabel} is operating in a healthy range.`
    : healthScore >= 50
      ? `${scopeLabel} is stable but needs focused follow-up.`
      : `${scopeLabel} needs executive attention before the next review.`);
  if (revenueAtRisk > 0) summary.push(`${formatCurrency(revenueAtRisk)} revenue is currently at risk against expected event targets.`);
  if (ticketInventory > 0) summary.push(`${formatNumber(ticketSold)} of ${formatNumber(ticketInventory)} tickets are sold across the selected scope.`);
  if (sponsorPipeline.activeDeals > 0) summary.push(`${formatNumber(sponsorPipeline.activeDeals)} sponsor deals are still active in the pipeline.`);
  if (criticalTasks.length > 0) summary.push(`${formatNumber(criticalTasks.length)} critical task ${criticalTasks.length === 1 ? "item needs" : "items need"} near-term attention.`);
  if (topRiskEvents.length > 0) summary.push(`${topRiskEvents[0].name} is the highest-risk event right now.`);

  return summary.slice(0, 6);
}

export function priorityWeight(priority: TaskPriority) {
  return priority === "High" ? 0 : priority === "Medium" ? 1 : 2;
}

export function clampDashboardScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function startOfDashboardDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function parseDashboardDate(value: string) {
  if (!value) return new Date(8640000000000000);
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(value);
  return startOfDashboardDay(new Date(year, month - 1, day));
}

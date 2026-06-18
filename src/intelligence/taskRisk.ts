import { formatCurrency, formatNumber } from "../utils/finance";

type TaskRiskTone = "danger" | "primary" | "success" | "warning";

type TaskRiskTask = {
  dueDate: string;
  priority: string;
  status: string;
};

type ChecklistWorkspace = {
  sponsorRevenue: number;
  sponsors: unknown[];
  tasks: unknown[];
};

function getCopilotTone(tone: TaskRiskTone) {
  return tone;
}

export function getTaskRiskMetrics(tasks: TaskRiskTask[]) {
  const completedTasks = tasks.filter((task) => task.status === "Done").length;
  const incompleteTasks = tasks.length - completedTasks;
  const taskCompletion = tasks.length > 0 ? completedTasks / tasks.length : 0.5;
  const today = startOfDay(new Date());
  const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const overdueTasks = tasks.filter((task) => task.status !== "Done" && parseLocalDate(task.dueDate).getTime() < today.getTime()).length;
  const dueSoonTasks = tasks.filter((task) => {
    const dueDate = parseLocalDate(task.dueDate);
    return task.status !== "Done" && dueDate.getTime() >= today.getTime() && dueDate.getTime() <= sevenDaysFromNow.getTime();
  }).length;
  const openHighPriorityTasks = tasks.filter((task) => task.status !== "Done" && task.priority === "High").length;

  return {
    completedTasks,
    dueSoonTasks,
    incompleteTasks,
    openHighPriorityTasks,
    overdueTasks,
    taskCompletion,
  };
}

export function getTaskRiskAdvisor({
  openHighPriorityTasks,
  overdueTasks,
  taskCompletion,
}: {
  openHighPriorityTasks: number;
  overdueTasks: number;
  taskCompletion: number;
}) {
  const completionPercent = Math.round(taskCompletion * 100);
  const riskLevel = overdueTasks > 2 || openHighPriorityTasks > 3
    ? "High"
    : overdueTasks > 0 || openHighPriorityTasks > 0 || completionPercent < 60
      ? "Medium"
      : "Low";

  return {
    completionPercent,
    highPriorityPending: openHighPriorityTasks,
    overdueTasks,
    riskLevel,
    tone: getCopilotTone(riskLevel === "Low" ? "success" : riskLevel === "Medium" ? "warning" : "danger"),
  };
}

export function buildMissingChecklist({
  activeSponsorCount,
  artistsCount,
  openHighPriorityTasks,
  overdueTasks,
  revenueGap,
  scoped,
  ticketInventory,
  timelineCount,
  vendorsCount,
}: {
  activeSponsorCount: number;
  artistsCount: number;
  openHighPriorityTasks: number;
  overdueTasks: number;
  revenueGap: number;
  scoped: ChecklistWorkspace;
  ticketInventory: number;
  timelineCount: number;
  vendorsCount: number;
}) {
  const checklist: string[] = [];

  if (ticketInventory === 0) checklist.push("Ticket categories and inventory are not configured.");
  if (scoped.sponsors.length === 0) checklist.push("Sponsor pipeline is not attached to this event.");
  if (activeSponsorCount > 0 && scoped.sponsorRevenue === 0) checklist.push("Sponsor collection is not recorded yet.");
  if (artistsCount === 0) checklist.push("Artist confirmation is not attached to this event.");
  if (vendorsCount === 0) checklist.push("Vendor assignments are not attached to this event.");
  if (timelineCount === 0) checklist.push("Event timeline milestones are not defined.");
  if (scoped.tasks.length === 0) checklist.push("Task checklist is not created.");
  if (overdueTasks > 0) checklist.push(`${formatNumber(overdueTasks)} overdue task ${overdueTasks === 1 ? "needs" : "need"} closure.`);
  if (openHighPriorityTasks > 0) checklist.push(`${formatNumber(openHighPriorityTasks)} high-priority task ${openHighPriorityTasks === 1 ? "is" : "are"} still pending.`);
  if (revenueGap > 0) checklist.push(`${formatCurrency(revenueGap)} revenue gap is still open.`);

  return checklist.length > 0 ? checklist.slice(0, 7) : ["No critical checklist gaps detected from current event data."];
}

export function getLaunchRisk({
  dueSoonTasks,
  missingChecklist,
  openHighPriorityTasks,
  overdueTasks,
  readinessScore,
  revenueGap,
  ticketInventory,
  ticketSellThrough,
}: {
  dueSoonTasks: number;
  missingChecklist: string[];
  openHighPriorityTasks: number;
  overdueTasks: number;
  readinessScore: number;
  revenueGap: number;
  ticketInventory: number;
  ticketSellThrough: number;
}) {
  const reasons: string[] = [];
  const hasRealMissingItems = missingChecklist.some((item) => !item.startsWith("No critical"));

  if (readinessScore < 50) reasons.push("Readiness score is below the safe launch threshold.");
  if (ticketInventory === 0) reasons.push("Ticket setup is missing.");
  if (ticketInventory > 0 && ticketSellThrough < 0.25) reasons.push("Ticket sell-through is still low.");
  if (revenueGap > 0) reasons.push(`${formatCurrency(revenueGap)} revenue gap remains open.`);
  if (overdueTasks > 0) reasons.push(`${formatNumber(overdueTasks)} task ${overdueTasks === 1 ? "is" : "are"} overdue.`);
  if (openHighPriorityTasks > 0) reasons.push(`${formatNumber(openHighPriorityTasks)} high-priority task ${openHighPriorityTasks === 1 ? "is" : "are"} pending.`);
  if (dueSoonTasks > 3) reasons.push(`${formatNumber(dueSoonTasks)} tasks are due in the next 7 days.`);
  if (hasRealMissingItems && missingChecklist.length > 4) reasons.push("Multiple setup checklist items are incomplete.");

  const level = readinessScore < 45 || overdueTasks > 2 || ticketInventory === 0
    ? "High"
    : readinessScore < 70 || overdueTasks > 0 || openHighPriorityTasks > 0 || dueSoonTasks > 3 || revenueGap > 0
      ? "Medium"
      : "Low";

  return {
    level,
    reasons: reasons.length > 0 ? reasons.slice(0, 5) : ["No major launch risks detected from current event data."],
    tone: getCopilotTone(level === "Low" ? "success" : level === "Medium" ? "warning" : "danger"),
  };
}

export function buildNextSevenDayActions({
  dueSoonTasks,
  missingChecklist,
  openHighPriorityTasks,
  overdueTasks,
  revenueGap,
  sponsorGap,
  taskCompletion,
  unsoldTickets,
}: {
  dueSoonTasks: number;
  missingChecklist: string[];
  openHighPriorityTasks: number;
  overdueTasks: number;
  revenueGap: number;
  sponsorGap: number;
  taskCompletion: number;
  unsoldTickets: number;
}) {
  const actions: string[] = [];

  if (overdueTasks > 0) actions.push(`Clear ${formatNumber(overdueTasks)} overdue task ${overdueTasks === 1 ? "item" : "items"} first.`);
  if (openHighPriorityTasks > 0) actions.push(`Assign owners for ${formatNumber(openHighPriorityTasks)} high-priority pending task ${openHighPriorityTasks === 1 ? "risk" : "risks"}.`);
  if (dueSoonTasks > 0) actions.push(`Review ${formatNumber(dueSoonTasks)} task ${dueSoonTasks === 1 ? "deadline" : "deadlines"} due in the next 7 days.`);
  if (revenueGap > 0) actions.push(`Run a 7-day revenue recovery push for the ${formatCurrency(revenueGap)} gap.`);
  if (unsoldTickets > 0) actions.push(`Launch a focused campaign for ${formatNumber(unsoldTickets)} unsold tickets.`);
  if (sponsorGap > 0) actions.push(`Follow up on sponsor payments worth ${formatCurrency(sponsorGap)}.`);
  if (taskCompletion < 0.7) actions.push("Hold a short production review to unblock incomplete task work.");

  missingChecklist
    .filter((item) => !item.startsWith("No critical"))
    .slice(0, 2)
    .forEach((item) => actions.push(`Close checklist gap: ${item}`));

  if (actions.length === 0) {
    actions.push("Maintain daily checks on ticket movement, collections and operations readiness.");
  }

  return actions.slice(0, 6);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function parseLocalDate(value: string) {
  if (!value) return new Date(8640000000000000);
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(value);
  return startOfDay(new Date(year, month - 1, day));
}

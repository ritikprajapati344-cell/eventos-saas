type EventHealthTone = "danger" | "primary" | "success" | "warning";

function getCopilotTone(tone: EventHealthTone) {
  return tone;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function getEventHealthScore({
  revenueProgress,
  sponsorScore,
  taskCompletion,
  ticketSellThrough,
}: {
  revenueProgress: number;
  sponsorScore: number;
  taskCompletion: number;
  ticketSellThrough: number;
}) {
  return clampScore(
    Math.round((revenueProgress * 35) + (ticketSellThrough * 25) + (taskCompletion * 20) + (sponsorScore * 20)),
  );
}

export function getEventReadiness({
  artistsCount,
  healthScore,
  openHighPriorityTasks,
  overdueTasks,
  revenueProgress,
  sponsorScore,
  taskCompletion,
  ticketInventory,
  ticketSellThrough,
  timelineCount,
  vendorsCount,
}: {
  artistsCount: number;
  healthScore: number;
  openHighPriorityTasks: number;
  overdueTasks: number;
  revenueProgress: number;
  sponsorScore: number;
  taskCompletion: number;
  ticketInventory: number;
  ticketSellThrough: number;
  timelineCount: number;
  vendorsCount: number;
}) {
  const ticketScore = ticketInventory > 0 ? Math.min(100, 35 + ticketSellThrough * 65) : 0;
  const revenueScore = Math.min(100, Math.max(0, revenueProgress * 100));
  const taskScore = Math.max(0, (taskCompletion * 100) - (overdueTasks * 15) - (openHighPriorityTasks * 8));
  const sponsorReadiness = Math.max(20, sponsorScore * 100);
  const productionScore = (
    (artistsCount > 0 ? 100 : 20)
    + (vendorsCount > 0 ? 100 : 20)
    + (timelineCount > 0 ? 100 : 30)
  ) / 3;
  const operationalScore = Math.round(
    (ticketScore * 0.22)
    + (revenueScore * 0.2)
    + (taskScore * 0.25)
    + (sponsorReadiness * 0.15)
    + (productionScore * 0.18),
  );
  const score = clampScore(Math.round((healthScore * 0.35) + (operationalScore * 0.65)));
  const summary = score >= 75
    ? "Launch readiness is strong. Keep closing final operational and collection follow-ups."
    : score >= 50
      ? "Readiness is building, but key revenue, task or production gaps still need attention."
      : "Readiness is at risk. Prioritize core setup, task closure and revenue recovery before launch.";

  return {
    score,
    summary,
    tone: getCopilotTone(score >= 75 ? "success" : score >= 50 ? "warning" : "danger"),
  };
}

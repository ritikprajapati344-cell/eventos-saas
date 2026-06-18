import { formatCurrency } from "../utils/finance";

type RevenueInsightTone = "danger" | "primary" | "success" | "warning";

function getCopilotTone(tone: RevenueInsightTone) {
  return tone;
}

export function getRevenueInsightMetrics({
  actualRevenue,
  expectedRevenue,
  sponsorOpportunityValue,
  unsoldTicketValue,
}: {
  actualRevenue: number;
  expectedRevenue: number;
  sponsorOpportunityValue: number;
  unsoldTicketValue: number;
}) {
  const revenueProgress = expectedRevenue > 0 ? actualRevenue / expectedRevenue : 0;
  const revenueGap = Math.max(expectedRevenue - actualRevenue, 0);
  const potentialRevenueGain = Math.min(revenueGap, unsoldTicketValue + sponsorOpportunityValue);

  return {
    potentialRevenueGain,
    revenue: {
      helper: revenueGap > 0
        ? `${formatCurrency(revenueGap)} gap against expected revenue.`
        : "Actual revenue has reached or exceeded expectation.",
      tone: getCopilotTone(revenueProgress >= 0.75 ? "success" : revenueProgress >= 0.35 ? "warning" : "danger"),
      value: `${Math.min(100, Math.round(revenueProgress * 100))}% recorded`,
    },
    revenueAdvisor: {
      expectedRevenue,
      potentialRevenueGain,
      recordedRevenue: actualRevenue,
      revenueGap,
      suggestedAction: getRevenueAdvisorAction({ potentialRevenueGain, revenueGap, sponsorOpportunityValue, unsoldTicketValue }),
      tone: getCopilotTone(revenueGap === 0 ? "success" : potentialRevenueGain > 0 ? "warning" : "danger"),
    },
    revenueGap,
    revenueProgress,
  };
}

export function getRevenueAdvisorAction({
  potentialRevenueGain,
  revenueGap,
  sponsorOpportunityValue,
  unsoldTicketValue,
}: {
  potentialRevenueGain: number;
  revenueGap: number;
  sponsorOpportunityValue: number;
  unsoldTicketValue: number;
}) {
  if (revenueGap <= 0) {
    return "Revenue target is covered. Keep collection follow-ups tight and monitor any pending expense pressure.";
  }
  if (unsoldTicketValue >= sponsorOpportunityValue) {
    return `Focus on converting unsold ticket inventory first. It can cover up to ${formatCurrency(Math.min(unsoldTicketValue, revenueGap))} of the current gap.`;
  }
  if (sponsorOpportunityValue > 0) {
    return `Sponsor follow-up can make the fastest dent in the gap, with an estimated opportunity of ${formatCurrency(Math.min(sponsorOpportunityValue, revenueGap))}.`;
  }
  return potentialRevenueGain > 0
    ? "Split effort between ticket conversion and sponsor collections to close the remaining gap."
    : "Add revenue sources or update expected revenue so the advisory model has enough signal.";
}

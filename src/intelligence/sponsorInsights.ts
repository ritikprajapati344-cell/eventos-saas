import type { EventOSData, SponsorStatus } from "../types";
import { formatCurrency } from "../utils/finance";

type SponsorInsightTone = "danger" | "primary" | "success" | "warning";

type SponsorInsightSponsor = {
  sponsorshipAmount: number;
  status: SponsorStatus;
};

type SponsorInsightEvent = {
  capacity: number;
  eventType: EventOSData["events"][number]["eventType"];
};

type SponsorInsightWorkspace = {
  expectedRevenue: number;
  sponsorRevenue: number;
  sponsors: SponsorInsightSponsor[];
};

function getCopilotTone(tone: SponsorInsightTone) {
  return tone;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function getSponsorInsightMetrics({
  revenueGap,
  sponsorRevenue,
  sponsors,
}: {
  revenueGap: number;
  sponsorRevenue: number;
  sponsors: SponsorInsightSponsor[];
}) {
  const activeSponsorCount = sponsors.filter((sponsor) => !["Closed Lost", "Closed Won"].includes(sponsor.status)).length;
  const wonSponsorCount = sponsors.filter((sponsor) => sponsor.status === "Closed Won").length;
  const closedSponsorAmount = sponsors.filter((sponsor) => sponsor.status === "Closed Won").reduce((sum, sponsor) => sum + sponsor.sponsorshipAmount, 0);
  const expectedSponsorAmount = sponsors.filter((sponsor) => sponsor.status !== "Closed Lost").reduce((sum, sponsor) => sum + sponsor.sponsorshipAmount, 0);
  const sponsorScore = sponsors.length > 0 ? wonSponsorCount / sponsors.length : 0.35;
  const sponsorGap = Math.max(expectedSponsorAmount - sponsorRevenue, 0);
  const sponsorOpportunityValue = sponsorGap > 0 ? sponsorGap : Math.round(revenueGap * 0.25);

  return {
    activeSponsorCount,
    closedSponsorAmount,
    expectedSponsorAmount,
    sponsorGap,
    sponsorOpportunityValue,
    sponsorScore,
    wonSponsorCount,
  };
}

export function getSponsorCategorySuggestions(eventType: EventOSData["events"][number]["eventType"]) {
  const suggestions: Record<EventOSData["events"][number]["eventType"], string[]> = {
    "College Fest": ["Education", "Food Brands", "Youth Fashion"],
    "Comedy Show": ["Food & Beverage", "Real Estate", "Local Retail"],
    "Concert": ["Beverage", "Telecom", "Fashion"],
    "Conference": ["SaaS", "Banking", "Hospitality"],
    "Corporate Event": ["Banking", "Hospitality", "Automobile"],
    Custom: ["Local Retail", "Jewellers", "Automobile"],
  };

  return suggestions[eventType] ?? suggestions.Custom;
}

export function getSponsorLeadAdvisor({
  activeSponsorCount,
  event,
  expectedSponsorAmount,
  revenueGap,
  scoped,
  sponsorCategories,
  sponsorOpportunityValue,
  ticketSellThrough,
  wonSponsorCount,
}: {
  activeSponsorCount: number;
  event: SponsorInsightEvent;
  expectedSponsorAmount: number;
  revenueGap: number;
  scoped: SponsorInsightWorkspace;
  sponsorCategories: string[];
  sponsorOpportunityValue: number;
  ticketSellThrough: number;
  wonSponsorCount: number;
}) {
  const sponsorTarget = Math.max(expectedSponsorAmount, Math.round(scoped.expectedRevenue * 0.25));
  const currentRevenue = scoped.sponsorRevenue;
  const sponsorGap = Math.max(sponsorTarget - currentRevenue, 0);
  const capacityScore = event.capacity > 0 ? Math.min(100, Math.round((event.capacity / 2000) * 100)) : 25;
  const pipelineScore = scoped.sponsors.length > 0
    ? Math.min(100, Math.round(((wonSponsorCount / scoped.sponsors.length) * 55) + (activeSponsorCount > 0 ? 25 : 0) + (currentRevenue > 0 ? 20 : 0)))
    : 20;
  const revenueNeedScore = revenueGap > 0 ? Math.min(100, Math.round((sponsorOpportunityValue / Math.max(revenueGap, 1)) * 100)) : 60;
  const demandScore = Math.round(ticketSellThrough * 100);
  const potentialScore = clampScore(Math.round((capacityScore * 0.25) + (pipelineScore * 0.3) + (revenueNeedScore * 0.25) + (demandScore * 0.2)));
  const riskLevel = sponsorGap === 0 && currentRevenue > 0
    ? "Low"
    : scoped.sponsors.length === 0 || sponsorGap > Math.max(sponsorTarget * 0.65, 1)
      ? "High"
      : activeSponsorCount > 0 || sponsorGap > 0
        ? "Medium"
        : "Low";
  const riskReason = getSponsorRiskReason({
    activeSponsorCount,
    currentRevenue,
    riskLevel,
    scoped,
    sponsorGap,
    sponsorTarget,
  });
  const priorityOutreach = sponsorCategories.slice(0, 4).map((category, index) => ({
    category,
    estimatedValue: Math.max(Math.round((sponsorGap || sponsorOpportunityValue || sponsorTarget * 0.25) / Math.max(2, index + 2)), 0),
    reason: getSponsorOutreachReason({ category, eventType: event.eventType, index, ticketSellThrough }),
  }));

  return {
    currentRevenue,
    potentialScore,
    priorityOutreach,
    riskLevel,
    riskReason,
    riskTone: getCopilotTone(riskLevel === "Low" ? "success" : riskLevel === "Medium" ? "warning" : "danger"),
    sponsorGap,
    sponsorTarget,
    suggestedCategories: sponsorCategories,
  };
}

export function getSponsorRiskReason({
  activeSponsorCount,
  currentRevenue,
  riskLevel,
  scoped,
  sponsorGap,
  sponsorTarget,
}: {
  activeSponsorCount: number;
  currentRevenue: number;
  riskLevel: string;
  scoped: SponsorInsightWorkspace;
  sponsorGap: number;
  sponsorTarget: number;
}) {
  if (riskLevel === "Low") {
    return "Sponsor revenue is tracking against the current target.";
  }
  if (scoped.sponsors.length === 0) {
    return `No sponsor leads are attached while the sponsor target is ${formatCurrency(sponsorTarget)}.`;
  }
  if (currentRevenue === 0 && activeSponsorCount > 0) {
    return "Sponsor conversations exist, but no sponsor revenue has been received yet.";
  }
  if (sponsorGap > 0) {
    return `${formatCurrency(sponsorGap)} sponsor gap remains against the current target.`;
  }
  return "Sponsor pipeline needs follow-up to reduce event revenue dependency.";
}

export function getSponsorOutreachReason({
  category,
  eventType,
  index,
  ticketSellThrough,
}: {
  category: string;
  eventType: EventOSData["events"][number]["eventType"];
  index: number;
  ticketSellThrough: number;
}) {
  if (ticketSellThrough >= 0.6) {
    return `${category} is a strong fit because ticket demand can support premium visibility.`;
  }
  if (index === 0) {
    return `${category} should be the first outreach lane for a ${eventType.toLowerCase()} audience.`;
  }
  return `${category} can help diversify sponsor revenue beyond ticket sales.`;
}

import type { FinanceTransactionRecord } from "../lib/financeTransactionsRepository";
import type { EventOSData } from "../types";

export interface DashboardForecastPoint {
  actual: number;
  forecast: number;
  month: string;
  period: string;
}

export interface DashboardProfitPoint {
  month: string;
  period: string;
  profit: number;
}

export interface DashboardRevenuePoint {
  month: string;
  period: string;
  revenue: number;
}

export interface DashboardTicketSalesPoint {
  capacity: number;
  event: string;
  fullName: string;
  revenue: number;
  sold: number;
}

export function buildCloudForecast(data: EventOSData): DashboardForecastPoint[] {
  const eventRevenue = new Map<string, number>();

  data.ticketCategories.forEach((ticket) => {
    eventRevenue.set(ticket.eventId, (eventRevenue.get(ticket.eventId) ?? 0) + ticket.sold * ticket.price);
  });

  data.sponsors.forEach((sponsor) => {
    if (sponsor.eventId && sponsor.status === "Closed Won") {
      eventRevenue.set(sponsor.eventId, (eventRevenue.get(sponsor.eventId) ?? 0) + sponsor.sponsorshipAmount);
    }
  });

  const monthly = new Map<string, { actual: number; forecast: number }>();
  data.events
    .filter((event) => event.status !== "Cancelled")
    .forEach((event) => {
      const period = getMonthPeriod(event.date);
      if (!period) return;

      const current = monthly.get(period) ?? { actual: 0, forecast: 0 };
      current.forecast += event.expectedRevenue;
      current.actual += eventRevenue.get(event.id) ?? 0;
      monthly.set(period, current);
    });

  return [...monthly.entries()]
    .filter(([, point]) => point.forecast !== 0 || point.actual !== 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, point]) => ({ ...point, month: formatMonthPeriod(period), period }));
}

export function buildCloudFinanceTrends(transactions: FinanceTransactionRecord[]) {
  const monthly = new Map<string, { expense: number; income: number }>();

  transactions.forEach((transaction) => {
    const period = getMonthPeriod(transaction.date);
    if (!period) return;

    const current = monthly.get(period) ?? { expense: 0, income: 0 };
    if (transaction.type === "Income") current.income += transaction.amount;
    if (transaction.type === "Expense") current.expense += transaction.amount;
    monthly.set(period, current);
  });

  const periods = [...monthly.keys()].sort();

  return {
    monthlyProfit: periods.map((period) => ({
      month: formatMonthPeriod(period),
      period,
      profit: monthly.get(period)!.income - monthly.get(period)!.expense,
    })),
    revenueTrend: periods
      .filter((period) => monthly.get(period)!.income > 0)
      .map((period) => ({
        month: formatMonthPeriod(period),
        period,
        revenue: monthly.get(period)!.income,
      })),
  };
}

export function buildCloudTicketSales(data: EventOSData, limit = 5): DashboardTicketSalesPoint[] {
  const eventMap = new Map(data.events.map((event) => [event.id, event]));
  const totals = new Map<string, { capacity: number; revenue: number; sold: number }>();

  data.ticketCategories.forEach((ticket) => {
    if (!eventMap.has(ticket.eventId)) return;

    const current = totals.get(ticket.eventId) ?? { capacity: 0, revenue: 0, sold: 0 };
    current.capacity += ticket.inventory;
    current.sold += ticket.sold;
    current.revenue += ticket.sold * ticket.price;
    totals.set(ticket.eventId, current);
  });

  return [...totals.entries()]
    .map(([eventId, total]) => {
      const event = eventMap.get(eventId)!;
      return {
        ...total,
        event: makeChartLabel(event.name),
        fullName: event.name,
      };
    })
    .sort((left, right) => right.sold - left.sold || right.revenue - left.revenue)
    .slice(0, limit);
}

function getMonthPeriod(value: string) {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return null;

  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}`;
}

function formatMonthPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    timeZone: "UTC",
    year: "2-digit",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function makeChartLabel(value: string) {
  const clean = value.trim();
  if (clean.length <= 12) return clean;
  return `${clean.slice(0, 10)}...`;
}

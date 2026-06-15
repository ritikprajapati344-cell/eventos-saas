import type { FinanceTransactionRecord } from "../lib/financeTransactionsRepository";
import type { EventOSData } from "../types";

export interface DashboardForecastPoint {
  month: string;
  period: string;
  projectedRevenue: number;
  recordedIncome: number;
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

export function buildCloudForecast(
  data: EventOSData,
  transactions: FinanceTransactionRecord[],
): DashboardForecastPoint[] {
  const monthly = new Map<string, { projectedRevenue: number; recordedIncome: number }>();

  data.events
    .filter((event) => event.status !== "Cancelled")
    .forEach((event) => {
      const period = getMonthPeriod(event.date);
      if (!period) return;

      const current = monthly.get(period) ?? { projectedRevenue: 0, recordedIncome: 0 };
      current.projectedRevenue += event.expectedRevenue;
      monthly.set(period, current);
    });

  transactions
    .filter((transaction) => transaction.type === "Income")
    .forEach((transaction) => {
      const period = getMonthPeriod(transaction.date);
      if (!period) return;

      const current = monthly.get(period) ?? { projectedRevenue: 0, recordedIncome: 0 };
      current.recordedIncome += transaction.amount;
      monthly.set(period, current);
    });

  return [...monthly.entries()]
    .filter(([, point]) => point.projectedRevenue !== 0 || point.recordedIncome !== 0)
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

  const periods = [...monthly.keys()]
    .filter((period) => {
      const point = monthly.get(period)!;
      return point.income !== 0 || point.expense !== 0;
    })
    .sort();

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
  const workspaceKey = "__workspace__";

  data.ticketCategories.forEach((ticket) => {
    const eventId = ticket.eventId || workspaceKey;
    if (eventId !== workspaceKey && !eventMap.has(eventId)) return;

    const current = totals.get(eventId) ?? { capacity: 0, revenue: 0, sold: 0 };
    current.capacity += ticket.inventory;
    current.sold += ticket.sold;
    current.revenue += ticket.sold * ticket.price;
    totals.set(eventId, current);
  });

  return [...totals.entries()]
    .map(([eventId, total]) => {
      const event = eventMap.get(eventId);
      const eventName = event?.name ?? "Workspace-wide";
      return {
        ...total,
        event: makeChartLabel(eventName),
        fullName: eventName,
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

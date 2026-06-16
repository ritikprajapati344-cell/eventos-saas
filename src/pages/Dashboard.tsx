import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BadgeIndianRupee,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Mic2,
  Plus,
  ReceiptIndianRupee,
  ShieldCheck,
  TicketX,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ChartCard } from "../components/ChartCard";
import { axisStyle, chartPalette, gridStyle } from "../components/charts/ChartTheme";
import { EventContextChip } from "../components/EventContextChip";
import { ALL_EVENTS_FILTER, EventFilter, matchesEventFilter, UNASSIGNED_EVENTS_FILTER } from "../components/EventFilter";
import { KpiCard } from "../components/KpiCard";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { monthlyProfit, revenueTrend } from "../data/demoData";
import type { FinanceTransactionRecord } from "../lib/financeTransactionsRepository";
import type {
  ContractStatus,
  EventOSData,
  ExpenseCategory,
  PaymentStatus,
  SponsorStatus,
  TaskPriority,
  VendorCategory,
} from "../types";
import {
  formatCurrency,
  formatNumber,
  getAvailableTickets,
  getNetProfit,
  getPipelineValue,
  getSponsorRevenue,
  getTicketInventory,
  getTicketRevenue,
  getTicketsSold,
  getTotalExpenses,
  getTotalRevenue,
} from "../utils/finance";
import {
  buildCloudFinanceTrends,
  buildCloudForecast,
  buildCloudTicketSales,
} from "../utils/dashboardAnalytics";

interface DashboardProps {
  data: EventOSData;
  financeError: string | null;
  financeTransactions: FinanceTransactionRecord[];
  isFinanceLoading: boolean;
  isSupabaseMode: boolean;
  setData: Dispatch<SetStateAction<EventOSData>>;
  workspaceName?: string;
}

type QuickAction = "event" | "sponsor" | "artist" | "vendor" | "expense";

const sponsorStages: SponsorStatus[] = ["Lead", "Contacted", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost"];

const quickActions: Array<{ id: QuickAction; label: string; icon: typeof CalendarDays }> = [
  { id: "event", label: "Create Event", icon: CalendarDays },
  { id: "sponsor", label: "Add Sponsor", icon: BriefcaseBusiness },
  { id: "artist", label: "Add Artist", icon: Mic2 },
  { id: "vendor", label: "Add Vendor", icon: ShieldCheck },
  { id: "expense", label: "Add Expense", icon: ReceiptIndianRupee },
];

const actionTitles: Record<QuickAction, string> = {
  event: "Create Event",
  sponsor: "Add Sponsor",
  artist: "Add Artist",
  vendor: "Add Vendor",
  expense: "Add Expense",
};

const priorityTone: Record<TaskPriority, "red" | "amber" | "green"> = {
  High: "red",
  Medium: "amber",
  Low: "green",
};

const taskStatusTone = {
  Open: "blue",
  "In Progress": "amber",
  Blocked: "red",
  Done: "green",
} as const;

const tooltipStyle = {
  background: "#0F172A",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  borderRadius: 8,
  color: "#E5EEF9",
};

const initialForms: Record<QuickAction, Record<string, string>> = {
  event: {
    name: "",
    date: "2026-12-20",
    venue: "",
    capacity: "",
    ticketPrice: "",
    owner: "Event Ops",
  },
  sponsor: {
    companyName: "",
    contactPerson: "",
    sponsorshipAmount: "",
    status: "Lead",
    notes: "",
    nextFollowUp: "2026-06-06",
  },
  artist: {
    name: "",
    fee: "",
    travelCost: "",
    hotelCost: "",
    contractStatus: "Draft",
    paymentStatus: "Pending",
    performanceSlot: "TBC",
  },
  vendor: {
    name: "",
    category: "Sound",
    amount: "",
    status: "Pending",
    dueDate: "2026-06-15",
    owner: "Ops",
  },
  expense: {
    category: "Marketing",
    description: "",
    amount: "",
    date: "2026-06-15",
  },
};

export default function Dashboard({
  data,
  financeError,
  financeTransactions,
  isFinanceLoading,
  isSupabaseMode,
  setData,
  workspaceName,
}: DashboardProps) {
  const [activeAction, setActiveAction] = useState<QuickAction | null>(null);
  const [eventFilter, setEventFilter] = useState(ALL_EVENTS_FILTER);
  const [forms, setForms] = useState(initialForms);
  const [error, setError] = useState("");

  const localFinanceTransactions = useMemo(readStoredFinanceTransactions, []);
  const activeFinanceTransactions = isSupabaseMode ? financeTransactions : localFinanceTransactions;
  const scopedData = useMemo(() => filterDashboardData(data, eventFilter), [data, eventFilter]);
  const scopedFinanceTransactions = useMemo(
    () => activeFinanceTransactions.filter((transaction) => matchesEventFilter(transaction.eventId, eventFilter)),
    [activeFinanceTransactions, eventFilter],
  );
  const scope = getDashboardScope(data, eventFilter);
  const isAllEventsScope = eventFilter === ALL_EVENTS_FILTER;
  const usesAttributedAnalytics = isSupabaseMode || !isAllEventsScope;

  const totalRevenue = getTotalRevenue(scopedData.events, scopedData.sponsors, scopedData.ticketCategories);
  const totalExpenses = getTotalExpenses(scopedData.expenses);
  const netProfit = getNetProfit(scopedData.events, scopedData.sponsors, scopedData.expenses, scopedData.ticketCategories);
  const ticketsSold = usesAttributedAnalytics
    ? scopedData.ticketCategories.reduce((total, ticket) => total + ticket.sold, 0)
    : getTicketsSold(scopedData.events, scopedData.ticketCategories);
  const ticketInventory = usesAttributedAnalytics
    ? scopedData.ticketCategories.reduce((total, ticket) => total + ticket.inventory, 0)
    : getTicketInventory(scopedData.events, scopedData.ticketCategories);
  const availableTickets = getAvailableTickets(scopedData.ticketCategories);
  const sponsorsClosed = scopedData.sponsors.filter((sponsor) => sponsor.status === "Closed Won").length;
  const activeEvents = scopedData.events.filter((event) => !event.archived && (event.status === "Planning" || event.status === "Upcoming" || event.status === "Ongoing")).length;

  const ticketSalesData = useMemo(() => {
    if (usesAttributedAnalytics) return buildCloudTicketSales(scopedData);
    return scopedData.events.slice(0, 5).map((event) => ({
      event: makeChartLabel(event.name),
      fullName: event.name,
      sold: event.ticketsSold,
      capacity: event.capacity,
      revenue: event.ticketsSold * event.ticketPrice,
    }));
  }, [scopedData, usesAttributedAnalytics]);

  const scopedForecast = useMemo(
    () => buildCloudForecast(scopedData, scopedFinanceTransactions),
    [scopedData, scopedFinanceTransactions],
  );
  const scopedFinanceTrends = useMemo(
    () => buildCloudFinanceTrends(scopedFinanceTransactions),
    [scopedFinanceTransactions],
  );
  const forecastData = usesAttributedAnalytics ? scopedForecast : data.revenueForecast;
  const revenueTrendData = usesAttributedAnalytics ? scopedFinanceTrends.revenueTrend : revenueTrend;
  const monthlyProfitData = usesAttributedAnalytics ? scopedFinanceTrends.monthlyProfit : monthlyProfit;
  const hasCloudProjectedRevenue = scopedForecast.some((point) => point.projectedRevenue > 0);
  const hasCloudRecordedIncome = scopedForecast.some((point) => point.recordedIncome > 0);
  const hasCloudTicketSales = ticketSalesData.some((point) => point.sold > 0);
  const cloudTicketInventory = ticketSalesData.reduce((total, point) => total + point.capacity, 0);

  const pipelineData = sponsorStages.map((stage) => ({
    stage,
    count: scopedData.sponsors.filter((sponsor) => sponsor.status === stage).length,
    value: scopedData.sponsors
      .filter((sponsor) => sponsor.status === stage)
      .reduce((total, sponsor) => total + sponsor.sponsorshipAmount, 0),
  }));
  const pipelineMaxCount = Math.max(...pipelineData.map((item) => item.count), 0);

  const calendar = useMemo(() => buildCalendar(scopedData), [scopedData]);

  const openAction = (action: QuickAction) => {
    if (isSupabaseMode) return;
    setError("");
    setActiveAction(action);
  };

  const closeAction = () => {
    setError("");
    setActiveAction(null);
  };

  const updateField = (field: string, value: string) => {
    if (!activeAction) return;
    setForms((current) => ({
      ...current,
      [activeAction]: {
        ...current[activeAction],
        [field]: value,
      },
    }));
  };

  const saveAction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeAction) return;

    const form = forms[activeAction];
    const validationError = validateForm(activeAction, form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setData((current) => applyQuickAction(current, activeAction, form));
    setForms((current) => ({ ...current, [activeAction]: initialForms[activeAction] }));
    closeAction();
  };

  const activities = useMemo(
    () =>
      [...scopedData.activities]
        .sort((a, b) => Number(b.time === "Just now") - Number(a.time === "Just now"))
        .slice(0, 5),
    [scopedData.activities],
  );
  const visibleTasks = useMemo(
    () => (
      isSupabaseMode
        ? [...scopedData.tasks]
            .filter((task) => task.status !== "Done")
            .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
            .slice(0, 4)
        : scopedData.tasks.slice(0, 4)
    ),
    [isSupabaseMode, scopedData.tasks],
  );

  return (
    <div className="space-y-5 overflow-hidden pb-2">
      <PageHeader
        title="Dashboard"
        description="Clean operating dashboard for events, sponsors, tickets, tasks and financial visibility."
        action={
          <div className="hidden rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 md:block">
            {workspaceName?.trim() || (isSupabaseMode ? "Cloud Workspace" : "Local Workspace")}
          </div>
        }
      />

      <EventFilter events={data.events} onChange={setEventFilter} value={eventFilter} />

      <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard title="Active Events" value={formatNumber(activeEvents)} helper={`${scopedData.events.filter((event) => !event.archived).length} visible in ${scope.shortLabel}`} icon={CalendarDays} />
        <KpiCard title="Total Revenue" value={formatCurrency(totalRevenue)} helper="Ticket + sponsor revenue" icon={BadgeIndianRupee} tone="success" />
        <KpiCard title="Total Expenses" value={formatCurrency(totalExpenses)} helper="Approved operating spend" icon={WalletCards} tone="warning" />
        <KpiCard title="Net Profit" value={formatCurrency(netProfit)} helper="Revenue minus expenses" icon={TrendingUp} tone="success" />
        <KpiCard title="Tickets Sold" value={`${formatNumber(ticketsSold)}/${formatNumber(ticketInventory)}`} helper={`${formatNumber(availableTickets)} available`} icon={CircleDollarSign} />
        <KpiCard title="Sponsors Won" value={formatNumber(sponsorsClosed)} helper={formatCurrency(getSponsorRevenue(scopedData.sponsors))} icon={BriefcaseBusiness} tone="danger" />
      </section>

      <section className="glass-panel min-w-0 rounded-lg p-3">
        {isSupabaseMode && (
          <p className="mb-3 rounded-lg border border-app-warning/30 bg-app-warning/10 px-3 py-2 text-sm text-amber-100">
            Quick actions are disabled in cloud mode. Use the module pages.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-slate-100 transition hover:border-app-primary/40 hover:bg-app-primary/12 focus:outline-none focus:ring-2 focus:ring-app-primary/50 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/[0.02] disabled:text-slate-500 disabled:hover:bg-white/[0.02]"
                disabled={isSupabaseMode}
                onClick={() => openAction(action.id)}
                type="button"
              >
                <Icon size={17} />
                {action.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <ChartCard
          title="Revenue Forecast"
          subtitle={usesAttributedAnalytics ? "Projected event revenue compared with dated Finance income" : "Actual revenue against forecasted commercial plan"}
        >
          {isFinanceLoading && isSupabaseMode ? (
            <ChartEmptyState icon={TrendingUp} message={`Loading projected revenue and recorded income for ${scope.shortLabel}...`} />
          ) : financeError && isSupabaseMode ? (
            <ChartEmptyState icon={TrendingUp} message="Recorded income could not be loaded. Try refreshing the workspace." />
          ) : forecastData.length === 0 ? (
            <ChartEmptyState
              icon={TrendingUp}
              message={`No projected revenue or recorded income for ${scope.shortLabel}.`}
            />
          ) : (
            <ChartBox height="h-[220px] sm:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={gridStyle} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={42} tickFormatter={(value) => `${Number(value) / 100000}L`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                  {usesAttributedAnalytics ? (
                    <>
                      <Legend />
                      {hasCloudProjectedRevenue && (
                        <Line name="Projected Revenue" type="monotone" dataKey="projectedRevenue" stroke={chartPalette.amber} strokeWidth={2.5} dot={{ r: 3 }} />
                      )}
                      {hasCloudRecordedIncome && (
                        <Line name="Recorded Income" type="monotone" dataKey="recordedIncome" stroke={chartPalette.green} strokeWidth={3} dot={{ r: 3 }} />
                      )}
                    </>
                  ) : (
                    <>
                      <Line type="monotone" dataKey="forecast" stroke={chartPalette.amber} strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="actual" stroke={chartPalette.green} strokeWidth={3} dot={{ r: 3 }} />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
          )}
        </ChartCard>

        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-1">
          <Widget title="Recent Activities">
            {activities.length === 0 ? (
              <WidgetEmptyState icon={Activity} message={`No recent activities for ${scope.shortLabel}.`} />
            ) : (
              <div className="space-y-2">
                {activities.map((activity) => {
                  const linkedEvent = data.events.find((event) => event.id === activity.eventId);
                  return (
                    <div key={activity.id} className="flex min-w-0 gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3">
                      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-app-primary" />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="break-words text-sm font-medium leading-5 text-white">{activity.message}</p>
                          {activity.time === "Just now" && <StatusBadge label="New" tone="green" />}
                        </div>
                        <p className="mt-1 text-xs text-app-muted">{activity.entity} - {activity.time}</p>
                        <EventContextChip className="mt-2" event={linkedEvent} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Widget>

          <Widget title="Upcoming Tasks">
            {visibleTasks.length === 0 ? (
              <WidgetEmptyState icon={ClipboardList} message={`No upcoming tasks for ${scope.shortLabel}.`} />
            ) : (
              <div className="space-y-2">
                {visibleTasks.map((task) => {
                const linkedEvent = data.events.find((event) => event.id === task.eventId);
                return (
                  <div key={task.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <div className="flex flex-col items-start justify-between gap-2 min-[430px]:flex-row min-[430px]:gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium leading-5 text-white">{task.title}</p>
                        <EventContextChip className="mt-2" event={linkedEvent} />
                      </div>
                      <div className="flex shrink-0 flex-row flex-wrap gap-1 min-[430px]:flex-col min-[430px]:items-end">
                        <StatusBadge label={task.priority} tone={priorityTone[task.priority]} />
                        <StatusBadge label={task.status} tone={taskStatusTone[task.status]} />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-app-muted">
                      {task.owner} - Due {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                );
                })}
              </div>
            )}
          </Widget>
        </div>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-3">
        <Widget title="Event Calendar Widget">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.14em] text-app-muted">{calendar.monthLabel}</p>
            <StatusBadge label={`${calendar.eventDays.size} event days`} tone="blue" />
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-app-muted">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <span key={day} className="py-1 text-[11px]">{day}</span>
            ))}
            {calendar.cells.map((cell, index) =>
              cell === null ? (
                <div key={`blank-${index}`} className="aspect-square rounded-lg border border-transparent" />
              ) : (
                <div
                  key={cell}
                  className={`relative grid aspect-square place-items-center rounded-lg border text-xs ${
                    calendar.eventDays.has(cell)
                      ? "border-app-primary/45 bg-app-primary/18 text-white"
                      : calendar.taskDays.has(cell)
                        ? "border-app-warning/35 bg-app-warning/12 text-amber-100"
                        : "border-white/5 bg-white/[0.025] text-slate-400"
                  }`}
                >
                  {cell}
                  {(calendar.eventDays.has(cell) || calendar.taskDays.has(cell)) && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-current" />
                  )}
                </div>
              ),
            )}
          </div>
          <div className="mt-3 space-y-2">
            {calendar.monthEvents.slice(0, 4).map((event) => (
              <div key={event.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-white/[0.035] px-3 py-2 text-sm">
                <span className="truncate text-slate-200">{event.name}</span>
                <span className="shrink-0 text-xs text-app-muted">{new Date(event.date).toLocaleDateString("en-IN", { month: "short", day: "2-digit" })}</span>
              </div>
            ))}
            {calendar.monthEvents.length === 0 && (
              <p className="rounded-lg bg-white/[0.035] px-3 py-2 text-sm text-app-muted">No events scheduled for {scope.shortLabel} this month.</p>
            )}
          </div>
        </Widget>

        <Widget title="Sponsor Pipeline Summary">
          {scopedData.sponsors.length === 0 && (isSupabaseMode || !isAllEventsScope) ? (
            <WidgetEmptyState icon={BriefcaseBusiness} message={`No sponsor opportunities for ${scope.shortLabel}.`} />
          ) : (
            <>
              <div className="space-y-2">
                {pipelineData.map((item, index) => (
                  <div key={item.stage} className="rounded-lg border border-white/10 bg-white/[0.035] p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-white">{item.stage}</span>
                      <span className="break-words text-right text-app-muted">{item.count} - {formatCurrency(item.value)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-app-primary transition-[width]"
                        style={{
                          width: isSupabaseMode
                            || !isAllEventsScope
                            ? `${pipelineMaxCount > 0 ? (item.count / pipelineMaxCount) * 100 : 0}%`
                            : `${Math.max(18, 100 - index * 12)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-app-muted">Open pipeline value: {formatCurrency(getPipelineValue(scopedData.sponsors))}</p>
            </>
          )}
        </Widget>

        <Widget title="Ticket Sales Summary">
          {ticketSalesData.length === 0 ? (
            <WidgetEmptyState icon={TicketX} message={`No ticket sales data for ${scope.shortLabel}.`} />
          ) : (isSupabaseMode || !isAllEventsScope) && !hasCloudTicketSales ? (
            <WidgetEmptyState
              icon={TicketX}
              message={`${formatNumber(cloudTicketInventory)} tickets are configured for ${scope.shortLabel}. No ticket sales have been recorded yet.`}
            />
          ) : (
            <ChartBox height="h-[220px] sm:h-[238px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ticketSalesData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={gridStyle} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="event" tick={axisStyle} axisLine={false} tickLine={false} interval={0} height={44} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={38} />
                  <Tooltip content={<TicketSalesTooltip />} />
                  {usesAttributedAnalytics && <Legend />}
                  <Bar name={usesAttributedAnalytics ? "Inventory" : undefined} dataKey="capacity" fill="#334155" radius={[6, 6, 0, 0]} />
                  <Bar name={usesAttributedAnalytics ? "Sold" : undefined} dataKey="sold" fill={chartPalette.green} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          )}
        </Widget>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ChartCard title="Revenue Trend" subtitle={usesAttributedAnalytics ? "Dated Finance income grouped by transaction month" : "Commercial momentum across planning months"}>
          {isFinanceLoading && isSupabaseMode ? (
            <ChartEmptyState icon={TrendingUp} message={`Loading recorded income for ${scope.shortLabel}...`} />
          ) : financeError && isSupabaseMode ? (
            <ChartEmptyState icon={TrendingUp} message="Finance activity could not be loaded. Try refreshing the workspace." />
          ) : revenueTrendData.length === 0 ? (
            <ChartEmptyState icon={TrendingUp} message={`No recorded Finance income for ${scope.shortLabel}.`} />
          ) : (
            <ChartBox height="h-[220px] sm:h-[248px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartPalette.blue} stopOpacity={0.42} />
                      <stop offset="95%" stopColor={chartPalette.blue} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridStyle} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={42} tickFormatter={(value) => `${Number(value) / 100000}L`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                  <Area type="monotone" dataKey="revenue" stroke={chartPalette.blue} strokeWidth={3} fill="url(#revenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartBox>
          )}
        </ChartCard>

        <ChartCard title={usesAttributedAnalytics ? "Recorded Monthly Profit" : "Monthly Profit"} subtitle={usesAttributedAnalytics ? "Dated Finance income minus Finance expense by transaction month" : "Profit trajectory after operating costs"}>
          {isFinanceLoading && isSupabaseMode ? (
            <ChartEmptyState icon={WalletCards} message={`Loading recorded transactions for ${scope.shortLabel}...`} />
          ) : financeError && isSupabaseMode ? (
            <ChartEmptyState icon={WalletCards} message="Finance activity could not be loaded. Try refreshing the workspace." />
          ) : monthlyProfitData.length === 0 ? (
            <ChartEmptyState icon={WalletCards} message={`No recorded Finance income or expense transactions for ${scope.shortLabel}.`} />
          ) : (
            <ChartBox height="h-[220px] sm:h-[248px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyProfitData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartPalette.green} stopOpacity={0.45} />
                      <stop offset="95%" stopColor={chartPalette.green} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridStyle} strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={42} tickFormatter={(value) => `${Number(value) / 100000}L`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                  <Area type="monotone" dataKey="profit" stroke={chartPalette.green} strokeWidth={3} fill="url(#profitFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartBox>
          )}
        </ChartCard>
      </section>

      {activeAction && (
        <QuickActionModal
          action={activeAction}
          error={error}
          form={forms[activeAction]}
          onCancel={closeAction}
          onChange={updateField}
          onSubmit={saveAction}
        />
      )}
    </div>
  );
}

function ChartBox({ height, children }: { height: string; children: ReactNode }) {
  return <div className={`${height} min-h-0 min-w-0 overflow-hidden`}>{children}</div>;
}

function ChartEmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="grid h-[180px] place-items-center rounded-lg border border-dashed border-white/10 bg-white/[0.025] px-5 text-center sm:h-[200px]">
      <div>
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
          <Icon className="text-slate-500" size={20} />
        </div>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-app-muted">{message}</p>
      </div>
    </div>
  );
}

function Widget({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass-panel min-w-0 overflow-hidden rounded-lg p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="break-words text-sm font-semibold text-white">{title}</h2>
        <Plus size={15} className="shrink-0 text-app-muted" />
      </div>
      {children}
    </section>
  );
}

function WidgetEmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-white/10 bg-white/[0.025] px-4 py-5 text-center">
      <div>
        <div className="mx-auto grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
          <Icon className="text-slate-500" size={18} />
        </div>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-app-muted">{message}</p>
      </div>
    </div>
  );
}

function TicketSalesTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { fullName: string; sold: number; capacity: number; revenue: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-white/10 bg-app-bg px-3 py-2 text-sm shadow-premium">
      <p className="font-medium text-white">{point.fullName}</p>
      <p className="mt-1 text-xs text-app-muted">Sold: {formatNumber(point.sold)}</p>
      <p className="text-xs text-app-muted">Inventory: {formatNumber(point.capacity)}</p>
      <p className="text-xs text-app-muted">Revenue: {formatCurrency(point.revenue)}</p>
    </div>
  );
}

function QuickActionModal({
  action,
  error,
  form,
  onCancel,
  onChange,
  onSubmit,
}: {
  action: QuickAction;
  error: string;
  form: Record<string, string>;
  onCancel: () => void;
  onChange: (field: string, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-slate-950/76 px-2 py-3 backdrop-blur-sm sm:place-items-center sm:px-4 sm:py-6">
      <form className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-white/10 bg-app-panel p-4 shadow-premium sm:max-h-[92vh] sm:p-5" onSubmit={onSubmit}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-app-primary">Dashboard Action</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{actionTitles[action]}</h2>
          </div>
          <button
            aria-label="Close modal"
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08]"
            onClick={onCancel}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">{renderFields(action, form, onChange)}</div>

        {error && <p className="mt-4 rounded-lg border border-app-danger/30 bg-app-danger/10 px-3 py-2 text-sm text-red-100">{error}</p>}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] sm:w-auto"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button className="h-10 w-full rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 sm:w-auto" type="submit">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function renderFields(action: QuickAction, form: Record<string, string>, onChange: (field: string, value: string) => void) {
  const input = (field: string, label: string, type = "text") => (
    <Field key={field} label={label}>
      <input
        className="dashboard-input"
        min={type === "number" ? 0 : undefined}
        onChange={(event) => onChange(field, event.target.value)}
        type={type}
        value={form[field] ?? ""}
      />
    </Field>
  );

  const select = (field: string, label: string, options: string[]) => (
    <Field key={field} label={label}>
      <select className="dashboard-input" onChange={(event) => onChange(field, event.target.value)} value={form[field] ?? ""}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </Field>
  );

  if (action === "event") {
    return [
      input("name", "Event Name"),
      input("venue", "Venue"),
      input("date", "Event Date", "date"),
      input("capacity", "Capacity", "number"),
      input("ticketPrice", "Ticket Price", "number"),
      input("owner", "Owner"),
    ];
  }

  if (action === "sponsor") {
    return [
      input("companyName", "Company Name"),
      input("contactPerson", "Contact Person"),
      input("sponsorshipAmount", "Sponsorship Amount", "number"),
      select("status", "Pipeline Status", sponsorStages),
      input("nextFollowUp", "Next Follow-up", "date"),
      input("notes", "Notes"),
    ];
  }

  if (action === "artist") {
    return [
      input("name", "Artist Name"),
      input("fee", "Performance Fee", "number"),
      input("travelCost", "Travel Cost", "number"),
      input("hotelCost", "Hotel Cost", "number"),
      select("contractStatus", "Contract Status", ["Draft", "Sent", "Signed", "On Hold"]),
      select("paymentStatus", "Payment Status", ["Pending", "Partial", "Paid"]),
      input("performanceSlot", "Performance Slot"),
    ];
  }

  if (action === "vendor") {
    return [
      input("name", "Vendor Name"),
      select("category", "Category", ["Sound", "Light", "Stage", "Decoration", "Security", "Food"]),
      input("amount", "Amount", "number"),
      select("status", "Payment Status", ["Pending", "Paid"]),
      input("dueDate", "Due Date", "date"),
      input("owner", "Owner"),
    ];
  }

  return [
    select("category", "Category", ["Venue", "Artist", "Marketing", "Sound", "Lighting", "Food", "Security"]),
    input("description", "Description"),
    input("amount", "Amount", "number"),
    input("date", "Date", "date"),
  ];
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function validateForm(action: QuickAction, form: Record<string, string>) {
  const required: Record<QuickAction, string[]> = {
    event: ["name", "date", "venue", "capacity", "ticketPrice", "owner"],
    sponsor: ["companyName", "contactPerson", "sponsorshipAmount", "status", "nextFollowUp"],
    artist: ["name", "fee", "travelCost", "hotelCost", "contractStatus", "paymentStatus"],
    vendor: ["name", "category", "amount", "status", "dueDate", "owner"],
    expense: ["category", "description", "amount", "date"],
  };
  const positiveNumberFields = ["capacity", "ticketPrice", "sponsorshipAmount", "fee", "travelCost", "hotelCost", "amount"];

  for (const field of required[action]) {
    if (!form[field]?.trim()) return "Please fill all required fields before saving.";
  }

  for (const field of positiveNumberFields) {
    if (field in form && Number(form[field]) < 0) return "Numeric values cannot be negative.";
    if (field in form && Number.isNaN(Number(form[field]))) return "Please enter valid numbers.";
  }

  return "";
}

function applyQuickAction(data: EventOSData, action: QuickAction, form: Record<string, string>): EventOSData {
  const id = `${action}-${Date.now()}`;
  const activity = makeActivity(action, form);

  if (action === "event") {
    const capacity = Number(form.capacity);
    return {
      ...data,
      events: [
        {
          id,
          name: form.name.trim(),
          date: form.date,
          venue: form.venue.trim(),
          city: form.venue.trim(),
          eventTime: "19:30",
          eventType: "Comedy Show",
          mainArtist: form.name.trim(),
          capacity,
          status: "Planning",
          ticketsSold: 0,
          ticketPrice: Number(form.ticketPrice),
          owner: form.owner.trim(),
          progress: 8,
          expectedRevenue: capacity * Number(form.ticketPrice),
          expectedExpense: 0,
          archived: false,
          notes: "",
          files: [],
        },
        ...data.events,
      ],
      activities: [activity, ...data.activities],
    };
  }

  if (action === "sponsor") {
    return {
      ...data,
      sponsors: [
        {
          id,
          companyName: form.companyName.trim(),
          contactPerson: form.contactPerson.trim(),
          sponsorshipAmount: Number(form.sponsorshipAmount),
          status: form.status as SponsorStatus,
          notes: form.notes.trim() || "Added from dashboard quick action.",
          nextFollowUp: form.nextFollowUp,
        },
        ...data.sponsors,
      ],
      activities: [activity, ...data.activities],
    };
  }

  if (action === "artist") {
    return {
      ...data,
      artists: [
        {
          id,
          name: form.name.trim(),
          fee: Number(form.fee),
          travelCost: Number(form.travelCost),
          hotelCost: Number(form.hotelCost),
          paymentStatus: form.paymentStatus as PaymentStatus,
          contractStatus: form.contractStatus as ContractStatus,
          profile: "Added from dashboard quick action.",
          performanceSlot: form.performanceSlot.trim() || "TBC",
        },
        ...data.artists,
      ],
      activities: [activity, ...data.activities],
    };
  }

  if (action === "vendor") {
    return {
      ...data,
      vendors: [
        {
          id,
          name: form.name.trim(),
          category: form.category as VendorCategory,
          amount: Number(form.amount),
          status: form.status as "Pending" | "Paid",
          dueDate: form.dueDate,
          owner: form.owner.trim(),
        },
        ...data.vendors,
      ],
      activities: [activity, ...data.activities],
    };
  }

  return {
    ...data,
    expenses: [
      {
        id,
        category: form.category as ExpenseCategory,
        description: form.description.trim(),
        amount: Number(form.amount),
        date: form.date,
      },
      ...data.expenses,
    ],
    activities: [activity, ...data.activities],
  };
}

function makeActivity(action: QuickAction, form: Record<string, string>) {
  const labels: Record<QuickAction, { message: string; entity: string; type: "Event" | "Sponsor" | "Artist" | "Vendor" | "Finance" }> = {
    event: { message: `Created event ${form.name}`, entity: "Events", type: "Event" },
    sponsor: { message: `Added sponsor ${form.companyName}`, entity: "Sponsors", type: "Sponsor" },
    artist: { message: `Added artist ${form.name}`, entity: "Artists", type: "Artist" },
    vendor: { message: `Added vendor ${form.name}`, entity: "Vendors", type: "Vendor" },
    expense: { message: `Added expense ${formatCurrency(Number(form.amount))}`, entity: "Finance", type: "Finance" },
  };

  return {
    id: `activity-${Date.now()}`,
    ...labels[action],
    time: "Just now",
  };
}

function makeChartLabel(name: string) {
  const words = name.split(" ").filter(Boolean);
  if (words.length <= 1) return name.slice(0, 10);
  return words
    .slice(0, 2)
    .map((word, index) => (index === 0 ? word.slice(0, 7) : word[0]))
    .join(" ");
}

function filterDashboardData(data: EventOSData, filter: string): EventOSData {
  if (filter === ALL_EVENTS_FILTER) return data;

  return {
    ...data,
    activities: data.activities.filter((activity) => matchesEventFilter(activity.eventId, filter)),
    events: data.events.filter((event) => filter !== UNASSIGNED_EVENTS_FILTER && event.id === filter),
    expenses: data.expenses.filter((expense) => matchesEventFilter(expense.eventId, filter)),
    sponsors: data.sponsors.filter((sponsor) => matchesEventFilter(sponsor.eventId, filter)),
    tasks: data.tasks.filter((task) => matchesEventFilter(task.eventId, filter)),
    ticketCategories: data.ticketCategories.filter((ticket) => matchesEventFilter(ticket.eventId, filter)),
  };
}

function getDashboardScope(data: EventOSData, filter: string) {
  if (filter === ALL_EVENTS_FILTER) {
    return { shortLabel: "all events" };
  }
  if (filter === UNASSIGNED_EVENTS_FILTER) {
    return { shortLabel: "workspace-wide records" };
  }

  const eventName = data.events.find((event) => event.id === filter)?.name ?? "selected event";
  return { shortLabel: eventName };
}

function readStoredFinanceTransactions() {
  try {
    const saved = localStorage.getItem("eventos-finance-transactions-v1");
    return saved ? JSON.parse(saved) as FinanceTransactionRecord[] : [];
  } catch {
    return [];
  }
}

function buildCalendar(data: EventOSData) {
  const anchor = data.events[0]?.date ? new Date(data.events[0].date) : new Date();
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  const monthEvents = data.events
    .filter((event) => {
      const date = new Date(event.date);
      return date.getFullYear() === year && date.getMonth() === month;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const eventDays = new Set(
    monthEvents
      .map((event) => new Date(event.date))
      .map((date) => date.getDate()),
  );
  const taskDays = new Set(
    data.tasks
      .map((task) => new Date(task.dueDate))
      .filter((date) => date.getFullYear() === year && date.getMonth() === month)
      .map((date) => date.getDate()),
  );

  return {
    cells: [...Array<null>(mondayOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)],
    eventDays,
    monthEvents,
    monthLabel: anchor.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    taskDays,
  };
}

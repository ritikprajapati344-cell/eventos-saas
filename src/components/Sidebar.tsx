import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Gauge,
  LayoutDashboard,
  LogOut,
  Mic2,
  ReceiptIndianRupee,
  Settings,
  ShieldCheck,
  Ticket,
  Tickets,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import type { EventItem, EventOSData } from "../types";

const navigation = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Events", path: "/events", icon: CalendarDays },
  { label: "Sponsors", path: "/sponsors", icon: BriefcaseBusiness },
  { label: "Artists", path: "/artists", icon: Mic2 },
  { label: "Vendors", path: "/vendors", icon: ShieldCheck },
  { label: "Ticketing", path: "/ticketing", icon: Tickets },
  { label: "Finance", path: "/finance", icon: ReceiptIndianRupee },
  { label: "Expenses", path: "/expenses", icon: CircleDollarSign },
  { label: "Reports", path: "/reports", icon: BarChart3 },
  { label: "Settings", path: "/settings", icon: Settings },
];

interface SidebarProps {
  data: EventOSData;
  onNavigate?: () => void;
}

export function Sidebar({ data, onNavigate }: SidebarProps) {
  const location = useLocation();
  const eventHealth = getEventHealth(data, location.pathname);
  const { signOut, user } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      onNavigate?.();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <aside className="flex h-full flex-col overflow-y-auto border-r border-white/10 bg-slate-950/78 p-4 backdrop-blur-xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-app-primary text-white shadow-glow">
          <Ticket size={22} />
        </div>
        <div>
          <p className="text-xl font-semibold tracking-normal text-white">EventOS</p>
          <p className="text-xs uppercase tracking-[0.16em] text-app-muted">Operating System</p>
        </div>
      </div>

      <nav className="space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition duration-200",
                  isActive
                    ? "bg-app-primary text-white shadow-glow"
                    : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
                ].join(" ")
              }
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <EventHealthCard health={eventHealth} />

      <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
        <p className="min-w-0 truncate px-1 text-xs text-app-muted" title={user?.email}>
          {user?.email ?? "Authenticated user"}
        </p>
        <button
          className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-950/35 px-3 text-sm font-medium text-slate-200 transition hover:border-app-danger/35 hover:bg-app-danger/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSigningOut}
          onClick={() => void handleSignOut()}
          type="button"
        >
          <LogOut size={17} />
          {isSigningOut ? "Signing out..." : "Sign Out"}
        </button>
      </div>
    </aside>
  );
}

type EventHealth = {
  artistConfirmation: number;
  event?: EventItem;
  readiness: number;
  sponsorProgress: number;
  ticketsSold: number;
  vendorCompletion: number;
};

function EventHealthCard({ health }: { health: EventHealth }) {
  if (!health.event) {
    return (
      <div className="mt-auto rounded-lg border border-app-primary/20 bg-white/[0.04] p-3 shadow-premium">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Gauge size={16} className="text-blue-200" />
          Event Health
        </div>
        <p className="mt-2 text-xs leading-5 text-app-muted">No active event found.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-app-primary/25 bg-gradient-to-b from-app-panel/95 to-slate-950/70 p-3 shadow-premium lg:mt-auto">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.14em] text-app-primary">Event Health</p>
          <p className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-5 text-white">{health.event.name}</p>
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-app-primary/30 bg-app-primary/14 text-blue-200">
          <Gauge size={17} />
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <HealthRow label="Tickets Sold" value={health.ticketsSold} />
        <HealthRow label="Sponsor Progress" value={health.sponsorProgress} />
        <HealthRow label="Vendor Completion" value={health.vendorCompletion} />
        <HealthRow label="Artist Confirmation" value={health.artistConfirmation} />
      </div>

      <div className="mt-3 rounded-lg border border-app-primary/20 bg-slate-950/45 px-3 py-2">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-slate-300">Overall Event Readiness</span>
          <span className="font-semibold text-white">{health.readiness}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-app-success" style={{ width: `${health.readiness}%` }} />
        </div>
      </div>
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-app-muted">{label}</span>
        <span className="font-medium text-slate-200">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-app-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function getEventHealth(data: EventOSData, pathname: string): EventHealth {
  const routeEventId = pathname.match(/^\/events\/([^/]+)/)?.[1];
  const routeEvent = routeEventId ? data.events.find((event) => event.id === routeEventId && !event.archived) : undefined;
  const activeEvents = data.events
    .filter((event) => !event.archived && !["Completed", "Cancelled"].includes(event.status))
    .sort((first, second) => getStatusRank(first.status) - getStatusRank(second.status) || new Date(first.date).getTime() - new Date(second.date).getTime());
  const event = routeEvent ?? activeEvents[0];

  if (!event) {
    return {
      artistConfirmation: 0,
      readiness: 0,
      sponsorProgress: 0,
      ticketsSold: 0,
      vendorCompletion: 0,
    };
  }

  const eventTickets = data.ticketCategories.filter((ticket) => ticket.eventId === event.id);
  const ticketInventory = eventTickets.reduce((sum, ticket) => sum + ticket.inventory, 0);
  const ticketSoldCount = eventTickets.reduce((sum, ticket) => sum + ticket.sold, 0);
  const ticketsSold = ticketInventory > 0 ? percent(ticketSoldCount, ticketInventory) : percent(event.ticketsSold, event.capacity);

  const eventSponsors = data.sponsors.filter((sponsor) => sponsor.eventId === event.id);
  const sponsorProgress = eventSponsors.length > 0
    ? percent(eventSponsors.filter((sponsor) => sponsor.status === "Closed Won").length, eventSponsors.length)
    : 0;

  const eventVendors = data.vendors.filter((vendor) => vendor.eventId === event.id);
  const vendorCompletion = eventVendors.length > 0
    ? percent(eventVendors.filter((vendor) => vendor.status === "Paid").length, eventVendors.length)
    : 0;

  const eventArtists = data.artists.filter((artist) => artist.eventId === event.id);
  const artistConfirmation = eventArtists.length > 0
    ? percent(eventArtists.filter((artist) => artist.contractStatus === "Signed").length, eventArtists.length)
    : 0;

  return {
    artistConfirmation,
    event,
    readiness: Math.round((ticketsSold + sponsorProgress + vendorCompletion + artistConfirmation) / 4),
    sponsorProgress,
    ticketsSold,
    vendorCompletion,
  };
}

function getStatusRank(status: EventItem["status"]) {
  const ranks: Record<EventItem["status"], number> = {
    Ongoing: 0,
    Upcoming: 1,
    Planning: 2,
    Completed: 3,
    Cancelled: 4,
  };
  return ranks[status];
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

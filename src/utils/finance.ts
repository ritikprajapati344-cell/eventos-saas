import type { Artist, EventItem, Expense, Sponsor, TicketCategory, Vendor } from "../types";

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(value);

export const getTicketRevenue = (events: EventItem[], tickets: TicketCategory[] = []) => {
  if (tickets.length > 0) {
    return tickets.reduce((total, ticket) => total + ticket.sold * ticket.price, 0);
  }

  return events.reduce((total, event) => total + event.ticketsSold * event.ticketPrice, 0);
};

export const getAvailableTickets = (tickets: TicketCategory[]) =>
  tickets.reduce((total, ticket) => total + Math.max(ticket.inventory - ticket.sold, 0), 0);

export const getTicketsSold = (events: EventItem[], tickets: TicketCategory[] = []) => {
  if (tickets.length > 0) {
    return tickets.reduce((total, ticket) => total + ticket.sold, 0);
  }

  return events.reduce((total, event) => total + event.ticketsSold, 0);
};

export const getTicketInventory = (events: EventItem[], tickets: TicketCategory[] = []) => {
  if (tickets.length > 0) {
    return tickets.reduce((total, ticket) => total + ticket.inventory, 0);
  }

  return events.reduce((total, event) => total + event.capacity, 0);
};

export const getSponsorRevenue = (sponsors: Sponsor[]) =>
  sponsors
    .filter((sponsor) => sponsor.status === "Closed Won")
    .reduce((total, sponsor) => total + sponsor.sponsorshipAmount, 0);

export const getPipelineValue = (sponsors: Sponsor[]) =>
  sponsors
    .filter((sponsor) => !["Closed Won", "Closed Lost"].includes(sponsor.status))
    .reduce((total, sponsor) => total + sponsor.sponsorshipAmount, 0);

export const getArtistExpense = (artists: Artist[]) =>
  artists.reduce((total, artist) => total + artist.fee + artist.travelCost + artist.hotelCost, 0);

export const getVendorExpense = (vendors: Vendor[]) =>
  vendors.reduce((total, vendor) => total + vendor.amount, 0);

export const getPendingVendorPayments = (vendors: Vendor[]) =>
  vendors.filter((vendor) => vendor.status === "Pending").reduce((total, vendor) => total + vendor.amount, 0);

export const getTotalExpenses = (expenses: Expense[]) =>
  expenses.reduce((total, expense) => total + expense.amount, 0);

export const getTotalRevenue = (events: EventItem[], sponsors: Sponsor[], tickets: TicketCategory[] = []) =>
  getTicketRevenue(events, tickets) + getSponsorRevenue(sponsors);

export const getNetProfit = (events: EventItem[], sponsors: Sponsor[], expenses: Expense[], tickets: TicketCategory[] = []) =>
  getTotalRevenue(events, sponsors, tickets) - getTotalExpenses(expenses);

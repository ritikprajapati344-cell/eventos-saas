import type { CheckInStatus, EventOSData, PaymentStatus } from "../types";

export function calculateEventWorkspace(data: EventOSData, eventId: string) {
  const event = data.events.find((item) => item.id === eventId);
  const tickets = data.ticketCategories
    .filter((ticket) => ticket.eventId === eventId)
    .map((ticket) => ({
      ...ticket,
      sold: Math.min(ticket.sold, ticket.inventory),
      status: getTicketStatus(ticket.sold, ticket.inventory),
    }));
  const sponsors = data.sponsors.filter((sponsor) => sponsor.eventId === eventId);
  const artists = data.artists.filter((artist) => artist.eventId === eventId);
  const vendors = data.vendors.filter((vendor) => vendor.eventId === eventId);
  const expenses = data.expenses.filter((expense) => expense.eventId === eventId);
  const tasks = data.tasks.filter((task) => task.eventId === eventId);
  const timeline = data.timeline.filter((item) => item.eventId === eventId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const expectedTicketRevenue = tickets.reduce((sum, ticket) => sum + ticket.inventory * ticket.price, 0);
  const ticketRevenue = tickets.reduce((sum, ticket) => sum + ticket.sold * ticket.price, 0);
  const expectedSponsorRevenue = sponsors.filter((sponsor) => sponsor.status !== "Closed Lost").reduce((sum, sponsor) => sum + sponsor.sponsorshipAmount, 0);
  const sponsorRevenue = sponsors.filter((sponsor) => sponsor.status === "Closed Won" && sponsor.paymentReceived).reduce((sum, sponsor) => sum + sponsor.sponsorshipAmount, 0);
  const artistCost = artists.reduce((sum, artist) => sum + getArtistTotal(artist), 0);
  const artistActualPaid = artists.reduce((sum, artist) => sum + getArtistPaidAmount(artist), 0);
  const vendorCost = vendors.reduce((sum, vendor) => sum + vendor.amount, 0);
  const vendorPaid = vendors.reduce((sum, vendor) => sum + (vendor.advancePaid ?? 0), 0);
  const vendorOutstanding = vendors.reduce((sum, vendor) => sum + getVendorRemaining(vendor), 0);
  const ledgerExpense = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const expectedRevenue = event?.expectedRevenue ?? expectedTicketRevenue + expectedSponsorRevenue;
  const actualRevenue = ticketRevenue + sponsorRevenue;
  const expectedExpense = event?.expectedExpense ?? artistCost + vendorCost + ledgerExpense;
  const actualExpense = artistActualPaid + vendorPaid + ledgerExpense;
  const ticketChart = tickets.map((ticket) => ({ name: makeChartLabel(ticket.name), fullName: ticket.name, revenue: ticket.sold * ticket.price }));
  const expenseMap = new Map<string, number>();
  expenses.forEach((expense) => expenseMap.set(expense.category, (expenseMap.get(expense.category) ?? 0) + expense.amount));
  artists.forEach((artist) => expenseMap.set("Artist", (expenseMap.get("Artist") ?? 0) + getArtistTotal(artist)));
  vendors.forEach((vendor) => expenseMap.set(vendor.category, (expenseMap.get(vendor.category) ?? 0) + vendor.amount));
  const expenseChart = Array.from(expenseMap, ([name, value]) => ({ name, value }));
  const sponsorChart = sponsors.map((sponsor) => ({
    name: sponsor.companyName.split(" ").slice(0, 2).join(" "),
    deal: sponsor.sponsorshipAmount,
    received: sponsor.paymentReceived ? sponsor.sponsorshipAmount : 0,
  }));
  const expectedProfit = expectedRevenue - expectedExpense;
  const actualProfit = actualRevenue - actualExpense;
  const profitTrend = [
    { label: "Plan", expected: expectedProfit, actual: 0 },
    { label: "Now", expected: expectedProfit, actual: actualProfit },
  ];

  return {
    tickets,
    sponsors,
    artists,
    vendors,
    expenses,
    tasks,
    timeline,
    expectedRevenue,
    actualRevenue,
    expectedExpense,
    actualExpense,
    expectedProfit,
    actualProfit,
    ticketRevenue,
    sponsorRevenue,
    artistCost,
    vendorOutstanding,
    totalTicketsSold: tickets.reduce((sum, ticket) => sum + ticket.sold, 0),
    ticketChart,
    expenseChart,
    sponsorChart,
    profitTrend,
  };
}

function getTicketStatus(sold: number, inventory: number): CheckInStatus {
  if (sold <= 0) return "Not Started";
  if (sold >= inventory) return "Sold Out";
  return "Active";
}

function makeChartLabel(name: string) {
  const words = name.split(" ").filter(Boolean);
  if (words.length <= 1) return name.slice(0, 10);
  return words
    .slice(0, 2)
    .map((word, index) => (index === 0 ? word.slice(0, 8) : word[0]))
    .join(" ");
}

function getArtistTotal(artist: { fee: number; travelCost: number; hotelCost: number; greenRoomCost?: number }) {
  return artist.fee + artist.travelCost + artist.hotelCost + (artist.greenRoomCost ?? 0);
}

function getArtistPaidAmount(artist: { paymentStatus: PaymentStatus; fee: number; travelCost: number; hotelCost: number; greenRoomCost?: number }) {
  const total = getArtistTotal(artist);
  if (artist.paymentStatus === "Paid") return total;
  if (artist.paymentStatus === "Partial") return Math.round(total / 2);
  return 0;
}

function getVendorRemaining(vendor: { amount: number; advancePaid?: number }) {
  return Math.max(vendor.amount - (vendor.advancePaid ?? 0), 0);
}

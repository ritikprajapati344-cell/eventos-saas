export type EventStatus = "Planning" | "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
export type EventType = "Comedy Show" | "Concert" | "Corporate Event" | "College Fest" | "Conference" | "Custom";
export type SponsorStatus =
  | "Lead"
  | "Contacted"
  | "Proposal Sent"
  | "Negotiation"
  | "Closed Won"
  | "Closed Lost";
export type PaymentStatus = "Pending" | "Partial" | "Paid";
export type ContractStatus = "Draft" | "Sent" | "Signed" | "On Hold";
export type VendorCategory = "Sound" | "Light" | "Stage" | "Decoration" | "Security" | "Food";
export type ExpenseCategory =
  | "Venue"
  | "Artist"
  | "Marketing"
  | "Sound"
  | "Lighting"
  | "Food"
  | "Security";
export type TaskStatus = "Open" | "In Progress" | "Blocked" | "Done";
export type TaskPriority = "High" | "Medium" | "Low";
export type CheckInStatus = "Not Started" | "Active" | "Sold Out";

export interface EventItem {
  id: string;
  name: string;
  date: string;
  venue: string;
  city: string;
  eventTime: string;
  eventType: EventType;
  mainArtist: string;
  capacity: number;
  status: EventStatus;
  ticketsSold: number;
  ticketPrice: number;
  owner: string;
  progress: number;
  expectedRevenue: number;
  expectedExpense: number;
  archived: boolean;
  notes: string;
  files: EventFile[];
}

export interface EventFile {
  id: string;
  name: string;
  fileType: string;
  uploadDate: string;
  size?: number;
  dataUrl?: string;
}

export interface Sponsor {
  id: string;
  eventId?: string;
  companyName: string;
  contactPerson: string;
  phone?: string;
  email?: string;
  sponsorshipAmount: number;
  status: SponsorStatus;
  notes: string;
  nextFollowUp: string;
  agreementUploaded?: boolean;
  paymentReceived?: boolean;
}

export interface Artist {
  id: string;
  eventId?: string;
  name: string;
  fee: number;
  travelCost: number;
  hotelCost: number;
  greenRoomCost?: number;
  technicalRiderStatus?: "Pending" | "Received" | "Approved";
  paymentStatus: PaymentStatus;
  contractStatus: ContractStatus;
  profile: string;
  performanceSlot: string;
}

export interface Vendor {
  id: string;
  eventId?: string;
  name: string;
  category: VendorCategory;
  amount: number;
  advancePaid?: number;
  status: "Pending" | "Paid";
  dueDate: string;
  owner: string;
}

export interface Expense {
  id: string;
  eventId?: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
}

export interface TicketCategory {
  id: string;
  eventId: string;
  name: string;
  price: number;
  inventory: number;
  sold: number;
  checkedIn: number;
  status: CheckInStatus;
}

export interface Task {
  completedAt?: string;
  id: string;
  title: string;
  eventId: string;
  owner: string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface Activity {
  id: string;
  message: string;
  entity: string;
  time: string;
  type: "Event" | "Sponsor" | "Artist" | "Vendor" | "Finance" | "Ticketing";
}

export interface TimelineItem {
  id: string;
  eventId: string;
  date: string;
  title: string;
  description: string;
  status: "Done" | "Active" | "Upcoming";
}

export interface ForecastPoint {
  month: string;
  forecast: number;
  actual: number;
}

export interface EventOSData {
  events: EventItem[];
  sponsors: Sponsor[];
  artists: Artist[];
  vendors: Vendor[];
  expenses: Expense[];
  ticketCategories: TicketCategory[];
  tasks: Task[];
  activities: Activity[];
  timeline: TimelineItem[];
  revenueForecast: ForecastPoint[];
}

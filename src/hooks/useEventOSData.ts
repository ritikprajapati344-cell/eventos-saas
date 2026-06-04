import { useEffect, useState } from "react";
import { demoData } from "../data/demoData";
import type { EventOSData, SponsorStatus } from "../types";

const STORAGE_KEY = "eventos-demo-data-v2";

function normalizeSponsorStatus(status: string): SponsorStatus {
  if (status === "Won") return "Closed Won";
  if (status === "Lost") return "Closed Lost";
  return status as SponsorStatus;
}

function hydrateData(saved: Partial<EventOSData>): EventOSData {
  return {
    ...demoData,
    ...saved,
    events: (saved.events ?? demoData.events).map((event) => ({
      ...event,
      status: String(event.status) === "Live" ? "Ongoing" : event.status,
      city: event.city ?? event.venue,
      eventTime: event.eventTime ?? "19:30",
      eventType: event.eventType ?? "Comedy Show",
      mainArtist: event.mainArtist ?? event.name,
      owner: event.owner ?? "Event Ops",
      progress: event.progress ?? Math.round((event.ticketsSold / event.capacity) * 100),
      expectedRevenue: event.expectedRevenue ?? event.ticketsSold * event.ticketPrice,
      expectedExpense: event.expectedExpense ?? 0,
      archived: event.archived ?? false,
      notes: event.notes ?? "",
      files: (event.files ?? []).map((file) => ({
        id: file.id,
        name: file.name,
        fileType: file.fileType ?? "Document",
        uploadDate: file.uploadDate ?? "2026-06-02",
      })),
    })),
    sponsors: (saved.sponsors ?? demoData.sponsors).map((sponsor) => ({
      ...sponsor,
      status: normalizeSponsorStatus(sponsor.status),
      eventId: sponsor.eventId ?? demoData.sponsors.find((item) => item.id === sponsor.id)?.eventId,
      nextFollowUp: sponsor.nextFollowUp ?? "2026-06-06",
      phone: sponsor.phone ?? "",
      email: sponsor.email ?? "",
      agreementUploaded: sponsor.agreementUploaded ?? sponsor.status === "Closed Won",
      paymentReceived: sponsor.paymentReceived ?? sponsor.status === "Closed Won",
    })),
    artists: (saved.artists ?? demoData.artists).map((artist) => ({
      ...artist,
      eventId: artist.eventId ?? demoData.artists.find((item) => item.id === artist.id)?.eventId,
      greenRoomCost: artist.greenRoomCost ?? 0,
      technicalRiderStatus: artist.technicalRiderStatus ?? "Pending",
      contractStatus: artist.contractStatus ?? "Sent",
      profile: artist.profile ?? "Artist profile pending.",
      performanceSlot: artist.performanceSlot ?? "TBC",
    })),
    vendors: (saved.vendors ?? demoData.vendors).map((vendor) => ({
      ...vendor,
      eventId: vendor.eventId ?? demoData.vendors.find((item) => item.id === vendor.id)?.eventId,
      advancePaid: vendor.advancePaid ?? (vendor.status === "Paid" ? vendor.amount : 0),
      dueDate: vendor.dueDate ?? "2026-06-15",
      owner: vendor.owner ?? "Ops",
    })),
    expenses: (saved.expenses ?? demoData.expenses).map((expense) => ({
      ...expense,
      eventId: expense.eventId ?? demoData.expenses.find((item) => item.id === expense.id)?.eventId,
    })),
    ticketCategories: saved.ticketCategories ?? demoData.ticketCategories,
    tasks: saved.tasks ?? demoData.tasks,
    activities: saved.activities ?? demoData.activities,
    timeline: saved.timeline ?? demoData.timeline,
    revenueForecast: saved.revenueForecast ?? demoData.revenueForecast,
  };
}

export function useEventOSData() {
  const [data, setData] = useState<EventOSData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? hydrateData(JSON.parse(saved) as Partial<EventOSData>) : demoData;
    } catch {
      return demoData;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  return { data, setData };
}

import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { AuthGate } from "./components/AuthGate";
import { useActivitiesData } from "./hooks/useActivitiesData";
import { useArtistsData } from "./hooks/useArtistsData";
import { useAuth } from "./hooks/useAuth";
import { useExpensesData } from "./hooks/useExpensesData";
import { useFinanceData } from "./hooks/useFinanceData";
import { useEventOSData } from "./hooks/useEventOSData";
import { useEventFilesData } from "./hooks/useEventFilesData";
import { useEventsData } from "./hooks/useEventsData";
import { useSettingsData } from "./hooks/useSettingsData";
import { useSponsorsData } from "./hooks/useSponsorsData";
import { useTasksData } from "./hooks/useTasksData";
import { useTicketingData } from "./hooks/useTicketingData";
import { useTimelineData } from "./hooks/useTimelineData";
import { useVendorsData } from "./hooks/useVendorsData";
import Artists from "./pages/Artists";
import Dashboard from "./pages/Dashboard";
import EventDetail from "./pages/EventDetail";
import Events from "./pages/Events";
import Expenses from "./pages/Expenses";
import Finance from "./pages/Finance";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Sponsors from "./pages/Sponsors";
import Ticketing from "./pages/Ticketing";
import Vendors from "./pages/Vendors";

export default function App() {
  return (
    <AuthGate fallback={<Login />} loadingFallback={<AuthLoadingScreen />}>
      <AuthenticatedApp />
    </AuthGate>
  );
}

function AuthenticatedApp() {
  const { user, workspaceId } = useAuth();
  const { data: localData, setData } = useEventOSData();
  const activitiesData = useActivitiesData(workspaceId);
  const eventFilesData = useEventFilesData(workspaceId, user?.id ?? null);
  const eventsData = useEventsData(workspaceId);
  const sponsorsData = useSponsorsData(workspaceId);
  const artistsData = useArtistsData(workspaceId);
  const vendorsData = useVendorsData(workspaceId);
  const ticketingData = useTicketingData(workspaceId);
  const expensesData = useExpensesData(workspaceId);
  const financeData = useFinanceData(workspaceId);
  const settingsData = useSettingsData(workspaceId);
  const tasksData = useTasksData(workspaceId);
  const timelineData = useTimelineData(workspaceId);
  const data = activitiesData.isSupabaseMode || eventFilesData.isSupabaseMode || eventsData.isSupabaseMode || sponsorsData.isSupabaseMode || artistsData.isSupabaseMode || vendorsData.isSupabaseMode || ticketingData.isSupabaseMode || expensesData.isSupabaseMode || tasksData.isSupabaseMode || timelineData.isSupabaseMode
    ? {
        ...localData,
        activities: activitiesData.isSupabaseMode ? activitiesData.activities : localData.activities,
        artists: artistsData.isSupabaseMode ? artistsData.artists : localData.artists,
        events: eventsData.isSupabaseMode
          ? eventsData.events.map((event) => ({
              ...event,
              files: eventFilesData.isSupabaseMode
                ? eventFilesData.files.filter((file) => file.eventId === event.id)
                : event.files,
            }))
          : localData.events,
        expenses: expensesData.isSupabaseMode ? expensesData.expenses : localData.expenses,
        sponsors: sponsorsData.isSupabaseMode ? sponsorsData.sponsors : localData.sponsors,
        tasks: tasksData.isSupabaseMode ? tasksData.tasks : localData.tasks,
        ticketCategories: ticketingData.isSupabaseMode ? ticketingData.ticketCategories : localData.ticketCategories,
        timeline: timelineData.isSupabaseMode ? timelineData.timeline : localData.timeline,
        vendors: vendorsData.isSupabaseMode ? vendorsData.vendors : localData.vendors,
      }
    : localData;

  return (
    <AppLayout data={data}>
      <Routes>
        <Route path="/" element={<Dashboard data={data} setData={setData} />} />
        <Route path="/events" element={<Events activitiesData={activitiesData} data={data} eventFilesData={eventFilesData} eventsData={eventsData} setData={setData} />} />
        <Route
          path="/events/:eventId"
          element={(
            <EventDetail
              activitiesData={activitiesData}
              artistsData={artistsData}
              data={data}
              eventFilesData={eventFilesData}
              eventsData={eventsData}
              expensesData={expensesData}
              setData={setData}
              sponsorsData={sponsorsData}
              tasksData={tasksData}
              ticketingData={ticketingData}
              timelineData={timelineData}
              vendorsData={vendorsData}
            />
          )}
        />
        <Route path="/sponsors" element={<Sponsors activitiesData={activitiesData} sponsors={data.sponsors} sponsorsData={sponsorsData} setData={setData} />} />
        <Route path="/artists" element={<Artists artists={data.artists} artistsData={artistsData} />} />
        <Route path="/vendors" element={<Vendors vendors={data.vendors} vendorsData={vendorsData} />} />
        <Route path="/ticketing" element={<Ticketing data={data} ticketingData={ticketingData} />} />
        <Route path="/finance" element={<Finance data={data} financeData={financeData} />} />
        <Route path="/expenses" element={<Expenses data={data} expensesData={expensesData} />} />
        <Route path="/reports" element={<Reports data={data} />} />
        <Route path="/settings" element={<Settings settingsData={settingsData} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

function AuthLoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-app-bg px-4">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-app-primary/30 border-t-app-primary" />
        <p className="mt-4 text-sm font-medium text-slate-200">Opening EventOS...</p>
      </div>
    </div>
  );
}

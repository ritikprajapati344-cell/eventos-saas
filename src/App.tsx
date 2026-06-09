import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { AuthGate } from "./components/AuthGate";
import { useAuth } from "./hooks/useAuth";
import { useEventOSData } from "./hooks/useEventOSData";
import { useEventsData } from "./hooks/useEventsData";
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
  const { workspaceId } = useAuth();
  const { data: localData, setData } = useEventOSData();
  const eventsData = useEventsData(workspaceId);
  const data = eventsData.isSupabaseMode
    ? { ...localData, events: eventsData.events }
    : localData;

  return (
    <AppLayout data={data}>
      <Routes>
        <Route path="/" element={<Dashboard data={data} setData={setData} />} />
        <Route path="/events" element={<Events data={data} eventsData={eventsData} setData={setData} />} />
        <Route path="/events/:eventId" element={<EventDetail data={data} setData={setData} />} />
        <Route path="/sponsors" element={<Sponsors sponsors={data.sponsors} setData={setData} />} />
        <Route path="/artists" element={<Artists artists={data.artists} />} />
        <Route path="/vendors" element={<Vendors vendors={data.vendors} />} />
        <Route path="/ticketing" element={<Ticketing data={data} />} />
        <Route path="/finance" element={<Finance data={data} />} />
        <Route path="/expenses" element={<Expenses data={data} />} />
        <Route path="/reports" element={<Reports data={data} />} />
        <Route path="/settings" element={<Settings />} />
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

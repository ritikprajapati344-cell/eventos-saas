import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { useEventOSData } from "./hooks/useEventOSData";
import Artists from "./pages/Artists";
import Dashboard from "./pages/Dashboard";
import EventDetail from "./pages/EventDetail";
import Events from "./pages/Events";
import Expenses from "./pages/Expenses";
import Finance from "./pages/Finance";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Sponsors from "./pages/Sponsors";
import Ticketing from "./pages/Ticketing";
import Vendors from "./pages/Vendors";

export default function App() {
  const { data, setData } = useEventOSData();

  return (
    <AppLayout data={data}>
      <Routes>
        <Route path="/" element={<Dashboard data={data} setData={setData} />} />
        <Route path="/events" element={<Events data={data} setData={setData} />} />
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

import { Menu, Search, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { applyThemeSettings } from "../utils/themeSettings";
import type { EventOSData } from "../types";

interface AppLayoutProps {
  children: ReactNode;
  data: EventOSData;
  isSupabaseMode: boolean;
  workspaceName?: string;
}

export function AppLayout({
  children,
  data,
  isSupabaseMode,
  workspaceName,
}: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const workspaceLabel = isSupabaseMode
    ? workspaceName?.trim() || "Cloud Workspace"
    : workspaceName?.trim() || "Local Workspace";

  useEffect(() => {
    const enforceDarkTheme = () => applyThemeSettings({});

    enforceDarkTheme();
    window.addEventListener("eventos:settings-theme-updated", enforceDarkTheme);
    return () => window.removeEventListener("eventos:settings-theme-updated", enforceDarkTheme);
  }, []);

  const updateGlobalSearch = (value: string) => {
    setGlobalSearch(value);
    sessionStorage.setItem("eventos-global-search", value);
    window.dispatchEvent(new CustomEvent("eventos:global-search", { detail: value }));
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">
        <Sidebar data={data} />
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/70"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="relative h-full w-72 max-w-[88vw]">
            <Sidebar data={data} onNavigate={() => setIsSidebarOpen(false)} />
          </div>
        </div>
      )}

      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-app-bg/78 backdrop-blur-xl">
          <div className="flex min-h-16 flex-wrap items-center gap-3 px-3 py-2 sm:flex-nowrap sm:px-5 sm:py-0 lg:px-6">
            <button
              aria-label="Open navigation"
              className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-200 lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <label className="order-3 flex min-w-0 basis-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-app-muted shadow-inner sm:order-none sm:flex-1 sm:basis-auto">
              <Search size={18} className="shrink-0" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-app-muted"
                onChange={(event) => updateGlobalSearch(event.target.value)}
                placeholder="Search events, sponsors, vendors, reports..."
                type="search"
                value={globalSearch}
              />
            </label>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden rounded-lg border border-app-primary/25 bg-app-primary/10 px-3 py-2 text-sm text-app-primary lg:flex">
                <Sparkles className="mr-2 h-4 w-4 text-app-primary" />
                {workspaceLabel}
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-app-primary to-app-success font-semibold text-white shadow-glow">
                EO
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1580px] px-3 py-4 sm:px-5 lg:px-6">{children}</div>
      </main>
    </div>
  );
}

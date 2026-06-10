import { Bell, Building2, Download, Palette, Save, SlidersHorizontal, Upload, UserRound } from "lucide-react";
import type { ChangeEvent, ElementType, ReactNode } from "react";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import type { SettingsDataSource } from "../hooks/useSettingsData";
import type { WorkspaceSettingsWriteInput } from "../lib/workspaceSettingsRepository";

type SettingsState = WorkspaceSettingsWriteInput;

interface SettingsProps {
  settingsData: SettingsDataSource;
}

const settingsStorageKey = "eventos-settings-v1";
const eventOSDataStorageKey = "eventos-demo-data-v2";

const defaultSettings: SettingsState = {
  accentColor: "#3B82F6",
  compactDashboard: false,
  companyLogo: "",
  companyName: "EventOS Demo Agency",
  contactNumber: "",
  dailyDigest: false,
  darkTheme: true,
  defaultCurrency: "INR",
  emailAddress: "",
  exportButtons: true,
  localStorageMode: true,
  organizerName: "Event Manager",
  paymentReminders: true,
  profitUpdates: true,
  role: "Organizer",
  sponsorFollowUps: true,
  workspaceRegion: "India",
};

export default function Settings({ settingsData }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsState>(() => (
    settingsData.isSupabaseMode ? defaultSettings : readSettings()
  ));
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (settingsData.isSupabaseMode && settingsData.settings) {
      const { preferences: _preferences, ...remoteSettings } = settingsData.settings;
      setSettings(remoteSettings);
    }
  }, [settingsData.isSupabaseMode, settingsData.settings]);

  const updateSetting = <K extends keyof SettingsState>(field: K, value: SettingsState[K]) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const saveSettings = async () => {
    if (settingsData.isSupabaseMode) {
      setIsSaving(true);
      settingsData.clearError();
      try {
        const savedSettings = await settingsData.saveSettings(settings);
        const { preferences: _preferences, ...remoteSettings } = savedSettings;
        setSettings(remoteSettings);
        window.dispatchEvent(new Event("eventos:settings-theme-updated"));
        showToast("Settings saved successfully.");
      } catch {
        // The hook exposes the workspace-scoped error below.
      } finally {
        setIsSaving(false);
      }
      return;
    }

    localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
    window.dispatchEvent(new Event("eventos:settings-theme-updated"));
    showToast("Settings saved successfully.");
  };

  const uploadLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateSetting("companyLogo", typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  };

  const exportWorkspace = () => {
    const savedData = localStorage.getItem(eventOSDataStorageKey) ?? "{}";
    const blob = new Blob([savedData], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "eventos-workspace-backup.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importWorkspace = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = typeof reader.result === "string" ? reader.result : "{}";
        JSON.parse(content);
        localStorage.setItem(eventOSDataStorageKey, content);
        showToast("Workspace data imported successfully. Refresh to load imported data.");
      } catch {
        showToast("Import failed. Please select a valid JSON file.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="SaaS-style workspace settings for company profile, theme, notifications and preferences."
        action={
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-medium text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving || settingsData.isLoading} onClick={() => void saveSettings()} type="button">
            <Save size={17} />
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        }
      />

      {toast && <p className="rounded-lg border border-app-success/30 bg-app-success/10 px-3 py-2 text-sm text-green-100">{toast}</p>}
      {settingsData.isSupabaseMode && settingsData.error && (
        <p className="rounded-lg border border-app-danger/30 bg-app-danger/10 px-3 py-2 text-sm text-red-100">
          {settingsData.error} No local settings were loaded as a fallback.
        </p>
      )}
      {settingsData.isSupabaseMode && settingsData.isLoading && (
        <div className="glass-panel rounded-lg p-6 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-app-primary/30 border-t-app-primary" />
          <p className="mt-3 text-sm text-app-muted">Loading workspace settings...</p>
        </div>
      )}

      {!settingsData.isLoading && (
        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="glass-panel rounded-lg p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <Building2 size={19} />
            Company Information
          </h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.12em] text-app-muted">Company Logo</span>
              <div className="mt-2 flex flex-col items-stretch gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:flex-row sm:items-center">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-slate-950/40 text-sm font-semibold text-white">
                  {settings.companyLogo ? <img alt="Company logo" className="h-full w-full object-cover" src={settings.companyLogo} /> : "Logo"}
                </div>
                <input accept="image/*" className="block min-w-0 w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-app-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white" onChange={uploadLogo} type="file" />
              </div>
            </label>
            <Field label="Company Name" onChange={(value) => updateSetting("companyName", value)} value={settings.companyName} />
            <Field label="Organizer Name" onChange={(value) => updateSetting("organizerName", value)} value={settings.organizerName} />
            <Field label="Contact Number" onChange={(value) => updateSetting("contactNumber", value)} value={settings.contactNumber} />
            <Field label="Email Address" onChange={(value) => updateSetting("emailAddress", value)} type="email" value={settings.emailAddress} />
            <Field label="Workspace Region" onChange={(value) => updateSetting("workspaceRegion", value)} value={settings.workspaceRegion} />
            <Field label="Default Currency" onChange={(value) => updateSetting("defaultCurrency", value)} value={settings.defaultCurrency} />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <SettingsPanel icon={Palette} title="Theme">
            <div className="rounded-lg border border-app-primary/25 bg-app-primary/10 p-4">
              <p className="text-sm font-semibold text-white">Premium dark theme enabled</p>
              <p className="mt-1 text-sm leading-5 text-app-muted">Theme customization is coming in V2.</p>
            </div>
          </SettingsPanel>

          <SettingsPanel icon={Bell} title="Notifications">
            <Toggle checked={settings.sponsorFollowUps} label="Sponsor follow-ups" onChange={(checked) => updateSetting("sponsorFollowUps", checked)} />
            <Toggle checked={settings.paymentReminders} label="Payment reminders" onChange={(checked) => updateSetting("paymentReminders", checked)} />
            <Toggle checked={settings.dailyDigest} label="Daily event digest" onChange={(checked) => updateSetting("dailyDigest", checked)} />
          </SettingsPanel>

          <SettingsPanel icon={UserRound} title="User Preferences">
            <Field label="Name" onChange={(value) => updateSetting("organizerName", value)} value={settings.organizerName} />
            <Field label="Role" onChange={(value) => updateSetting("role", value)} value={settings.role} />
          </SettingsPanel>

          <SettingsPanel icon={SlidersHorizontal} title="Workspace Controls">
            <Toggle checked={settings.localStorageMode} label="Local storage demo mode" onChange={(checked) => updateSetting("localStorageMode", checked)} />
            <Toggle checked={settings.exportButtons} label="Export buttons enabled" onChange={(checked) => updateSetting("exportButtons", checked)} />
            <Toggle checked={settings.profitUpdates} label="Auto profit updates" onChange={(checked) => updateSetting("profitUpdates", checked)} />
          </SettingsPanel>

          <SettingsPanel icon={Download} title="Workspace Backup">
            <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]" onClick={exportWorkspace} type="button">
              <Download size={17} />
              Export Full EventOS Data
            </button>
            <label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]">
              <Upload size={17} />
              Import Full EventOS Data
              <input accept="application/json,.json" className="hidden" onChange={importWorkspace} type="file" />
            </label>
          </SettingsPanel>
        </div>
        </section>
      )}
    </div>
  );
}

function SettingsPanel({
  icon: Icon,
  title,
  children,
}: {
  icon: ElementType;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="glass-panel rounded-lg p-4 sm:p-5">
      <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-white">
        <Icon size={19} />
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, onChange, type = "text", value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</span>
      <input
        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-app-primary"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function Toggle({ label, checked = false, onChange }: { label: string; checked?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-slate-200">
      <span>{label}</span>
      <input className="h-5 w-5 accent-app-primary" checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}

function readSettings() {
  try {
    const saved = localStorage.getItem(settingsStorageKey);
    return saved ? { ...defaultSettings, ...JSON.parse(saved) as Partial<SettingsState> } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

import { supabase } from "./supabase";

export interface WorkspaceSettingsRecord {
  accentColor: string;
  compactDashboard: boolean;
  companyLogo: string;
  companyName: string;
  contactNumber: string;
  dailyDigest: boolean;
  darkTheme: boolean;
  defaultCurrency: string;
  emailAddress: string;
  exportButtons: boolean;
  localStorageMode: boolean;
  organizerName: string;
  paymentReminders: boolean;
  preferences: Record<string, unknown>;
  profitUpdates: boolean;
  role: string;
  sponsorFollowUps: boolean;
  workspaceRegion: string;
}

export type WorkspaceSettingsWriteInput = Omit<
  WorkspaceSettingsRecord,
  "preferences"
>;

interface WorkspaceRow {
  contact_email: string;
  contact_phone: string;
  default_currency: string;
  id: string;
  logo_path: string | null;
  name: string;
  organizer_name: string;
  region: string;
}

interface WorkspaceSettingsRow {
  accent_color: string;
  compact_dashboard: boolean;
  daily_digest: boolean;
  dark_theme: boolean;
  export_buttons: boolean;
  local_storage_mode: boolean;
  payment_reminders: boolean;
  preferences: Record<string, unknown>;
  profit_updates: boolean;
  sponsor_follow_ups: boolean;
  workspace_id: string;
}

const workspaceColumns = "id,name,organizer_name,contact_phone,contact_email,logo_path,region,default_currency";
const settingsColumns = "workspace_id,accent_color,compact_dashboard,dark_theme,daily_digest,export_buttons,local_storage_mode,payment_reminders,profit_updates,sponsor_follow_ups,preferences";

export async function getWorkspaceSettings(
  workspaceId: string,
): Promise<WorkspaceSettingsRecord> {
  const client = requireSupabase();
  const [workspaceResult, settingsResult] = await Promise.all([
    client
      .from("workspaces")
      .select(workspaceColumns)
      .eq("id", workspaceId)
      .single(),
    client
      .from("workspace_settings")
      .select(settingsColumns)
      .eq("workspace_id", workspaceId)
      .single(),
  ]);

  if (workspaceResult.error) throw workspaceResult.error;
  if (settingsResult.error) throw settingsResult.error;

  return mapWorkspaceSettings(
    workspaceResult.data as WorkspaceRow,
    settingsResult.data as WorkspaceSettingsRow,
  );
}

export async function updateWorkspaceSettings(
  workspaceId: string,
  input: WorkspaceSettingsWriteInput,
  existingPreferences: Record<string, unknown>,
): Promise<WorkspaceSettingsRecord> {
  const client = requireSupabase();
  const preferences = {
    ...existingPreferences,
    role: input.role,
  };

  const { error: workspaceError } = await client
    .from("workspaces")
    .update({
      contact_email: input.emailAddress,
      contact_phone: input.contactNumber,
      default_currency: input.defaultCurrency,
      logo_path: input.companyLogo || null,
      name: input.companyName,
      organizer_name: input.organizerName,
      region: input.workspaceRegion,
    })
    .eq("id", workspaceId);

  if (workspaceError) throw workspaceError;

  const { error: settingsError } = await client
    .from("workspace_settings")
    .update({
      accent_color: input.accentColor,
      compact_dashboard: input.compactDashboard,
      daily_digest: input.dailyDigest,
      dark_theme: input.darkTheme,
      export_buttons: input.exportButtons,
      local_storage_mode: input.localStorageMode,
      payment_reminders: input.paymentReminders,
      preferences,
      profit_updates: input.profitUpdates,
      sponsor_follow_ups: input.sponsorFollowUps,
    })
    .eq("workspace_id", workspaceId);

  if (settingsError) throw settingsError;

  return getWorkspaceSettings(workspaceId);
}

function mapWorkspaceSettings(
  workspace: WorkspaceRow,
  settings: WorkspaceSettingsRow,
): WorkspaceSettingsRecord {
  const preferences = isPreferencesObject(settings.preferences)
    ? settings.preferences
    : {};

  return {
    accentColor: settings.accent_color,
    compactDashboard: settings.compact_dashboard,
    companyLogo: workspace.logo_path ?? "",
    companyName: workspace.name,
    contactNumber: workspace.contact_phone,
    dailyDigest: settings.daily_digest,
    darkTheme: settings.dark_theme,
    defaultCurrency: workspace.default_currency,
    emailAddress: workspace.contact_email,
    exportButtons: settings.export_buttons,
    localStorageMode: settings.local_storage_mode,
    organizerName: workspace.organizer_name,
    paymentReminders: settings.payment_reminders,
    preferences,
    profitUpdates: settings.profit_updates,
    role: typeof preferences.role === "string" ? preferences.role : "Organizer",
    sponsorFollowUps: settings.sponsor_follow_ups,
    workspaceRegion: workspace.region,
  };
}

function isPreferencesObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

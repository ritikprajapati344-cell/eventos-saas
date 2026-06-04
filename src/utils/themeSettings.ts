export type ThemeSettings = {
  accentColor?: string;
  darkTheme?: boolean;
};

export function applyThemeSettings(_settings: ThemeSettings = {}) {
  document.documentElement.style.setProperty("--color-primary", "59 130 246");
  document.documentElement.style.setProperty("--color-primary-light", "96 165 250");
  document.documentElement.style.setProperty("--color-primary-dark", "37 99 235");
  document.documentElement.style.setProperty("--color-bg", "15 23 42");
  document.documentElement.style.setProperty("--color-card", "30 41 59");
  document.documentElement.style.setProperty("--color-card-soft", "35 49 74");
  document.documentElement.style.setProperty("--color-text", "229 238 249");
  document.documentElement.style.setProperty("--color-muted", "148 163 184");
  document.documentElement.style.setProperty("--color-border", "148 163 184");
  document.documentElement.removeAttribute("data-theme");
  document.body.removeAttribute("data-theme");
}

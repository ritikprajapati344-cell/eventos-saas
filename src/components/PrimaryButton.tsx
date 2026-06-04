import type { LucideIcon } from "lucide-react";

interface PrimaryButtonProps {
  label: string;
  icon: LucideIcon;
  variant?: "primary" | "subtle";
}

export function PrimaryButton({ label, icon: Icon, variant = "primary" }: PrimaryButtonProps) {
  const classes =
    variant === "primary"
      ? "bg-app-primary text-white shadow-glow hover:bg-blue-500"
      : "border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]";

  return (
    <button className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition ${classes}`}>
      <Icon size={17} />
      <span>{label}</span>
    </button>
  );
}

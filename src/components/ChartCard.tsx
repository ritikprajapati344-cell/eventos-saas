import type { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <section className="glass-panel min-w-0 overflow-hidden rounded-lg p-3 sm:p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-app-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-app-primary">EventOS Command Center</p>
        <h1 className="text-2xl font-semibold tracking-normal text-white">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-app-muted">{description}</p>
      </div>
      {action && <div className="flex shrink-0 items-center gap-3">{action}</div>}
    </div>
  );
}

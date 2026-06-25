import { FileClock, Layers3, ListChecks } from "lucide-react";
import { PageHeader } from "../components/PageHeader";

const historySections = [
  { label: "Commands", helper: "Natural-language command history will appear here.", icon: FileClock },
  { label: "Blueprints", helper: "Generated blueprint history will appear here.", icon: Layers3 },
  { label: "Executions", helper: "Approved execution history will appear here.", icon: ListChecks },
];

export default function History() {
  return (
    <div className="space-y-5">
      <PageHeader
        description="Track commands, blueprints, approvals, and executions as the AI operating layer grows. This sprint provides the visual shell only."
        title="History"
      />

      <div className="grid gap-3 lg:grid-cols-3">
        {historySections.map((section) => {
          const Icon = section.icon;
          return (
            <article className="rounded-xl border border-white/10 bg-white/[0.04] p-5 shadow-premium" key={section.label}>
              <div className="grid h-11 w-11 place-items-center rounded-lg border border-app-primary/25 bg-app-primary/10 text-blue-100">
                <Icon size={20} />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">{section.label}</h2>
              <p className="mt-2 text-sm leading-6 text-app-muted">{section.helper}</p>
            </article>
          );
        })}
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-center shadow-premium">
        <FileClock className="mx-auto text-app-primary" size={28} />
        <h2 className="mt-3 text-lg font-semibold text-white">No AI history yet.</h2>
        <p className="mt-2 text-sm leading-6 text-app-muted">
          Command, blueprint, approval, and execution history will appear here after future approved sprints connect the AI workflow.
        </p>
      </section>
    </div>
  );
}

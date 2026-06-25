import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { PageHeader } from "../components/PageHeader";

const approvalStates = [
  { label: "Pending", value: "0", helper: "Blueprint approvals will appear here.", icon: Clock3 },
  { label: "Approved", value: "0", helper: "Approved AI actions will be tracked here.", icon: CheckCircle2 },
  { label: "Executed", value: "0", helper: "Executed approvals will remain audit-friendly.", icon: ShieldCheck },
];

export default function Approvals() {
  return (
    <div className="space-y-5">
      <PageHeader
        description="Review and approve AI-generated blueprints before EventOS executes anything. This sprint provides the visual shell only."
        title="Approvals"
      />

      <div className="grid gap-3 md:grid-cols-3">
        {approvalStates.map((state) => {
          const Icon = state.icon;
          return (
            <article className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-premium" key={state.label}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-app-muted">{state.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{state.value}</p>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-lg border border-app-primary/25 bg-app-primary/10 text-blue-100">
                  <Icon size={20} />
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-app-muted">{state.helper}</p>
            </article>
          );
        })}
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-center shadow-premium">
        <ShieldCheck className="mx-auto text-app-primary" size={28} />
        <h2 className="mt-3 text-lg font-semibold text-white">No approvals yet.</h2>
        <p className="mt-2 text-sm leading-6 text-app-muted">
          AI-generated blueprint approvals will appear here after the approval engine is connected.
        </p>
      </section>
    </div>
  );
}

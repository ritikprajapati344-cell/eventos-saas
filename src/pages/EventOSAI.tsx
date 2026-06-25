import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Crown,
  FileText,
  Megaphone,
  Mic,
  Music2,
  ShieldAlert,
  Sparkles,
  Ticket,
  Timer,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { EventOSData } from "../types";
import { formatCurrency, formatNumber } from "../utils/finance";

interface EventOSAIProps {
  data: EventOSData;
}

const suggestedPrompts = [
  {
    description: "Build a comedy blueprint with tickets, sponsors, timeline, and risk.",
    icon: Mic,
    label: "Create Comedy Show",
    prompt: "Create a 1500-seat comedy show with a premium ticketing plan.",
  },
  {
    description: "Plan ceremonies, vendors, guest flow, and readiness checkpoints.",
    icon: Crown,
    label: "Plan Wedding",
    prompt: "Plan a luxury wedding event with vendor and guest coordination.",
  },
  {
    description: "Shape artist logistics, ticket tiers, sponsors, and launch timing.",
    icon: Music2,
    label: "Plan Concert",
    prompt: "Plan a concert with tiered tickets, sponsor categories, and show-day tasks.",
  },
  {
    description: "Create a business event blueprint for audience, agenda, and sponsors.",
    icon: Building2,
    label: "Corporate Event",
    prompt: "Create a corporate event plan with finance and sponsor strategy.",
  },
  {
    description: "Prepare sponsor categories, outreach priorities, and pitch direction.",
    icon: Users,
    label: "Find Sponsors",
    prompt: "Find sponsor opportunities for my upcoming event.",
  },
  {
    description: "Map revenue targets, ticket tiers, and risk signals.",
    icon: TrendingUp,
    label: "Revenue Strategy",
    prompt: "Create a revenue strategy for an event with ticket and sponsor income.",
  },
];

const clarificationSteps = [
  "Event Basics",
  "Audience & Budget",
  "Business Goals",
  "Review",
];

const processingSteps = [
  "Understanding your event",
  "Validating requirements",
  "Planning event structure",
  "Estimating budget",
  "Building revenue strategy",
  "Building sponsor strategy",
  "Preparing execution timeline",
  "Finalizing blueprint",
];

const initialClarificationAnswers = {
  brandingGoal: "",
  budget: "",
  capacity: "",
  city: "",
  eventDate: "",
  eventName: "",
  eventType: "",
  notes: "",
  profitGoal: "",
  revenueTarget: "",
  sponsorPriority: "",
  targetAudience: "",
  ticketSalesGoal: "",
};

type ClarificationAnswers = typeof initialClarificationAnswers;
type BlueprintStage = "command" | "processing" | "preview";

function getCommandPrefill(commandText: string): Partial<ClarificationAnswers> {
  const normalized = commandText.toLowerCase();
  const prefill: Partial<ClarificationAnswers> = {};

  if (normalized.includes("sunil grover")) {
    prefill.eventName = "Sunil Grover Comedy Show";
  }

  if (normalized.includes("comedy")) {
    prefill.eventType = "Comedy Show";
  } else if (normalized.includes("concert")) {
    prefill.eventType = "Concert";
  } else if (normalized.includes("wedding")) {
    prefill.eventType = "Wedding";
  } else if (normalized.includes("corporate")) {
    prefill.eventType = "Corporate Event";
  }

  if (normalized.includes("ahmedabad")) {
    prefill.city = "Ahmedabad";
  } else if (normalized.includes("gandhidham")) {
    prefill.city = "Gandhidham";
  }

  return prefill;
}

function buildPrefilledAnswers(commandText: string): ClarificationAnswers {
  return {
    ...initialClarificationAnswers,
    ...getCommandPrefill(commandText),
  };
}

export default function EventOSAI({ data }: EventOSAIProps) {
  const activeEvents = data.events.filter((event) => !event.archived);
  const expectedRevenue = activeEvents.reduce((sum, event) => sum + event.expectedRevenue, 0);
  const openTasks = data.tasks.filter((task) => task.status !== "Done").length;
  const [command, setCommand] = useState("");
  const [isClarifying, setIsClarifying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<ClarificationAnswers>(initialClarificationAnswers);
  const [blueprintStage, setBlueprintStage] = useState<BlueprintStage>("command");
  const [activeProcessingStep, setActiveProcessingStep] = useState(0);
  const [validationMessage, setValidationMessage] = useState("");
  const [blueprintMessage, setBlueprintMessage] = useState("");

  const startClarification = () => {
    setBlueprintMessage("");
    if (!command.trim()) {
      setValidationMessage("Describe your event to start the clarification workflow.");
      return;
    }

    setValidationMessage("");
    setAnswers(buildPrefilledAnswers(command));
    setBlueprintStage("command");
    setActiveProcessingStep(0);
    setCurrentStep(0);
    setIsClarifying(true);
  };

  const cancelClarification = () => {
    setIsClarifying(false);
    setCurrentStep(0);
    setValidationMessage("");
    setBlueprintMessage("");
    setBlueprintStage("command");
    setActiveProcessingStep(0);
    setAnswers(initialClarificationAnswers);
  };

  const updateAnswer = (field: keyof ClarificationAnswers, value: string) => {
    setAnswers((current) => ({ ...current, [field]: value }));
    setValidationMessage("");
    setBlueprintMessage("");
  };

  const goNext = () => {
    const validation = validateStep(currentStep, answers);
    if (!validation.isValid) {
      setValidationMessage(validation.message);
      return;
    }

    setValidationMessage("");
    setCurrentStep((step) => Math.min(step + 1, clarificationSteps.length - 1));
  };

  const goBack = () => {
    setValidationMessage("");
    setBlueprintMessage("");
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const continueToBlueprint = () => {
    const validation = validateStep(currentStep, answers);
    if (!validation.isValid) {
      setValidationMessage(validation.message);
      return;
    }

    setValidationMessage("");
    setBlueprintMessage("");
    setIsClarifying(false);
    setActiveProcessingStep(0);
    setBlueprintStage("processing");
  };

  const showCommandCenter = () => {
    setBlueprintStage("command");
    setActiveProcessingStep(0);
    setBlueprintMessage("");
    setValidationMessage("");
  };

  if (blueprintStage === "processing") {
    return (
      <ProcessingExperience
        activeStep={activeProcessingStep}
        onStepComplete={() => {
          if (activeProcessingStep >= processingSteps.length - 1) {
            setBlueprintStage("preview");
            return;
          }

          setActiveProcessingStep((step) => Math.min(step + 1, processingSteps.length - 1));
        }}
      />
    );
  }

  if (blueprintStage === "preview") {
    return <BlueprintPreview answers={answers} command={command} onBack={showCommandCenter} />;
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-xl border border-app-primary/25 bg-slate-950/62 p-4 shadow-premium sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-primary/70 to-transparent" />
        <div className="absolute right-0 top-0 hidden h-56 w-56 rounded-full bg-app-primary/10 blur-3xl lg:block" />

        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] xl:items-start">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-app-primary/30 bg-app-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-blue-100">
              <Sparkles size={14} />
              EventOS AI
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl lg:text-6xl">
              Your AI Event Operating System
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
              What would you like to create today?
            </p>

            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-3 shadow-premium backdrop-blur-xl sm:p-4">
              <label className="sr-only" htmlFor="eventos-ai-command">
                Describe the event you want to create
              </label>
              <textarea
                className="min-h-36 w-full resize-none rounded-lg border border-white/10 bg-slate-950/72 p-4 text-base leading-7 text-white outline-none transition placeholder:text-app-muted focus:border-app-primary/70 focus:ring-2 focus:ring-app-primary/25"
                id="eventos-ai-command"
                onChange={(event) => {
                  setCommand(event.target.value);
                  setValidationMessage("");
                }}
                placeholder="Describe the event you want to create..."
                value={command}
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-app-muted">
                  UI shell only. Blueprint generation will be connected in a later approved sprint.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-300 opacity-70"
                    disabled
                    type="button"
                  >
                    <Mic size={17} />
                    Voice
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-semibold text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45"
                    onClick={startClarification}
                    type="button"
                  >
                    Generate Blueprint
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>
              {validationMessage && !isClarifying && (
                <p className="mt-3 rounded-lg border border-app-warning/30 bg-app-warning/10 px-3 py-2 text-sm text-amber-100">
                  {validationMessage}
                </p>
              )}
            </div>
          </div>

          <aside className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-premium backdrop-blur-xl">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Workspace Snapshot</p>
            <div className="mt-4 grid gap-3">
              <SnapshotCard label="Active Events" value={formatNumber(activeEvents.length)} />
              <SnapshotCard label="Open Tasks" value={formatNumber(openTasks)} />
              <SnapshotCard label="Expected Revenue" value={formatCurrency(expectedRevenue)} />
            </div>
          </aside>
        </div>
      </section>

      {isClarifying && (
        <ClarificationPanel
          answers={answers}
          blueprintMessage={blueprintMessage}
          command={command}
          currentStep={currentStep}
          onBack={goBack}
          onCancel={cancelClarification}
          onContinue={continueToBlueprint}
          onNext={goNext}
          onUpdate={updateAnswer}
          validationMessage={validationMessage}
        />
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Suggested prompts</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Start with a proven event command</h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {suggestedPrompts.map((item) => {
            const Icon = item.icon;
            return (
              <article
                className="group rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-premium transition duration-200 hover:border-app-primary/45 hover:bg-app-primary/10"
                key={item.label}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-app-primary/30 bg-app-primary/10 text-blue-100">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white">{item.label}</h3>
                    <p className="mt-1 text-sm leading-6 text-app-muted">{item.description}</p>
                  </div>
                </div>
                <p className="mt-4 rounded-lg border border-white/10 bg-slate-950/35 px-3 py-2 text-sm leading-6 text-slate-300">
                  {item.prompt}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-center shadow-premium sm:p-7">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-app-primary/30 bg-app-primary/10 text-blue-100">
          <FileText size={22} />
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Recent Blueprints</p>
        <h2 className="mt-4 text-xl font-semibold text-white">No blueprints yet.</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-app-muted">
          Your AI-generated event blueprints will appear here.
        </p>
      </section>
    </div>
  );
}

function ProcessingExperience({
  activeStep,
  onStepComplete,
}: {
  activeStep: number;
  onStepComplete: () => void;
}) {
  return (
    <section className="relative flex min-h-[calc(100vh-9rem)] items-center justify-center overflow-hidden rounded-xl border border-app-primary/25 bg-slate-950/72 p-4 shadow-premium sm:p-6 lg:p-8">
      <style>
        {`
          @keyframes eventosAiProcessingStep {
            0% { opacity: 0; transform: translateY(10px) scale(0.98); }
            55% { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}
      </style>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-primary/70 to-transparent" />
      <div className="pointer-events-none absolute -left-16 top-20 h-56 w-56 rounded-full bg-app-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-16 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />

      <div className="relative w-full max-w-4xl">
        <div className="text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-app-primary/30 bg-app-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-blue-100">
            <Sparkles size={14} />
            EventOS AI
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
            Preparing your event blueprint...
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-app-muted sm:text-base">
            EventOS AI is arranging the plan into a blueprint preview. This is a UI-only planning experience; no AI service or database action is running.
          </p>
        </div>

        <div className="mt-8 grid gap-3">
          {processingSteps.map((step, index) => {
            const isComplete = index < activeStep;
            const isActive = index === activeStep;
            return (
              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                  isComplete
                    ? "border-app-success/35 bg-app-success/10 text-green-100"
                    : isActive
                      ? "border-app-primary/45 bg-app-primary/12 text-white shadow-glow"
                      : "border-white/10 bg-white/[0.035] text-slate-400"
                }`}
                key={step}
                onAnimationEnd={isActive ? onStepComplete : undefined}
                style={isActive ? { animation: "eventosAiProcessingStep 520ms ease-out forwards" } : undefined}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-current/30">
                  {isComplete || isActive ? <CheckCircle2 size={17} /> : index + 1}
                </span>
                <span className="text-sm font-medium sm:text-base">{step}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BlueprintPreview({
  answers,
  command,
  onBack,
}: {
  answers: ClarificationAnswers;
  command: string;
  onBack: () => void;
}) {
  const eventName = answers.eventName || "AI Event Blueprint";
  const city = answers.city || "Selected city";
  const eventType = answers.eventType || "Event";
  const capacity = formatCapacityAnswer(answers.capacity) || "Audience size pending";
  const budget = formatMoneyAnswer(answers.budget) || "Budget pending";
  const revenueTarget = formatMoneyAnswer(answers.revenueTarget) || "Revenue target pending";
  const eventDate = formatDateAnswer(answers.eventDate) || "Date pending";

  const sections = [
    {
      icon: FileText,
      items: [
        ["Event", eventName],
        ["Type", eventType],
        ["City", city],
        ["Date", eventDate],
        ["Capacity", capacity],
      ],
      summary: "A professional event structure based on the clarified command.",
      title: "Event Summary",
    },
    {
      icon: WalletCards,
      items: [
        ["Working Budget", budget],
        ["Expense Focus", "Venue, production, talent, marketing, and operating buffer"],
        ["Control Point", "Keep high-cost commitments visible before approval"],
      ],
      summary: "Budget planning placeholders are ready for the Sprint 2 generator.",
      title: "Budget",
    },
    {
      icon: TrendingUp,
      items: [
        ["Revenue Target", revenueTarget],
        ["Primary Driver", "Ticket revenue plus sponsor support"],
        ["Planning Signal", "Track break-even and profit exposure"],
      ],
      summary: "Revenue strategy will become model-generated after AI activation.",
      title: "Revenue",
    },
    {
      icon: Timer,
      items: [
        ["Phase 1", "Blueprint review and approval"],
        ["Phase 2", "Tickets, sponsor, and vendor preparation"],
        ["Phase 3", "Final readiness and show-day execution"],
      ],
      summary: "Timeline placeholders mirror the approved V2 blueprint flow.",
      title: "Timeline",
    },
    {
      icon: Users,
      items: [
        ["Sponsor Priority", answers.sponsorPriority || "Priority pending"],
        ["Suggested Focus", "Local premium brands, lifestyle, automobile, education"],
        ["Next Step", "Prepare sponsor strategy for approval"],
      ],
      summary: "Sponsor strategy remains preview-only in this sprint.",
      title: "Sponsors",
    },
    {
      icon: Megaphone,
      items: [
        ["Audience", answers.targetAudience || "Target audience pending"],
        ["Campaign Focus", "Announcement, early interest, conversion, final push"],
        ["Branding Goal", answers.brandingGoal || "Branding goal pending"],
      ],
      summary: "Marketing cards prepare the structure without sending messages.",
      title: "Marketing",
    },
    {
      icon: ShieldAlert,
      items: [
        ["Risk Watch", "Revenue gap, sponsor shortfall, timeline delay"],
        ["Mitigation", "Keep approvals and execution steps separated"],
        ["Confidence", "Preview only until Sprint 2 AI generation"],
      ],
      summary: "Risk planning stays advisory and non-executing.",
      title: "Risks",
    },
    {
      icon: Ticket,
      items: [
        ["Task Group 1", "Confirm core event details"],
        ["Task Group 2", "Draft ticket and sponsor plan"],
        ["Task Group 3", "Prepare approval-ready execution checklist"],
      ],
      summary: "Task checklist previews the execution shape without creating records.",
      title: "Task Checklist",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-xl border border-app-primary/25 bg-slate-950/70 p-4 shadow-premium sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-primary/70 to-transparent" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-app-primary/30 bg-app-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-blue-100">
              <Sparkles size={14} />
              Blueprint Preview
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
              {eventName}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-app-muted sm:text-base">
              A premium preview generated from your command and clarification answers. AI Generation available in Sprint 2.
            </p>
            <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
              {command.trim()}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <span className="inline-flex min-h-10 items-center justify-center rounded-full border border-app-warning/30 bg-app-warning/10 px-4 text-sm font-medium text-amber-100">
              AI Generation available in Sprint 2
            </span>
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07]"
              onClick={onBack}
              type="button"
            >
              Back to Command Center
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <BlueprintSectionCard key={section.title} section={section} />
        ))}
      </section>
    </div>
  );
}

function BlueprintSectionCard({
  section,
}: {
  section: {
    icon: typeof FileText;
    items: string[][];
    summary: string;
    title: string;
  };
}) {
  const Icon = section.icon;

  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-premium backdrop-blur-xl sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-app-primary/30 bg-app-primary/10 text-blue-100">
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">{section.title}</h2>
          <p className="mt-1 text-sm leading-6 text-app-muted">{section.summary}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {section.items.map(([label, value]) => (
          <div className="rounded-lg border border-white/10 bg-slate-950/35 px-3 py-3" key={`${section.title}-${label}`}>
            <p className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</p>
            <p className="mt-1 break-words text-sm font-medium text-white">{value}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function ClarificationPanel({
  answers,
  blueprintMessage,
  command,
  currentStep,
  onBack,
  onCancel,
  onContinue,
  onNext,
  onUpdate,
  validationMessage,
}: {
  answers: ClarificationAnswers;
  blueprintMessage: string;
  command: string;
  currentStep: number;
  onBack: () => void;
  onCancel: () => void;
  onContinue: () => void;
  onNext: () => void;
  onUpdate: (field: keyof ClarificationAnswers, value: string) => void;
  validationMessage: string;
}) {
  const isReviewStep = currentStep === clarificationSteps.length - 1;

  return (
    <section className="rounded-xl border border-app-primary/25 bg-slate-950/62 p-4 shadow-premium sm:p-5 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Clarification Engine UI</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{clarificationSteps[currentStep]}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
            EventOS AI is collecting the missing context before a blueprint can be generated. No AI, database, or execution logic runs in this sprint.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-slate-200 transition hover:border-app-danger/35 hover:bg-app-danger/10 hover:text-red-100"
          onClick={onCancel}
          type="button"
        >
          <X size={16} />
          Cancel
        </button>
      </div>

      <StepProgress currentStep={currentStep} />

      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-4 rounded-lg border border-app-primary/25 bg-app-primary/10 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.12em] text-blue-100">Original command</p>
          <p className="mt-1 break-words text-sm leading-6 text-white">{command.trim() || "No command provided."}</p>
        </div>

        {currentStep === 0 && <EventBasicsStep answers={answers} onUpdate={onUpdate} />}
        {currentStep === 1 && <AudienceBudgetStep answers={answers} onUpdate={onUpdate} />}
        {currentStep === 2 && <BusinessGoalsStep answers={answers} onUpdate={onUpdate} />}
        {isReviewStep && <ReviewStep answers={answers} />}

        {validationMessage && (
          <p className="mt-4 rounded-lg border border-app-warning/30 bg-app-warning/10 px-3 py-2 text-sm text-amber-100">
            {validationMessage}
          </p>
        )}

        {blueprintMessage && (
          <p className="mt-4 rounded-lg border border-app-success/30 bg-app-success/10 px-3 py-2 text-sm text-green-100">
            {blueprintMessage}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentStep === 0}
            onClick={onBack}
            type="button"
          >
            Back
          </button>
          {isReviewStep ? (
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-semibold text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45"
              onClick={onContinue}
              type="button"
            >
              Continue to Blueprint
              <ArrowRight size={17} />
            </button>
          ) : (
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-semibold text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45"
              onClick={onNext}
              type="button"
            >
              Next
              <ArrowRight size={17} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function StepProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-4">
      {clarificationSteps.map((step, index) => {
        const isComplete = index < currentStep;
        const isActive = index === currentStep;
        return (
          <div
            className={`rounded-lg border px-3 py-3 ${
              isActive
                ? "border-app-primary/45 bg-app-primary/12 text-white"
                : isComplete
                  ? "border-app-success/35 bg-app-success/10 text-green-100"
                  : "border-white/10 bg-white/[0.035] text-slate-300"
            }`}
            key={step}
          >
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-current/30 text-xs font-semibold">
                {isComplete ? <CheckCircle2 size={14} /> : index + 1}
              </span>
              <span className="text-sm font-medium">{step}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventBasicsStep({
  answers,
  onUpdate,
}: {
  answers: ClarificationAnswers;
  onUpdate: (field: keyof ClarificationAnswers, value: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ClarificationField label="Event Name" onChange={(value) => onUpdate("eventName", value)} required value={answers.eventName} />
      <ClarificationField label="Event Type" onChange={(value) => onUpdate("eventType", value)} placeholder="Comedy Show, Wedding, Concert..." required value={answers.eventType} />
      <ClarificationField label="City" onChange={(value) => onUpdate("city", value)} required value={answers.city} />
      <ClarificationField icon={<CalendarDays size={16} />} label="Event Date" onChange={(value) => onUpdate("eventDate", value)} required type="date" value={answers.eventDate} />
    </div>
  );
}

function AudienceBudgetStep({
  answers,
  onUpdate,
}: {
  answers: ClarificationAnswers;
  onUpdate: (field: keyof ClarificationAnswers, value: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ClarificationField inputMode="numeric" label="Capacity" onChange={(value) => onUpdate("capacity", value)} placeholder="1500" required value={answers.capacity} formatValue={formatCapacityAnswer} />
      <ClarificationField inputMode="numeric" label="Budget" onChange={(value) => onUpdate("budget", value)} placeholder="2000000" required value={answers.budget} formatValue={formatMoneyAnswer} />
      <ClarificationField inputMode="numeric" label="Revenue Target" onChange={(value) => onUpdate("revenueTarget", value)} placeholder="5000000" required value={answers.revenueTarget} formatValue={formatMoneyAnswer} />
      <ClarificationField label="Target Audience" onChange={(value) => onUpdate("targetAudience", value)} placeholder="Families, corporate leaders, college students..." required value={answers.targetAudience} />
    </div>
  );
}

function BusinessGoalsStep({
  answers,
  onUpdate,
}: {
  answers: ClarificationAnswers;
  onUpdate: (field: keyof ClarificationAnswers, value: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ClarificationField label="Sponsor Priority" onChange={(value) => onUpdate("sponsorPriority", value)} placeholder="High, medium, low..." required value={answers.sponsorPriority} />
      <ClarificationField label="Ticket Sales Goal" onChange={(value) => onUpdate("ticketSalesGoal", value)} placeholder="Sell out, premium conversion, early bird..." required value={answers.ticketSalesGoal} />
      <ClarificationField label="Profit Goal" onChange={(value) => onUpdate("profitGoal", value)} placeholder="Target profit or margin" required value={answers.profitGoal} />
      <ClarificationField label="Branding Goal" onChange={(value) => onUpdate("brandingGoal", value)} placeholder="Premium positioning, awareness, community..." required value={answers.brandingGoal} />
      <label className="block md:col-span-2">
        <span className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-app-muted">Notes</span>
        <textarea
          className="mt-2 min-h-28 w-full resize-y rounded-lg border border-white/10 bg-slate-950/45 p-3 text-sm leading-6 text-white outline-none transition placeholder:text-app-muted focus:border-app-primary/70 focus:ring-2 focus:ring-app-primary/25"
          onChange={(event) => onUpdate("notes", event.target.value)}
          placeholder="Optional planning notes, constraints, or preferences..."
          value={answers.notes}
        />
      </label>
    </div>
  );
}

function ReviewStep({ answers }: { answers: ClarificationAnswers }) {
  const sections = [
    {
      rows: [
        ["Event Name", answers.eventName],
        ["Event Type", answers.eventType],
        ["City", answers.city],
        ["Event Date", formatDateAnswer(answers.eventDate)],
      ],
      title: "Event Summary",
    },
    {
      rows: [
        ["Capacity", formatCapacityAnswer(answers.capacity)],
        ["Budget", formatMoneyAnswer(answers.budget)],
        ["Revenue Target", formatMoneyAnswer(answers.revenueTarget)],
        ["Target Audience", answers.targetAudience],
      ],
      title: "Audience & Budget",
    },
    {
      rows: [
        ["Sponsor Priority", answers.sponsorPriority],
        ["Ticket Sales Goal", answers.ticketSalesGoal],
        ["Profit Goal", answers.profitGoal],
        ["Branding Goal", answers.brandingGoal],
      ],
      title: "Business Goals",
    },
    {
      rows: [["Notes", answers.notes || "No extra notes"]],
      title: "Notes",
    },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-primary">Collected answers</p>
      <div className="mt-4 grid gap-4">
        {sections.map((section) => (
          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-3" key={section.title}>
            <h3 className="text-sm font-semibold text-white">{section.title}</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {section.rows.map(([label, value]) => (
                <div className="rounded-lg border border-white/10 bg-slate-950/35 px-3 py-3" key={`${section.title}-${label}`}>
                  <p className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</p>
                  <p className="mt-1 break-words text-sm font-medium text-white">{value}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function formatMoneyAnswer(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replace(/^rs\.?\s*/i, "").replace(/^inr\s*/i, "").trim();
  const numericValue = Number(normalized.replace(/[₹,\s]/g, ""));
  if (Number.isFinite(numericValue) && normalized.replace(/[₹,\s]/g, "") !== "") {
    return `₹${numericValue.toLocaleString("en-IN")}`;
  }

  return trimmed.startsWith("₹") ? trimmed : `₹${normalized}`;
}

function formatDateAnswer(value: string) {
  if (!value.trim()) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatCapacityAnswer(value: string) {
  const capacity = Number(value);
  return Number.isFinite(capacity) && capacity > 0 ? capacity.toLocaleString("en-IN") : value;
}

function ClarificationField({
  formatValue,
  icon,
  inputMode,
  label,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  formatValue?: (value: string) => string;
  icon?: ReactNode;
  inputMode?: "decimal" | "email" | "numeric" | "search" | "tel" | "text" | "url";
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "date" | "number" | "text";
  value: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const displayValue = formatValue && !isFocused ? formatValue(value) : value;

  return (
    <label className="block">
      <span className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-app-muted">
        {icon}
        {label}
        {required && <span className="text-app-warning">*</span>}
      </span>
      <input
        className="dashboard-input mt-2 h-11 w-full"
        inputMode={inputMode}
        min={type === "number" && !formatValue ? "0" : undefined}
        onBlur={() => setIsFocused(false)}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setIsFocused(true)}
        placeholder={placeholder}
        type={formatValue ? "text" : type}
        value={displayValue}
      />
    </label>
  );
}

function validateStep(step: number, answers: ClarificationAnswers) {
  const requiredByStep: Record<number, Array<keyof ClarificationAnswers>> = {
    0: ["eventName", "eventType", "city", "eventDate"],
    1: ["capacity", "budget", "revenueTarget", "targetAudience"],
    2: ["sponsorPriority", "ticketSalesGoal", "profitGoal", "brandingGoal"],
    3: [
      "eventName",
      "eventType",
      "city",
      "eventDate",
      "capacity",
      "budget",
      "revenueTarget",
      "targetAudience",
      "sponsorPriority",
      "ticketSalesGoal",
      "profitGoal",
      "brandingGoal",
    ],
  };

  const missingField = requiredByStep[step].find((field) => !answers[field].trim());
  if (missingField) {
    return {
      isValid: false,
      message: `${getFieldLabel(missingField)} is required before continuing.`,
    };
  }

  const capacity = Number(answers.capacity);
  if ((step === 1 || step === 3) && (!Number.isFinite(capacity) || capacity <= 0)) {
    return {
      isValid: false,
      message: "Capacity must be greater than 0.",
    };
  }

  return {
    isValid: true,
    message: "",
  };
}

function getFieldLabel(field: keyof ClarificationAnswers) {
  const labels: Record<keyof ClarificationAnswers, string> = {
    brandingGoal: "Branding Goal",
    budget: "Budget",
    capacity: "Capacity",
    city: "City",
    eventDate: "Event Date",
    eventName: "Event Name",
    eventType: "Event Type",
    notes: "Notes",
    profitGoal: "Profit Goal",
    revenueTarget: "Revenue Target",
    sponsorPriority: "Sponsor Priority",
    targetAudience: "Target Audience",
    ticketSalesGoal: "Ticket Sales Goal",
  };

  return labels[field];
}

function SnapshotCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/35 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.12em] text-app-muted">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

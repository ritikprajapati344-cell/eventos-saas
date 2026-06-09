import type { FormEvent } from "react";
import { useState } from "react";
import {
  ArrowRight,
  CalendarCheck2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Ticket,
  WalletCards,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { error: authError, isLoading, signIn } = useAuth();
  const [email, setEmail] = useState(import.meta.env.DEV ? "admin@eventos.com" : "");
  const [formError, setFormError] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (!email.trim()) {
      setFormError("Email address is required.");
      return;
    }
    if (!password) {
      setFormError("Password is required.");
      return;
    }

    try {
      await signIn(email, password);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  const visibleError = formError || authError;

  return (
    <main className="relative min-h-screen overflow-hidden bg-app-bg">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_8%,rgba(59,130,246,0.18),transparent_30rem),linear-gradient(135deg,#0f172a_0%,#111827_48%,#172033_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-primary/70 to-transparent" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1480px] items-center gap-8 px-4 py-8 sm:px-7 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:px-10 xl:px-16">
        <section className="hidden min-w-0 lg:block">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-app-primary text-white shadow-glow">
              <Ticket size={24} />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">EventOS</p>
              <p className="text-xs uppercase tracking-[0.16em] text-app-muted">Event Management OS</p>
            </div>
          </div>

          <div className="mt-14 max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-blue-300">Operations command center</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight text-white xl:text-5xl">
              Run every event from one focused workspace.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Coordinate sales, production, artists, vendors, sponsors, and finance without losing the operational thread.
            </p>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
            <Capability icon={CalendarCheck2} label="Event operations" value="Plan to close" />
            <Capability icon={WalletCards} label="Financial control" value="Revenue to profit" />
            <Capability icon={ShieldCheck} label="Private workspace" value="Secure access" />
          </div>

          <div className="mt-8 max-w-2xl rounded-lg border border-app-primary/25 bg-slate-950/45 p-5 shadow-premium backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Workspace access</p>
                <p className="mt-1 text-sm text-app-muted">Your EventOS data remains scoped to your authenticated workspace.</p>
              </div>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-app-success/30 bg-app-success/10 text-green-300">
                <ShieldCheck size={19} />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto min-w-0 w-full max-w-md animate-fade-up">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-app-primary text-white shadow-glow">
              <Ticket size={22} />
            </div>
            <div>
              <p className="text-xl font-semibold text-white">EventOS</p>
              <p className="text-xs uppercase tracking-[0.14em] text-app-muted">Event Management OS</p>
            </div>
          </div>

          <div className="glass-panel min-w-0 w-full overflow-hidden rounded-lg p-5 sm:p-7">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-blue-300">Secure sign in</p>
              <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-app-muted">Sign in to open your EventOS workspace.</p>
            </div>

            <form className="mt-7 space-y-5" onSubmit={submit}>
              <label className="block min-w-0">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-300">Email Address</span>
                <div className="relative mt-2 min-w-0">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" size={18} />
                  <input
                    autoComplete="email"
                    className="dashboard-input h-12 min-w-0 max-w-full !pl-10 !pr-3"
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setFormError("");
                    }}
                    placeholder="name@company.com"
                    type="email"
                    value={email}
                  />
                </div>
              </label>

              <label className="block min-w-0">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-300">Password</span>
                <div className="relative mt-2 min-w-0">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" size={18} />
                  <input
                    autoComplete="current-password"
                    className="dashboard-input h-12 min-w-0 max-w-full !pl-10 !pr-12"
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setFormError("");
                    }}
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-app-muted transition hover:bg-white/[0.06] hover:text-white"
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              {visibleError && (
                <p className="rounded-lg border border-app-danger/35 bg-app-danger/10 px-3 py-2.5 text-sm leading-5 text-red-200">
                  {visibleError}
                </p>
              )}

              <button
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-app-primary px-4 text-sm font-semibold text-white shadow-glow transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-app-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
                type="submit"
              >
                {isLoading ? "Opening workspace..." : "Sign In"}
                {!isLoading && <ArrowRight size={18} />}
              </button>
            </form>

            {import.meta.env.DEV && (
              <p className="mt-5 text-center text-xs leading-5 text-app-muted">
                Development account email is prefilled. Enter your Supabase user password to continue.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Capability({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarCheck2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-app-primary/20 bg-white/[0.04] p-4 shadow-premium backdrop-blur-xl">
      <Icon className="text-blue-300" size={19} />
      <p className="mt-4 text-xs uppercase tracking-[0.12em] text-app-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return "Unable to sign in. Please check your credentials and try again.";
}

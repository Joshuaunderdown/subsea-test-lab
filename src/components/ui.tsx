import type { ReactNode } from "react";
import type { AlarmLevel, NavStatus } from "@/lib/navigation";

export function Card({
  title,
  subtitle,
  children,
  id,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  id?: string;
  right?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-xl border border-navy-700 bg-navy-900/80 p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-300">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

const STATUS_TONE: Record<NavStatus, string> = {
  NOMINAL: "bg-pass/15 text-pass ring-pass/40",
  RECOVERING: "bg-warn/15 text-warn ring-warn/40",
  DEGRADED: "bg-fail/15 text-fail ring-fail/40",
  SENSOR_FAULT: "bg-fail/15 text-fail ring-fail/40",
  NO_DATA: "bg-warn/15 text-warn ring-warn/40",
  INVALID_INPUT: "bg-warn/15 text-warn ring-warn/40",
};

export const STATUS_COLOR: Record<NavStatus, string> = {
  NOMINAL: "#34d399",
  RECOVERING: "#fbbf24",
  DEGRADED: "#fb7185",
  SENSOR_FAULT: "#fb7185",
  NO_DATA: "#fbbf24",
  INVALID_INPUT: "#fbbf24",
};

export function StatusChip({ status }: { status: NavStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-xs font-semibold ring-1 ${STATUS_TONE[status]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {status.replace("_", " ")}
    </span>
  );
}

export function ResultChip({ status }: { status: "PASS" | "FAIL" | "WARNING" | "NOT RUN" }) {
  const tone =
    status === "PASS"
      ? "bg-pass/15 text-pass ring-pass/40"
      : status === "FAIL"
        ? "bg-fail/15 text-fail ring-fail/40"
        : status === "WARNING"
          ? "bg-warn/15 text-warn ring-warn/40"
          : "bg-slate-500/15 text-slate-300 ring-slate-500/40";
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✕" : status === "WARNING" ? "!" : "–";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-bold ring-1 ${tone}`}>
      <span aria-hidden>{icon}</span>
      {status}
    </span>
  );
}

export function AlarmChip({ alarm }: { alarm: AlarmLevel }) {
  const tone =
    alarm === "OK" ? "bg-pass/15 text-pass ring-pass/40" : alarm === "WARNING" ? "bg-warn/15 text-warn ring-warn/40" : "bg-fail/15 text-fail ring-fail/40";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-bold ring-1 ${tone}`}>
      <span aria-hidden>{alarm === "OK" ? "✓" : "!"}</span>
      {alarm}
    </span>
  );
}

type Tone = "primary" | "danger" | "neutral" | "ghost";
const BUTTON_TONE: Record<Tone, string> = {
  primary: "bg-accent text-navy-950 hover:bg-cyan-300 font-semibold",
  danger: "bg-fail/90 text-navy-950 hover:bg-fail font-semibold",
  neutral: "bg-navy-700 text-white hover:bg-navy-600 ring-1 ring-navy-600",
  ghost: "bg-transparent text-slate-200 hover:bg-navy-800 ring-1 ring-navy-600",
};

export function Button({
  children,
  onClick,
  tone = "neutral",
  active = false,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: Tone;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active || undefined}
      className={`min-h-11 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${BUTTON_TONE[tone]} ${active ? "ring-2 ring-accent" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

import type { SuiteResult } from "@/lib/testSuite";
import { ResultChip } from "./ui";

export interface SuiteRun {
  suite: SuiteResult;
  /** "live" = includes the current simulated reading; "clean" = fresh seed-42 environment. */
  context: "live" | "clean";
  step: number;
  runNumber: number;
}

export function SuiteSummary({ run, stale }: { run: SuiteRun | null; stale: boolean }) {
  if (!run) {
    return <p className="text-sm text-slate-300">Not run yet. Press <strong>Run Test Suite</strong> to execute TC-01 to TC-07.</p>;
  }
  const { suite } = run;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat label="Total" value={suite.total} />
        <Stat label="Passed" value={suite.passed} tone="text-pass" />
        <Stat label="Failed" value={suite.failed} tone={suite.failed ? "text-fail" : "text-slate-400"} />
        <div className="flex flex-col items-center justify-center rounded-lg bg-navy-950 p-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">Suite</span>
          <ResultChip status={suite.status} />
        </div>
      </div>
      <p className="font-mono text-xs text-slate-400">
        Run #{run.runNumber} · build v{suite.buildVersion}
        {suite.defectiveBuild && <span className="text-warn"> (defect injected)</span>} ·{" "}
        {run.context === "live" ? `live reading at step ${run.step}` : "clean environment (seed 42, no live fault)"}
        {stale && <span className="text-warn"> · system changed since this run, rerun to refresh</span>}
      </p>
      <div
        className={`rounded-lg border p-3 text-sm ${suite.failed ? "border-fail/40 bg-fail/10" : "border-pass/40 bg-pass/10"}`}
        role="status"
      >
        <p className="mb-1 font-semibold">{suite.failed ? `${suite.failed} issue${suite.failed > 1 ? "s" : ""} detected` : "No issues detected"}</p>
        <ul className="list-disc space-y-1 pl-5 text-slate-200">
          {suite.summary.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "text-white" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-navy-950 p-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`font-mono text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}

export function TestList({ run }: { run: SuiteRun | null }) {
  if (!run) return null;
  return (
    <ul className="space-y-2">
      {run.suite.results.map((r) => (
        <li key={`${run.runNumber}-${r.id}`}>
          <details
            open={r.status === "FAIL"}
            className={`group rounded-lg border bg-navy-950/60 ${r.status === "FAIL" ? "border-fail/50" : "border-navy-700"}`}
          >
            <summary className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
              <span className="font-mono text-xs text-accent">{r.id}</span>
              <span className="flex-1 text-sm font-medium">{r.title}</span>
              <ResultChip status={r.status} />
              <span className="text-slate-500 transition-transform group-open:rotate-90" aria-hidden>›</span>
            </summary>
            <dl className="grid gap-x-3 gap-y-1.5 border-t border-navy-700 px-3 py-3 text-sm sm:grid-cols-[7rem_1fr]">
              <dt className="text-slate-400">Description</dt>
              <dd>{r.description}</dd>
              <dt className="text-slate-400">Expected</dt>
              <dd>{r.expected}</dd>
              <dt className="text-slate-400">Actual</dt>
              <dd className="break-words font-mono text-xs leading-relaxed">{r.actual}</dd>
              <dt className="text-slate-400">{r.status === "FAIL" ? "Why it failed" : "Result"}</dt>
              <dd className={r.status === "FAIL" ? "text-fail" : "text-slate-200"}>{r.explanation}</dd>
              <dt className="text-slate-400">Requirements</dt>
              <dd className="font-mono text-xs">{r.requirements.join(", ")}</dd>
            </dl>
          </details>
        </li>
      ))}
    </ul>
  );
}

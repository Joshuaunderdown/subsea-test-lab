import { BASELINE_BUILD, DEFECTIVE_BUILD, type ProcessorBuild } from "@/lib/build";
import type { SuiteResult } from "@/lib/testSuite";
import { Button, ResultChip } from "./ui";

export interface RegressionRun {
  label: string;
  suite: SuiteResult;
}

interface Step {
  title: string;
  detail: string;
  kind: "run" | "build";
  build?: ProcessorBuild;
}

export const REGRESSION_STEPS: Step[] = [
  { title: "Run baseline tests", detail: `Build v${BASELINE_BUILD.version}: establish the known-good reference.`, kind: "run" },
  { title: "Introduce defect", detail: `Deploy v${DEFECTIVE_BUILD.version}. A "refactor" of positionError() drops the y term: error = |dx|.`, kind: "build", build: DEFECTIVE_BUILD },
  { title: "Rerun tests", detail: "Same tests, same seed, new build. Look for tests that change outcome.", kind: "run" },
  { title: "Remove defect", detail: "Fix restores the Euclidean distance √(dx² + dy²).", kind: "build", build: BASELINE_BUILD },
  { title: "Rerun & confirm recovery", detail: "All previously passing tests must pass again.", kind: "run" },
];

export function RegressionDemo({
  stepIndex,
  runs,
  onAdvance,
  onRestart,
  activeBuild,
}: {
  stepIndex: number;
  runs: RegressionRun[];
  onAdvance: () => void;
  onRestart: () => void;
  activeBuild: ProcessorBuild;
}) {
  const done = stepIndex >= REGRESSION_STEPS.length;
  const next = REGRESSION_STEPS[stepIndex];
  const baseline = runs[0];
  const newlyFailing = (r: RegressionRun) =>
    r.suite.results
      .filter((t) => t.status === "FAIL" && baseline?.suite.results.find((b) => b.id === t.id)?.status === "PASS")
      .map((t) => t.id);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-300">
        Regression testing reruns previously passing tests after a change, to catch unintended breakage in functionality that
        used to work. Runs here use a clean environment (seed 42, no live fault), so only the code change can explain a
        different result.
      </p>

      <ol className="space-y-2">
        {REGRESSION_STEPS.map((s, i) => {
          const state = i < stepIndex ? "done" : i === stepIndex ? "current" : "todo";
          return (
            <li
              key={s.title}
              className={`flex gap-3 rounded-lg border p-3 ${
                state === "current" ? "border-accent bg-accent/10" : state === "done" ? "border-navy-700 bg-navy-950/60" : "border-navy-800 opacity-60"
              }`}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
                  state === "done" ? "bg-pass text-navy-950" : state === "current" ? "bg-accent text-navy-950" : "bg-navy-700 text-slate-300"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-xs text-slate-300">{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        {!done ? (
          <Button tone="primary" onClick={onAdvance} className="flex-1">
            Step {stepIndex + 1}: {next.title}
          </Button>
        ) : (
          <p className="flex-1 self-center text-sm text-pass">Regression demo complete: defect detected, fixed and verified.</p>
        )}
        <Button tone="ghost" onClick={onRestart} disabled={stepIndex === 0}>
          Restart demo
        </Button>
      </div>

      <p className="font-mono text-xs text-slate-400">
        Active build: v{activeBuild.version}
        {activeBuild.defect ? <span className="text-warn"> (defect injected)</span> : " (verified)"}
      </p>

      {runs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Run history</h3>
          {runs.map((r, i) => {
            const nf = i === 0 ? [] : newlyFailing(r);
            return (
              <div key={i} className="rounded-lg border border-navy-700 bg-navy-950/60 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {r.label} <span className="font-mono text-xs text-slate-400">v{r.suite.buildVersion}</span>
                  </span>
                  <span className="flex items-center gap-2 font-mono text-xs">
                    {r.suite.passed}/{r.suite.total} pass <ResultChip status={r.suite.status} />
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.suite.results.map((t) => (
                    <span
                      key={t.id}
                      className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${t.status === "PASS" ? "bg-pass/15 text-pass" : "bg-fail/20 text-fail"}`}
                    >
                      {t.id}
                    </span>
                  ))}
                </div>
                {nf.length > 0 && (
                  <p className="mt-2 text-xs text-fail">
                    Regression: {nf.join(", ")} passed on the baseline and now fail.
                  </p>
                )}
                {i > 0 && nf.length === 0 && r.suite.status === "PASS" && (
                  <p className="mt-2 text-xs text-pass">No regressions: matches the baseline run.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-navy-700 bg-navy-950/60 p-3 text-sm text-slate-200">
        <p className="mb-1 font-semibold text-white">Which tests catch the defect, and why</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><span className="font-mono text-accent">TC-04</span> boundary values: (0, 5.01) is truly 5.01 m off, but |dx| = 0, so it is wrongly passed as NOMINAL.</li>
          <li><span className="font-mono text-accent">TC-06</span> golden baseline: every recorded error changes, and the excessive-error steps no longer raise DEGRADED.</li>
          <li><span className="font-mono text-accent">TC-07</span> recovery: the northward excessive-error fault is never detected, so the recovery sequence never starts.</li>
          <li>TC-02, TC-03 and TC-05 still pass: missing data, invalid input and sensor-health checks don&apos;t use the error calculation, which helps localise the fault.</li>
        </ul>
        <p className="mt-2 text-xs text-slate-400">
          Try it live: with the defect active, press <strong>Excessive Error</strong>. The vehicle drifts &gt;8 m north but the system
          still reports a trusted NOMINAL fix. TC-01&apos;s independent oracle flags it.
        </p>
      </div>
    </div>
  );
}

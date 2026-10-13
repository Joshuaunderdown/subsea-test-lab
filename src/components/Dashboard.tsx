"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BASELINE_BUILD, type ProcessorBuild } from "@/lib/build";
import type { Point } from "@/lib/geometry";
import { NavigationMonitor, POSITION_TOLERANCE_M, RECOVERY_READINGS_REQUIRED } from "@/lib/navigation";
import { FAULT_LABELS, type FaultType, generateSample } from "@/lib/simulation";
import { type LiveContext, runTestSuite } from "@/lib/testSuite";
import { ErrorScope, TrackPlot, type TrailPoint } from "./NavPlot";
import { REGRESSION_STEPS, RegressionDemo, type RegressionRun } from "./RegressionDemo";
import { SuiteSummary, type SuiteRun, TestList } from "./TestResults";
import { TraceabilityTable } from "./Traceability";
import { AlarmChip, Button, Card, StatusChip } from "./ui";

/**
 * Mutable simulation engine. Lives outside React state because the
 * NavigationMonitor is stateful; React state holds immutable snapshots.
 */
interface Engine {
  step: number;
  fault: FaultType;
  faultAge: number;
  build: ProcessorBuild;
  monitor: NavigationMonitor;
}

interface View {
  build: ProcessorBuild;
  fault: FaultType;
  live: LiveContext | null;
  trail: TrailPoint[];
  suiteRun: SuiteRun | null;
  /** Bumped whenever the system changes, to flag stale suite results. */
  revision: number;
  suiteRevision: number;
}

const TRAIL_LENGTH = 60;
const WARM_UP_STEPS = 12;

function newEngine(build: ProcessorBuild): Engine {
  return { step: 0, fault: "none", faultAge: 0, build, monitor: new NavigationMonitor(build) };
}

/** Processes `n` simulation steps and returns the latest live context plus the new trail. */
function advance(engine: Engine, trail: TrailPoint[], n = 1): { live: LiveContext; trail: TrailPoint[] } {
  let live: LiveContext | null = null;
  const next = [...trail];
  for (let i = 0; i < n; i++) {
    const sample = generateSample(engine.step, engine.fault, engine.faultAge);
    const output = engine.monitor.process(sample.expected, sample.reading);
    live = { sample, output };
    next.push({
      step: sample.step,
      expected: sample.expected,
      measured: sample.reading?.position ?? null,
      status: output.status,
    });
    engine.step += 1;
    if (engine.fault !== "none") engine.faultAge += 1;
  }
  return { live: live!, trail: next.slice(-TRAIL_LENGTH) };
}

function initial(build: ProcessorBuild): { engine: Engine; view: View } {
  const engine = newEngine(build);
  const { live, trail } = advance(engine, [], WARM_UP_STEPS);
  return {
    engine,
    view: { build, fault: "none", live, trail, suiteRun: null, revision: 0, suiteRevision: -1 },
  };
}

const fmtPoint = (p: Point | null | undefined) => (p ? `${p.x.toFixed(1)}, ${p.y.toFixed(1)}` : "–");

export default function Dashboard() {
  const [init] = useState(() => initial(BASELINE_BUILD));
  const [engine, setEngine] = useState(init.engine);
  const [view, setView] = useState(init.view);
  const [playing, setPlaying] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const [regStep, setRegStep] = useState(0);
  const [regRuns, setRegRuns] = useState<RegressionRun[]>([]);

  const runSuite = useCallback(
    (live: LiveContext | null, context: SuiteRun["context"], build: ProcessorBuild, revision: number) => {
      const suite = runTestSuite({ build, live });
      setRunCount((c) => c + 1);
      const run: SuiteRun = { suite, context, step: live?.sample.step ?? 0, runNumber: runCount + 1 };
      setView((v) => ({ ...v, suiteRun: run, suiteRevision: revision }));
      return suite;
    },
    [runCount],
  );

  /** Advance the simulation; optionally change the fault first and rerun the suite after. */
  const stepSim = useCallback(
    (opts: { steps?: number; fault?: FaultType; rerun?: boolean } = {}) => {
      if (opts.fault !== undefined) {
        engine.fault = opts.fault;
        engine.faultAge = 0;
      }
      const { live, trail } = advance(engine, view.trail, opts.steps ?? 1);
      const revision = view.revision + 1;
      setView((v) => ({ ...v, live, trail, fault: engine.fault, revision }));
      if (opts.rerun) runSuite(live, "live", engine.build, revision);
    },
    [engine, view.trail, view.revision, runSuite],
  );

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => stepSim(), 700);
    return () => clearInterval(id);
  }, [playing, stepSim]);

  const injectFault = (fault: FaultType) => {
    setPlaying(false);
    stepSim({ fault, rerun: true });
  };

  // Clearing processes the 3 good readings recovery needs, so the result is visible straight away.
  const clearFault = () => {
    setPlaying(false);
    stepSim({ fault: "none", steps: RECOVERY_READINGS_REQUIRED, rerun: true });
  };

  const resetSim = () => {
    setPlaying(false);
    const fresh = initial(engine.build);
    setEngine(fresh.engine);
    setView({ ...fresh.view, revision: view.revision + 1 });
  };

  const setBuild = (build: ProcessorBuild) => {
    engine.build = build;
    engine.monitor.setBuild(build);
    setView((v) => ({ ...v, build, revision: v.revision + 1 }));
  };

  const advanceRegression = () => {
    const step = REGRESSION_STEPS[regStep];
    if (!step) return;
    if (step.kind === "build" && step.build) {
      setBuild(step.build);
    } else {
      // Regression runs use a clean environment: no live fault, fixed seed.
      const suite = runSuite(null, "clean", engine.build, view.revision);
      setRegRuns((r) => [...r, { label: step.title, suite }]);
    }
    setRegStep((s) => s + 1);
  };

  const restartRegression = () => {
    setRegStep(0);
    setRegRuns([]);
    if (engine.build !== BASELINE_BUILD) setBuild(BASELINE_BUILD);
  };

  const out = view.live?.output;
  const reading = view.live?.sample.reading;
  const current = view.trail[view.trail.length - 1] ?? null;
  const suite = view.suiteRun?.suite;
  const stale = !!view.suiteRun && view.suiteRevision !== view.revision;

  return (
    <div className="pb-12">
      {/* Sticky status bar */}
      <div className="sticky top-0 z-20 border-b border-navy-700 bg-navy-950/95 backdrop-blur" style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2">
          <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-accent">SIMULATED</span>
          {out && <StatusChip status={out.status} />}
          <span className="font-mono text-xs text-slate-300">
            err {out?.positionError != null ? `${out.positionError.toFixed(2)} m` : "–"}
          </span>
          <span className={`font-mono text-xs ${view.build.defect ? "text-warn" : "text-slate-400"}`}>v{view.build.version}</span>
          <span className="ml-auto flex items-center gap-2 font-mono text-xs">
            {suite ? (
              <>
                <span className="text-pass">{suite.passed}✓</span>
                <span className={suite.failed ? "text-fail" : "text-slate-500"}>{suite.failed}✕</span>
              </>
            ) : (
              <span className="text-slate-400">tests not run</span>
            )}
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-4 px-4 pt-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Subsea <span className="text-accent">Test Lab</span>
          </h1>
          <p className="text-sm text-slate-300">
            A simulated underwater navigation processor with a live automated test suite. Inject faults, introduce a code
            defect and watch the tests catch it. All data is simulated.{" "}
            <Link href="/info" className="text-accent underline underline-offset-2">Project info &amp; QR</Link>
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          {/* Controls + live status */}
          <Card title="System status" subtitle="Current sensor reading and monitor decision (simulated).">
            <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Readout label="Status">{out && <StatusChip status={out.status} />}</Readout>
              <Readout label="Alarm">{out && <AlarmChip alarm={out.alarm} />}</Readout>
              <Readout label="Sensor">
                <span className={reading ? (reading.health === "OK" ? "text-pass" : "text-fail") : "text-warn"}>
                  {reading ? reading.health : "NO SIGNAL"}
                </span>
              </Readout>
              <Readout label="Trusted fix">
                <span className={out?.trusted ? "text-pass" : "text-fail"}>{out?.trusted ? "YES" : "NO"}</span>
              </Readout>
              <Readout label="Expected (m)">{fmtPoint(view.live?.sample.expected)}</Readout>
              <Readout label="Measured (m)">{fmtPoint(reading?.position)}</Readout>
              <Readout label="Position error">
                <span className={out?.positionError != null && out.positionError > POSITION_TOLERANCE_M ? "text-fail" : ""}>
                  {out?.positionError != null ? `${out.positionError.toFixed(2)} m` : "–"}
                </span>{" "}
                <span className="text-slate-500">/ {POSITION_TOLERANCE_M.toFixed(1)}</span>
              </Readout>
              <Readout label="Last good fix">{fmtPoint(out?.lastKnownGood)}</Readout>
              <Readout label="Active fault">
                <span className={view.fault === "none" ? "text-slate-300" : "text-fail"}>{FAULT_LABELS[view.fault]}</span>
              </Readout>
              <Readout label="Step">{view.live?.sample.step ?? 0}</Readout>
            </dl>
            <p className="mb-4 rounded-md bg-navy-950 px-3 py-2 font-mono text-xs text-slate-300" aria-live="polite">
              {out?.message}
            </p>

            <Button tone="primary" className="mb-4 w-full text-base" onClick={() => runSuite(view.live, "live", engine.build, view.revision)}>
              ▶ Run Test Suite
            </Button>

            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Fault injection</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button tone="danger" className="col-span-2" active={view.fault === "sensor_failure"} onClick={() => injectFault("sensor_failure")}>
                ⚠ Inject Sensor Fault
              </Button>
              <Button active={view.fault === "missing_data"} onClick={() => injectFault("missing_data")}>
                Missing Readings
              </Button>
              <Button active={view.fault === "excessive_error"} onClick={() => injectFault("excessive_error")}>
                Excessive Error
              </Button>
              <Button tone="ghost" onClick={clearFault} disabled={view.fault === "none"}>
                Clear Fault
              </Button>
              <Button tone="ghost" onClick={resetSim}>
                Reset Simulation
              </Button>
            </div>
          </Card>

          <Card
            title="Navigation simulator"
            subtitle="Planned track (dashed), measured fixes coloured by status. North up."
            right={
              <div className="flex gap-2">
                <Button tone="ghost" onClick={() => stepSim()} className="px-3">Step</Button>
                <Button tone={playing ? "neutral" : "ghost"} active={playing} onClick={() => setPlaying((p) => !p)} className="w-20">
                  {playing ? "Pause" : "Run"}
                </Button>
              </div>
            }
          >
            <TrackPlot trail={view.trail} current={current} />
            <div className="mt-3 grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3">
              <ErrorScope current={current} />
              <div className="space-y-1.5 text-xs text-slate-300">
                <p className="font-semibold text-white">Error scope</p>
                <p>Centred on the planned position. The dashed cyan circle is the {POSITION_TOLERANCE_M} m tolerance.</p>
                <Legend color="#34d399" label="Nominal" />
                <Legend color="#fbbf24" label="Recovering / no data" />
                <Legend color="#fb7185" label="Degraded / sensor fault" />
                <p className="text-slate-400">Seeded PRNG (seed 42): every run is repeatable.</p>
              </div>
            </div>
          </Card>
        </div>

        <Card title="Automated test results" subtitle="TC-01 to TC-07, executed against the real navigation logic." id="results">
          <SuiteSummary run={view.suiteRun} stale={stale} />
          <div className="mt-4">
            <TestList run={view.suiteRun} />
          </div>
        </Card>

        <Card title="Regression testing demonstration" subtitle="Introduce a defect, watch the tests catch it, fix it, confirm recovery." id="regression">
          <RegressionDemo stepIndex={regStep} runs={regRuns} onAdvance={advanceRegression} onRestart={restartRegression} activeBuild={view.build} />
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Verification vs validation">
            <div className="space-y-3 text-sm text-slate-200">
              <div className="rounded-lg border border-sky-400/30 bg-sky-400/5 p-3">
                <p className="font-semibold text-sky-300">Verification: did we build it right?</p>
                <p className="mt-1">Does the system meet its specified requirements?</p>
                <p className="mt-1 text-slate-300">
                  Example: TC-04 checks the calculated position error against an independent Euclidean oracle and that
                  exactly 5.00 m is in tolerance while 5.01 m is not.
                </p>
              </div>
              <div className="rounded-lg border border-violet-400/30 bg-violet-400/5 p-3">
                <p className="font-semibold text-violet-300">Validation: did we build the right thing?</p>
                <p className="mt-1">Does the system behave appropriately for its intended use?</p>
                <p className="mt-1 text-slate-300">
                  Example: TC-02, TC-05 and TC-07 check that unreliable readings (missing, failed, or just after a fault) are
                  flagged as untrusted rather than shown to an operator as a trustworthy position.
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Also demonstrated: functional tests (TC-01 to TC-05), integration (monitor + simulator + suite run end to end),
                fault injection (live controls), and regression (TC-06 golden baseline + the stepper above).
              </p>
            </div>
          </Card>

          <Card title="Requirements traceability" subtitle="Each requirement linked to its tests and their latest result." id="traceability">
            <TraceabilityTable results={suite?.results ?? null} />
          </Card>
        </div>

        <footer className="pt-2 text-center text-xs text-slate-500">
          Portfolio demonstration. Simulated data only; not Sonardyne technology and not validated against real equipment.
        </footer>
      </main>
    </div>
  );
}

function Readout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="truncate font-mono text-sm">{children}</dd>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <p className="flex items-center gap-2">
      <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </p>
  );
}

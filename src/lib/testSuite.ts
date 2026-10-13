/**
 * The in-app automated test suite (TC-01 … TC-07).
 *
 * Each test exercises the real system code and compares it against an
 * independent oracle (its own Math.hypot), never against the system's own
 * positionError(). Any exception thrown by a test becomes a FAIL.
 */
import { BASELINE_RECORDS } from "./baseline";
import type { ProcessorBuild } from "./build";
import type { Point } from "./geometry";
import {
  NavigationMonitor,
  type NavOutput,
  type NavStatus,
  POSITION_TOLERANCE_M,
  RECOVERY_READINGS_REQUIRED,
} from "./navigation";
import { runScenario } from "./scenario";
import { type FaultType, type SimSample, generateSample } from "./simulation";

export type TestStatus = "PASS" | "FAIL";

export interface TestResult {
  id: string;
  title: string;
  description: string;
  expected: string;
  actual: string;
  status: TestStatus;
  explanation: string;
  requirements: string[];
}

export interface LiveContext {
  sample: SimSample;
  output: NavOutput;
}

export interface SuiteContext {
  build: ProcessorBuild;
  /** Current live reading. When absent, TC-01 uses a clean step-0 sample. */
  live?: LiveContext | null;
}

export interface SuiteResult {
  buildVersion: string;
  defectiveBuild: boolean;
  results: TestResult[];
  total: number;
  passed: number;
  failed: number;
  status: TestStatus;
  summary: string[];
}

/** Independent oracle: the specification's definition of position error. */
const oracleError = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

interface Outcome {
  pass: boolean;
  actual: string;
  explanation: string;
}

interface TestCase {
  id: string;
  title: string;
  description: string;
  expected: string;
  requirements: string[];
  run: (ctx: SuiteContext) => Outcome;
}

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "n/a" : `${n.toFixed(2)} m`);

const TESTS: TestCase[] = [
  {
    id: "TC-01",
    title: "Normal sensor reading",
    description: "Live check on the current simulated reading: the measured position is within tolerance and reported as a trusted NOMINAL fix.",
    expected: `Reading present, sensor OK, independent error ≤ ${POSITION_TOLERANCE_M.toFixed(1)} m, status NOMINAL, trusted.`,
    requirements: ["REQ-002"],
    run: ({ build, live }) => {
      let sample: SimSample;
      let output: NavOutput;
      if (live) {
        ({ sample, output } = live);
      } else {
        sample = generateSample(0);
        output = new NavigationMonitor(build).process(sample.expected, sample.reading);
      }
      const r = sample.reading;
      if (!r) {
        return { pass: false, actual: `No reading (status ${output.status}).`, explanation: "No sensor data at this step, so a normal in-tolerance reading cannot be confirmed." };
      }
      const err = oracleError(sample.expected, r.position);
      const actual = `Sensor ${r.health}, independent error ${fmt(err)}, system error ${fmt(output.positionError)}, status ${output.status}, trusted=${output.trusted}.`;
      if (r.health !== "OK") {
        return { pass: false, actual, explanation: "The sensor reports FAILED, so this is not a normal reading." };
      }
      if (err > POSITION_TOLERANCE_M) {
        const masked = output.trusted
          ? " The system nonetheless marked the fix as trusted: it did not detect the error."
          : "";
        return { pass: false, actual, explanation: `Measured position is ${fmt(err)} from the planned track, above the ${POSITION_TOLERANCE_M} m tolerance.${masked}` };
      }
      if (output.status !== "NOMINAL" || !output.trusted) {
        return { pass: false, actual, explanation: `Reading is in tolerance but the system is ${output.status} (e.g. still recovering from a fault), so the fix is not yet trusted.` };
      }
      return { pass: true, actual, explanation: "Reading is within tolerance and correctly reported as trusted." };
    },
  },
  {
    id: "TC-02",
    title: "Missing sensor data",
    description: "Feed one good reading, then null and undefined readings. The monitor must not crash and must not present stale data as current.",
    expected: "Status NO_DATA, alarm WARNING, trusted=false, last known good fix retained, no exception.",
    requirements: ["REQ-004"],
    run: ({ build }) => {
      const monitor = new NavigationMonitor(build);
      const good = generateSample(0);
      const first = monitor.process(good.expected, good.reading);
      const goodFix = first.lastKnownGood;
      const problems: string[] = [];
      const outs = [null, undefined].map((reading) => monitor.process(good.expected, reading));
      outs.forEach((o, i) => {
        const label = i === 0 ? "null" : "undefined";
        if (o.status !== "NO_DATA") problems.push(`${label} → status ${o.status}`);
        if (o.trusted) problems.push(`${label} → marked trusted`);
        if (o.alarm !== "WARNING") problems.push(`${label} → alarm ${o.alarm}`);
        if (!goodFix || !o.lastKnownGood || o.lastKnownGood.x !== goodFix.x || o.lastKnownGood.y !== goodFix.y) {
          problems.push(`${label} → last known good fix not retained`);
        }
      });
      const actual = outs.map((o) => `${o.status}/${o.alarm}/trusted=${o.trusted}`).join("; ");
      return problems.length
        ? { pass: false, actual, explanation: problems.join("; ") }
        : { pass: true, actual, explanation: "Missing readings flagged safely; last known good fix held." };
    },
  },
  {
    id: "TC-03",
    title: "Invalid coordinates",
    description: "Submit malformed readings: NaN, Infinity, out-of-area, wrong types, missing position, garbage objects.",
    expected: "Every invalid reading rejected as INVALID_INPUT, untrusted, without throwing.",
    requirements: ["REQ-005"],
    run: ({ build }) => {
      const ref = { x: 10, y: 10 };
      const cases: [string, unknown, unknown][] = [
        ["x = NaN", ref, { position: { x: NaN, y: 10 }, health: "OK" }],
        ["y = Infinity", ref, { position: { x: 10, y: Infinity }, health: "OK" }],
        ["x = 5000 m (outside area)", ref, { position: { x: 5000, y: 10 }, health: "OK" }],
        ['x = "12" (string)', ref, { position: { x: "12", y: 10 }, health: "OK" }],
        ["position missing", ref, { health: "OK" }],
        ["reading is a string", ref, "garbage"],
        ["unknown health flag", ref, { position: { x: 10, y: 10 }, health: "MAYBE" }],
        ["expected position NaN", { x: NaN, y: 0 }, { position: { x: 10, y: 10 }, health: "OK" }],
      ];
      const failures: string[] = [];
      for (const [label, expected, reading] of cases) {
        const out = new NavigationMonitor(build).process(expected, reading);
        if (out.status !== "INVALID_INPUT" || out.trusted) failures.push(`${label} → ${out.status}, trusted=${out.trusted}`);
      }
      const actual = `${cases.length - failures.length}/${cases.length} invalid inputs rejected.`;
      return failures.length
        ? { pass: false, actual, explanation: `Accepted invalid input: ${failures.join("; ")}` }
        : { pass: true, actual, explanation: "All malformed inputs rejected without exceptions." };
    },
  },
  {
    id: "TC-04",
    title: "Position error threshold",
    description: "Boundary-value test around the 5.0 m limit using offsets in x, y and diagonally. Pass/fail is decided by an independent Euclidean oracle.",
    expected: "Offsets with true error ≤ 5.0 m → NOMINAL; > 5.0 m → DEGRADED with ALARM. Reported error matches oracle.",
    requirements: ["REQ-001", "REQ-002", "REQ-003"],
    run: ({ build }) => {
      const base = { x: 100, y: -50 };
      const offsets: [number, number][] = [
        [0, 0], [3, 4], [0, 4.99], [0, 5.01], [3.6, 3.6], [-5.01, 0], [0, -12],
      ];
      const failures: string[] = [];
      const failingOffsets: [number, number][] = [];
      for (const [dx, dy] of offsets) {
        const measured = { x: base.x + dx, y: base.y + dy };
        const truth = oracleError(base, measured);
        const shouldAlarm = truth > POSITION_TOLERANCE_M;
        const out = new NavigationMonitor(build).process(base, { position: measured, health: "OK" });
        const gotAlarm = out.status === "DEGRADED" && out.alarm === "ALARM";
        const okStatus = shouldAlarm ? gotAlarm : out.status === "NOMINAL";
        const okError = out.positionError !== null && Math.abs(out.positionError - truth) < 1e-9;
        if (!okStatus || !okError) {
          failures.push(`(${dx}, ${dy}): true ${truth.toFixed(2)} m, system ${fmt(out.positionError)} → ${out.status}`);
          failingOffsets.push([dx, dy]);
        }
      }
      const actual = `${offsets.length - failures.length}/${offsets.length} boundary cases correct.`;
      return failures.length
        ? {
            pass: false,
            actual,
            explanation: `Threshold misclassified or error miscalculated: ${failures.join("; ")}.${
              failingOffsets.every(([, dy]) => dy !== 0)
                ? " Every failing case has a north-south (y) offset, which points to the y component being ignored."
                : ""
            }`,
          }
        : { pass: true, actual, explanation: "All boundary cases classified correctly (5.00 m in tolerance, 5.01 m out)." };
    },
  },
  {
    id: "TC-05",
    title: "Sensor failure",
    description: "After a good fix, inject a simulated sensor failure (health FAILED, position jumps ~64 m).",
    expected: "Status SENSOR_FAULT, alarm ALARM, trusted=false, last known good fix is not overwritten by the faulty position.",
    requirements: ["REQ-006"],
    run: ({ build }) => {
      const monitor = new NavigationMonitor(build);
      const good = generateSample(0);
      const g = monitor.process(good.expected, good.reading);
      const bad = generateSample(1, "sensor_failure", 0);
      const out = monitor.process(bad.expected, bad.reading);
      const problems: string[] = [];
      if (out.status !== "SENSOR_FAULT") problems.push(`status ${out.status}`);
      if (out.alarm !== "ALARM") problems.push(`alarm ${out.alarm}`);
      if (out.trusted) problems.push("faulty fix marked trusted");
      if (!g.lastKnownGood || out.lastKnownGood?.x !== g.lastKnownGood.x || out.lastKnownGood?.y !== g.lastKnownGood.y) {
        problems.push("last known good fix overwritten");
      }
      const actual = `${out.status}/${out.alarm}/trusted=${out.trusted}`;
      return problems.length
        ? { pass: false, actual, explanation: `Sensor failure not handled: ${problems.join("; ")}.` }
        : { pass: true, actual, explanation: "Failure raised an alarm and the faulty position was not trusted." };
    },
  },
  {
    id: "TC-06",
    title: "Regression vs. baseline",
    description: "Replay the fixed seed-42, 24-step scenario (all fault types) and compare against golden outputs recorded from verified build 1.2.0.",
    expected: "Every step's status and position error (±0.0005 m) match the golden baseline.",
    requirements: ["REQ-001", "REQ-003", "REQ-007"],
    run: ({ build }) => {
      const records = runScenario(build);
      const diffs: string[] = [];
      records.forEach((r, i) => {
        const g = BASELINE_RECORDS[i];
        if (!g) {
          diffs.push(`step ${r.step}: no golden record`);
          return;
        }
        const errMatch =
          r.positionError === null || g.positionError === null
            ? r.positionError === g.positionError
            : Math.abs(r.positionError - g.positionError) <= 5e-4;
        if (r.status !== g.status || !errMatch) {
          diffs.push(`step ${r.step} (${r.fault}): ${r.status} ${fmt(r.positionError)} vs golden ${g.status} ${fmt(g.positionError)}`);
        }
      });
      if (records.length !== BASELINE_RECORDS.length) diffs.push(`length ${records.length} vs ${BASELINE_RECORDS.length}`);
      const actual = `${records.length - diffs.length}/${BASELINE_RECORDS.length} steps match baseline.`;
      const statusDiffs = records.filter((r, i) => BASELINE_RECORDS[i] && r.status !== BASELINE_RECORDS[i].status).length;
      return diffs.length
        ? {
            pass: false,
            actual,
            explanation: `Behaviour changed from verified baseline (${statusDiffs} status changes). First deviations: ${diffs.slice(0, 3).join("; ")}.`,
          }
        : { pass: true, actual, explanation: "Behaviour identical to verified baseline." };
    },
  },
  {
    id: "TC-07",
    title: "Recovery after fault",
    description: "For each fault type: 2 good steps, 2 faulted steps, then 4 good steps after the fault clears.",
    expected: `Faulted steps untrusted; after clearing: RECOVERING ×${RECOVERY_READINGS_REQUIRED - 1}, then NOMINAL (trusted).`,
    requirements: ["REQ-007"],
    run: ({ build }) => {
      const faults: FaultType[] = ["sensor_failure", "missing_data", "excessive_error"];
      const expectedAfter: NavStatus[] = ["RECOVERING", "RECOVERING", "NOMINAL", "NOMINAL"];
      const failures: string[] = [];
      const summaries: string[] = [];
      for (const fault of faults) {
        const monitor = new NavigationMonitor(build);
        const seq: FaultType[] = ["none", "none", fault, fault, "none", "none", "none", "none"];
        const outs = seq.map((f, step) => {
          const s = generateSample(step, f, f === "none" ? 0 : step - 2);
          return monitor.process(s.expected, s.reading);
        });
        const faultTrusted = outs.slice(2, 4).some((o) => o.trusted);
        const after = outs.slice(4).map((o) => o.status);
        const trustOk = outs.slice(4).every((o, i) => o.trusted === (expectedAfter[i] === "NOMINAL"));
        summaries.push(`${fault}: ${after.join("→")}`);
        if (faultTrusted) failures.push(`${fault} was never detected (faulted steps trusted)`);
        else if (after.join() !== expectedAfter.join() || !trustOk) failures.push(`${fault}: got ${after.join("→")}`);
      }
      const actual = summaries.join("; ");
      return failures.length
        ? { pass: false, actual, explanation: `Recovery behaviour incorrect: ${failures.join("; ")}.` }
        : { pass: true, actual, explanation: "All faults detected and recovery required 3 consecutive good readings." };
    },
  },
];

export const TEST_CASES = TESTS.map(({ run: _run, ...meta }) => meta);

/** Reads the build flag without letting a corrupt build object crash the suite. */
function readDefectFlag(build: ProcessorBuild): boolean {
  try {
    return Boolean(build.defect);
  } catch {
    return false;
  }
}

export function runTestSuite(ctx: SuiteContext): SuiteResult {
  const results: TestResult[] = TESTS.map((t) => {
    let outcome: Outcome;
    try {
      outcome = t.run(ctx);
    } catch (err) {
      outcome = { pass: false, actual: "Exception thrown", explanation: `Test threw: ${err instanceof Error ? err.message : String(err)}` };
    }
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      expected: t.expected,
      requirements: t.requirements,
      actual: outcome.actual,
      status: outcome.pass ? "PASS" : "FAIL",
      explanation: outcome.explanation,
    };
  });
  const failed = results.filter((r) => r.status === "FAIL");
  return {
    buildVersion: ctx.build.version,
    defectiveBuild: readDefectFlag(ctx.build),
    results,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    status: failed.length ? "FAIL" : "PASS",
    summary: failed.length
      ? failed.map((r) => `${r.id} ${r.title}: ${r.explanation}`)
      : ["All checks passed. No issues detected."],
  };
}


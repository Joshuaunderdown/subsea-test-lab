import type { ProcessorBuild } from "./build";
import { NavigationMonitor, type NavStatus } from "./navigation";
import { DEFAULT_SEED, type FaultType, generateSample } from "./simulation";

/**
 * Fixed regression scenario: seed 42, 24 steps, with every fault type injected
 * and cleared once. Its outputs from the verified build are stored as golden
 * values in baseline.ts.
 */
export const REGRESSION_SCENARIO: FaultType[] = [
  "none", "none", "none", "none", "none", "none",
  "excessive_error", "excessive_error", "excessive_error",
  "none", "none", "none",
  "missing_data", "missing_data",
  "none", "none", "none",
  "sensor_failure", "sensor_failure",
  "none", "none", "none", "none", "none",
];

export interface ScenarioRecord {
  step: number;
  fault: FaultType;
  status: NavStatus;
  /** Position error rounded to 4 d.p., or null if not computed. */
  positionError: number | null;
}

export function runScenario(
  build: ProcessorBuild,
  faults: FaultType[] = REGRESSION_SCENARIO,
  seed: number = DEFAULT_SEED,
): ScenarioRecord[] {
  const monitor = new NavigationMonitor(build);
  const records: ScenarioRecord[] = [];
  let faultAge = 0;
  faults.forEach((fault, step) => {
    faultAge = step > 0 && faults[step - 1] === fault ? faultAge + 1 : 0;
    const sample = generateSample(step, fault, fault === "none" ? 0 : faultAge, seed);
    const out = monitor.process(sample.expected, sample.reading);
    records.push({
      step,
      fault,
      status: out.status,
      positionError: out.positionError === null ? null : Math.round(out.positionError * 1e4) / 1e4,
    });
  });
  return records;
}

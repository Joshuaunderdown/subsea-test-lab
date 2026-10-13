import { describe, expect, it } from "vitest";
import { BASELINE_META, BASELINE_RECORDS } from "@/lib/baseline";
import { BASELINE_BUILD, defaultBuild } from "@/lib/build";
import { REGRESSION_SCENARIO, runScenario } from "@/lib/scenario";

/**
 * Golden-master regression test: the build under test must reproduce the
 * outputs recorded from verified build 1.2.0 for the seed-42 scenario.
 */
describe("regression against golden baseline", () => {
  const records = runScenario(defaultBuild());

  it("baseline metadata matches the scenario", () => {
    expect(BASELINE_META.buildVersion).toBe(BASELINE_BUILD.version);
    expect(BASELINE_META.seed).toBe(42);
    expect(BASELINE_RECORDS).toHaveLength(REGRESSION_SCENARIO.length);
  });

  it("the scenario covers every fault type and the recovery path", () => {
    const statuses = new Set<string>(BASELINE_RECORDS.map((r) => r.status));
    for (const s of ["NOMINAL", "DEGRADED", "NO_DATA", "SENSOR_FAULT", "RECOVERING"]) {
      expect(statuses.has(s)).toBe(true);
    }
  });

  it.each(BASELINE_RECORDS.map((g) => [g.step, g.fault, g] as const))(
    "step %i (%s) matches golden status and error",
    (step, _fault, golden) => {
      const r = records[step];
      expect(r.status).toBe(golden.status);
      if (golden.positionError === null) {
        expect(r.positionError).toBeNull();
      } else {
        expect(r.positionError).not.toBeNull();
        expect(Math.abs(r.positionError! - golden.positionError)).toBeLessThanOrEqual(5e-4);
      }
    },
  );

  it("is repeatable: two runs are identical", () => {
    expect(runScenario(defaultBuild())).toEqual(records);
  });
});

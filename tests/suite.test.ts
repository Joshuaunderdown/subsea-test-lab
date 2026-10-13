import { describe, expect, it } from "vitest";
import { BASELINE_BUILD, DEFECTIVE_BUILD, defaultBuild } from "@/lib/build";
import { NavigationMonitor } from "@/lib/navigation";
import { REQUIREMENTS, traceability } from "@/lib/requirements";
import { type FaultType, generateSample } from "@/lib/simulation";
import { runTestSuite } from "@/lib/testSuite";

const live = (fault: FaultType, build = BASELINE_BUILD) => {
  const sample = generateSample(10, fault, 0);
  return { sample, output: new NavigationMonitor(build).process(sample.expected, sample.reading) };
};

describe("in-app test suite (integration)", () => {
  it("passes all 7 tests on the build under test with no fault", () => {
    const suite = runTestSuite({ build: defaultBuild() });
    expect(suite.results.map((r) => r.id)).toEqual(["TC-01", "TC-02", "TC-03", "TC-04", "TC-05", "TC-06", "TC-07"]);
    const failed = suite.results.filter((r) => r.status === "FAIL").map((r) => `${r.id}: ${r.explanation}`);
    expect(failed).toEqual([]);
    expect(suite.status).toBe("PASS");
    expect(suite.passed).toBe(7);
  });

  it("every result has the required fields", () => {
    for (const r of runTestSuite({ build: BASELINE_BUILD }).results) {
      expect(r.id).toMatch(/^TC-0\d$/);
      for (const k of ["title", "description", "expected", "actual", "explanation"] as const) {
        expect(r[k].length).toBeGreaterThan(0);
      }
      expect(r.requirements.length).toBeGreaterThan(0);
    }
  });

  it("detects the injected defect: TC-04, TC-06 and TC-07 fail on the defective build", () => {
    const suite = runTestSuite({ build: DEFECTIVE_BUILD });
    const failed = suite.results.filter((r) => r.status === "FAIL").map((r) => r.id);
    expect(failed).toEqual(["TC-04", "TC-06", "TC-07"]);
    expect(suite.status).toBe("FAIL");
    expect(suite.failed).toBe(3);
  });

  it.each(["sensor_failure", "missing_data", "excessive_error"] as const)(
    "live TC-01 fails while a %s fault is active",
    (fault) => {
      const suite = runTestSuite({ build: BASELINE_BUILD, live: live(fault) });
      expect(suite.results.find((r) => r.id === "TC-01")!.status).toBe("FAIL");
    },
  );

  it("live TC-01 passes on a clean reading", () => {
    const suite = runTestSuite({ build: BASELINE_BUILD, live: live("none") });
    expect(suite.results.find((r) => r.id === "TC-01")!.status).toBe("PASS");
  });

  it("TC-01 uses an independent oracle: catches an excessive error the defective build trusts", () => {
    const ctx = live("excessive_error", DEFECTIVE_BUILD);
    expect(ctx.output.trusted).toBe(true); // the defect hides the error from the system
    const tc01 = runTestSuite({ build: DEFECTIVE_BUILD, live: ctx }).results[0];
    expect(tc01.status).toBe("FAIL");
    expect(tc01.explanation).toMatch(/did not detect/);
  });

  it("a test that throws is reported as FAIL, not a crash", () => {
    const corruptLive = {
      get sample(): never {
        throw new Error("corrupt live context");
      },
      output: live("none").output,
    };
    const suite = runTestSuite({ build: BASELINE_BUILD, live: corruptLive });
    const tc01 = suite.results.find((r) => r.id === "TC-01")!;
    expect(tc01.status).toBe("FAIL");
    expect(tc01.explanation).toContain("Test threw: corrupt live context");
    expect(suite.failed).toBe(1); // the other tests still ran
  });

  it("a corrupt build object does not crash the suite", () => {
    const broken = {
      ...BASELINE_BUILD,
      get defect(): boolean {
        throw new Error("corrupt build");
      },
    };
    expect(() => runTestSuite({ build: broken })).not.toThrow();
    expect(runTestSuite({ build: broken }).status).toBe("FAIL");
  });
});

describe("requirements traceability", () => {
  it("every requirement maps to at least one existing test", () => {
    const ids = new Set(runTestSuite({ build: BASELINE_BUILD }).results.map((r) => r.id));
    for (const req of REQUIREMENTS) {
      expect(req.testIds.length).toBeGreaterThan(0);
      req.testIds.forEach((t) => expect(ids.has(t)).toBe(true));
    }
  });

  it("reflects failing tests and NOT RUN state", () => {
    expect(traceability(null).every((r) => r.status === "NOT RUN")).toBe(true);
    const rows = traceability(runTestSuite({ build: DEFECTIVE_BUILD }).results);
    expect(rows.find((r) => r.id === "REQ-001")!.status).toBe("FAIL");
    expect(rows.find((r) => r.id === "REQ-005")!.status).toBe("PASS");
  });
});

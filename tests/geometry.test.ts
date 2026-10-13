import { describe, expect, it } from "vitest";
import { BASELINE_BUILD, DEFECTIVE_BUILD, defaultBuild } from "@/lib/build";
import { isValidPoint, positionError, WORKING_AREA_LIMIT_M } from "@/lib/geometry";

// Build under test: baseline normally, defective when SUBSEA_INJECT_DEFECT=1.
const build = defaultBuild();

describe("isValidPoint", () => {
  it("accepts finite coordinates inside the working area", () => {
    expect(isValidPoint({ x: 0, y: 0 })).toBe(true);
    expect(isValidPoint({ x: -123.4, y: 567.8 })).toBe(true);
    expect(isValidPoint({ x: WORKING_AREA_LIMIT_M, y: -WORKING_AREA_LIMIT_M })).toBe(true);
  });

  it.each([
    ["NaN", { x: NaN, y: 0 }],
    ["Infinity", { x: 0, y: Infinity }],
    ["outside area", { x: 1000.01, y: 0 }],
    ["string coordinate", { x: "1", y: 0 }],
    ["missing y", { x: 1 }],
    ["null", null],
    ["undefined", undefined],
    ["number", 42],
  ])("rejects %s", (_label, p) => {
    expect(isValidPoint(p)).toBe(false);
  });
});

describe("positionError (build under test)", () => {
  it("is zero for identical points", () => {
    expect(positionError({ x: 5, y: 5 }, { x: 5, y: 5 }, build)).toBe(0);
  });

  it("is the Euclidean distance (3-4-5 triangle)", () => {
    expect(positionError({ x: 0, y: 0 }, { x: 3, y: 4 }, build)).toBeCloseTo(5, 12);
  });

  it("measures purely north-south errors", () => {
    // This assertion is the one that catches the injected defect.
    expect(positionError({ x: 10, y: 10 }, { x: 10, y: 22 }, build)).toBeCloseTo(12, 12);
  });

  it("is symmetric", () => {
    const a = { x: -7.5, y: 2 };
    const b = { x: 1.25, y: -9 };
    expect(positionError(a, b, build)).toBeCloseTo(positionError(b, a, build), 12);
  });
});

describe("builds", () => {
  it("baseline uses the correct calculation", () => {
    expect(positionError({ x: 0, y: 0 }, { x: 0, y: 7 }, BASELINE_BUILD)).toBe(7);
  });

  it("defective build demonstrably drops the y component", () => {
    expect(positionError({ x: 0, y: 0 }, { x: 0, y: 7 }, DEFECTIVE_BUILD)).toBe(0);
  });
});

import { type ProcessorBuild, defaultBuild } from "./build";

/** 2-D position in metres. x = east, y = north. */
export interface Point {
  x: number;
  y: number;
}

/** The simulated working area is a square of ±1000 m around the origin. */
export const WORKING_AREA_LIMIT_M = 1000;

/** True only for an object with finite numeric x/y inside the working area. */
export function isValidPoint(p: unknown): p is Point {
  if (typeof p !== "object" || p === null) return false;
  const { x, y } = p as Record<string, unknown>;
  return (
    typeof x === "number" &&
    typeof y === "number" &&
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Math.abs(x) <= WORKING_AREA_LIMIT_M &&
    Math.abs(y) <= WORKING_AREA_LIMIT_M
  );
}

/**
 * Horizontal position error between the planned (expected) and measured fix.
 *
 * Correct behaviour: Euclidean distance.
 * Defective build: only |dx| – the y component was dropped in a "refactor".
 */
export function positionError(
  expected: Point,
  measured: Point,
  build: ProcessorBuild = defaultBuild(),
): number {
  const dx = measured.x - expected.x;
  const dy = measured.y - expected.y;
  if (build.defect) {
    return Math.abs(dx); // DEFECT: dy ignored
  }
  return Math.hypot(dx, dy);
}

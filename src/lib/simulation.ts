import type { Point } from "./geometry";

/**
 * Deterministic sensor simulator.
 *
 * Every sample is a pure function of (seed, step, fault, faultAge): the PRNG is
 * re-seeded per step, so a sample can be regenerated in isolation and the same
 * scenario always produces exactly the same readings.
 */

export type FaultType = "none" | "sensor_failure" | "missing_data" | "excessive_error";

export type SensorHealth = "OK" | "FAILED";

export interface SensorReading {
  position: Point;
  health: SensorHealth;
}

export interface SimSample {
  step: number;
  /** Planned position on the survey track. */
  expected: Point;
  /** Sensor output, or null when the reading is missing. */
  reading: SensorReading | null;
  fault: FaultType;
  faultAge: number;
}

export const DEFAULT_SEED = 42;
export const NOISE_SIGMA_M = 0.8;

/** Fixed offset applied while the sensor reports FAILED. */
export const SENSOR_FAILURE_JUMP: Point = { x: 38, y: -52 };
/** Northward bias for the excessive_error fault: base + growth per step. */
export const EXCESSIVE_BIAS_BASE_M = 8;
export const EXCESSIVE_BIAS_GROWTH_M = 0.6;

export const FAULT_LABELS: Record<FaultType, string> = {
  none: "None",
  sensor_failure: "Sensor failure",
  missing_data: "Missing readings",
  excessive_error: "Excessive position error",
};

/** mulberry32: small, fast, well-distributed 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derives an independent seed for each step. */
export function stepSeed(seed: number, step: number): number {
  return (seed ^ Math.imul(step + 1, 0x9e3779b1)) >>> 0;
}

/** Standard normal sample via Box–Muller. */
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Figure-of-eight survey track. */
export function plannedPosition(step: number): Point {
  return { x: 180 * Math.sin(0.05 * step), y: 90 * Math.sin(0.1 * step) };
}

export function generateSample(
  step: number,
  fault: FaultType = "none",
  faultAge = 0,
  seed: number = DEFAULT_SEED,
): SimSample {
  const rng = mulberry32(stepSeed(seed, step));
  const nx = gaussian(rng) * NOISE_SIGMA_M;
  const ny = gaussian(rng) * NOISE_SIGMA_M;
  const expected = plannedPosition(step);

  let reading: SensorReading | null;
  switch (fault) {
    case "sensor_failure":
      reading = {
        position: {
          x: expected.x + SENSOR_FAILURE_JUMP.x + nx,
          y: expected.y + SENSOR_FAILURE_JUMP.y + ny,
        },
        health: "FAILED",
      };
      break;
    case "missing_data":
      reading = null;
      break;
    case "excessive_error":
      // Sensor claims to be healthy, but a growing northward bias is present.
      reading = {
        position: {
          x: expected.x + nx,
          y: expected.y + ny + EXCESSIVE_BIAS_BASE_M + EXCESSIVE_BIAS_GROWTH_M * faultAge,
        },
        health: "OK",
      };
      break;
    default:
      reading = { position: { x: expected.x + nx, y: expected.y + ny }, health: "OK" };
  }

  return { step, expected, reading, fault, faultAge };
}

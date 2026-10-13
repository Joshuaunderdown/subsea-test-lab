import { describe, expect, it } from "vitest";
import {
  generateSample,
  mulberry32,
  NOISE_SIGMA_M,
  plannedPosition,
  SENSOR_FAILURE_JUMP,
} from "@/lib/simulation";

describe("deterministic simulator", () => {
  it("mulberry32 produces the same sequence for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it("each sample is a pure function of (seed, step, fault, faultAge)", () => {
    expect(generateSample(17)).toEqual(generateSample(17));
    expect(generateSample(5, "excessive_error", 3)).toEqual(generateSample(5, "excessive_error", 3));
    expect(generateSample(5, "none", 0, 7)).not.toEqual(generateSample(5, "none", 0, 42));
  });

  it("follows the planned figure-of-eight track", () => {
    expect(plannedPosition(0)).toEqual({ x: 0, y: 0 });
    const p = plannedPosition(10);
    expect(p.x).toBeCloseTo(180 * Math.sin(0.5), 12);
    expect(p.y).toBeCloseTo(90 * Math.sin(1), 12);
  });

  it("normal readings are healthy and close to the planned position", () => {
    for (let step = 0; step < 200; step++) {
      const s = generateSample(step);
      expect(s.reading?.health).toBe("OK");
      const err = Math.hypot(s.reading!.position.x - s.expected.x, s.reading!.position.y - s.expected.y);
      expect(err).toBeLessThan(6 * NOISE_SIGMA_M);
    }
  });

  it("missing_data fault yields a null reading", () => {
    expect(generateSample(3, "missing_data").reading).toBeNull();
  });

  it("sensor_failure fault marks the sensor FAILED and jumps the position", () => {
    const normal = generateSample(4);
    const failed = generateSample(4, "sensor_failure");
    expect(failed.reading?.health).toBe("FAILED");
    expect(failed.reading!.position.x - normal.reading!.position.x).toBeCloseTo(SENSOR_FAILURE_JUMP.x, 9);
    expect(failed.reading!.position.y - normal.reading!.position.y).toBeCloseTo(SENSOR_FAILURE_JUMP.y, 9);
  });

  it("excessive_error fault reports OK health with a growing northward bias", () => {
    const normal = generateSample(8);
    const age0 = generateSample(8, "excessive_error", 0);
    const age5 = generateSample(8, "excessive_error", 5);
    expect(age0.reading?.health).toBe("OK");
    expect(age0.reading!.position.x).toBeCloseTo(normal.reading!.position.x, 12);
    expect(age0.reading!.position.y - normal.reading!.position.y).toBeCloseTo(8, 9);
    expect(age5.reading!.position.y - normal.reading!.position.y).toBeCloseTo(11, 9);
  });
});

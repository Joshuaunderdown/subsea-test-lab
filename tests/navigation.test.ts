import { describe, expect, it } from "vitest";
import { defaultBuild } from "@/lib/build";
import { NavigationMonitor, POSITION_TOLERANCE_M } from "@/lib/navigation";
import { type FaultType, generateSample } from "@/lib/simulation";

const build = defaultBuild();
const ok = (x: number, y: number) => ({ position: { x, y }, health: "OK" });

describe("NavigationMonitor: valid inputs", () => {
  it("reports a normal reading as NOMINAL and trusted", () => {
    const s = generateSample(0);
    const out = new NavigationMonitor(build).process(s.expected, s.reading);
    expect(out.status).toBe("NOMINAL");
    expect(out.trusted).toBe(true);
    expect(out.alarm).toBe("OK");
    expect(out.lastKnownGood).toEqual(s.reading!.position);
  });
});

describe("NavigationMonitor: threshold boundaries", () => {
  const base = { x: 100, y: -50 };
  it.each([
    [0, 0, "NOMINAL"],
    [3, 4, "NOMINAL"], // exactly 5.00 m: in tolerance
    [0, 4.99, "NOMINAL"],
    [4.99, 0, "NOMINAL"],
    [0, 5.01, "DEGRADED"],
    [5.01, 0, "DEGRADED"],
    [3.6, 3.6, "DEGRADED"], // 5.09 m diagonal
    [0, -12, "DEGRADED"],
  ])("offset (%s, %s) → %s", (dx, dy, expected) => {
    const out = new NavigationMonitor(build).process(base, ok(base.x + dx, base.y + dy));
    expect(out.status).toBe(expected);
    expect(out.positionError).toBeCloseTo(Math.hypot(dx, dy), 9);
    expect(out.trusted).toBe(expected === "NOMINAL");
  });

  it("uses a 5.0 m tolerance", () => {
    expect(POSITION_TOLERANCE_M).toBe(5.0);
  });
});

describe("NavigationMonitor: missing data", () => {
  it("flags null and undefined readings as NO_DATA and keeps the last good fix", () => {
    const m = new NavigationMonitor(build);
    const s = generateSample(0);
    m.process(s.expected, s.reading);
    for (const reading of [null, undefined]) {
      const out = m.process(s.expected, reading);
      expect(out.status).toBe("NO_DATA");
      expect(out.trusted).toBe(false);
      expect(out.alarm).toBe("WARNING");
      expect(out.positionError).toBeNull();
      expect(out.lastKnownGood).toEqual(s.reading!.position);
    }
  });
});

describe("NavigationMonitor: invalid input", () => {
  const ref = { x: 0, y: 0 };
  it.each([
    ["NaN x", ref, ok(NaN, 0)],
    ["Infinite y", ref, ok(0, -Infinity)],
    ["outside area", ref, ok(0, 1500)],
    ["string coordinate", ref, { position: { x: "0", y: 0 }, health: "OK" }],
    ["no position", ref, { health: "OK" }],
    ["string reading", ref, "not a reading"],
    ["number reading", ref, 7],
    ["unknown health", ref, { position: { x: 0, y: 0 }, health: "?" }],
    ["invalid expected", { x: "a", y: 0 }, ok(0, 0)],
    ["null expected", null, ok(0, 0)],
  ])("rejects %s without throwing", (_label, expected, reading) => {
    const m = new NavigationMonitor(build);
    expect(() => m.process(expected, reading)).not.toThrow();
    const out = m.process(expected, reading);
    expect(out.status).toBe("INVALID_INPUT");
    expect(out.trusted).toBe(false);
  });

  it("survives a reading whose getter throws", () => {
    const evil = {
      get position(): never {
        throw new Error("boom");
      },
      health: "OK",
    };
    const out = new NavigationMonitor(build).process({ x: 0, y: 0 }, evil);
    expect(out.status).toBe("INVALID_INPUT");
  });
});

describe("NavigationMonitor: sensor failure", () => {
  it("raises an ALARM and does not trust or store the faulty position", () => {
    const m = new NavigationMonitor(build);
    const good = generateSample(0);
    m.process(good.expected, good.reading);
    const bad = generateSample(1, "sensor_failure");
    const out = m.process(bad.expected, bad.reading);
    expect(out.status).toBe("SENSOR_FAULT");
    expect(out.alarm).toBe("ALARM");
    expect(out.trusted).toBe(false);
    expect(out.lastKnownGood).toEqual(good.reading!.position);
  });
});

describe("NavigationMonitor: recovery", () => {
  it.each(["sensor_failure", "missing_data", "excessive_error"] as const)(
    "requires 3 consecutive good readings after %s",
    (fault) => {
      const m = new NavigationMonitor(build);
      const run = (step: number, f: FaultType = "none", age = 0) => {
        const s = generateSample(step, f, age);
        return m.process(s.expected, s.reading);
      };
      expect(run(0).status).toBe("NOMINAL");
      expect(run(1, fault, 0).trusted).toBe(false);
      expect(run(2, fault, 1).trusted).toBe(false);
      const after = [run(3), run(4), run(5), run(6)];
      expect(after.map((o) => o.status)).toEqual(["RECOVERING", "RECOVERING", "NOMINAL", "NOMINAL"]);
      expect(after.map((o) => o.trusted)).toEqual([false, false, true, true]);
      expect(after.map((o) => o.recoveryCount)).toEqual([1, 2, 0, 0]);
    },
  );

  it("restarts the recovery count if a fault recurs mid-recovery", () => {
    const m = new NavigationMonitor(build);
    const s = (step: number) => generateSample(step);
    m.process(s(0).expected, null);
    expect(m.process(s(1).expected, s(1).reading).status).toBe("RECOVERING");
    m.process(s(2).expected, null);
    expect(m.process(s(3).expected, s(3).reading).recoveryCount).toBe(1);
  });

  it("reset() clears latched faults", () => {
    const m = new NavigationMonitor(build);
    m.process({ x: 0, y: 0 }, null);
    m.reset();
    const s = generateSample(0);
    expect(m.process(s.expected, s.reading).status).toBe("NOMINAL");
  });
});

import { type ProcessorBuild, defaultBuild } from "./build";
import { type Point, isValidPoint, positionError } from "./geometry";

/** Maximum acceptable position error. error > 5.0 is out of tolerance; 5.00 is in. */
export const POSITION_TOLERANCE_M = 5.0;
/** Consecutive good readings needed after a fault before the fix is trusted again. */
export const RECOVERY_READINGS_REQUIRED = 3;

export type NavStatus =
  | "NOMINAL"
  | "RECOVERING"
  | "DEGRADED"
  | "SENSOR_FAULT"
  | "NO_DATA"
  | "INVALID_INPUT";

export type AlarmLevel = "OK" | "WARNING" | "ALARM";

export interface NavOutput {
  status: NavStatus;
  /** Whether the measured position may be presented as a reliable fix. */
  trusted: boolean;
  alarm: AlarmLevel;
  /** Computed error in metres, or null when it could not be computed. */
  positionError: number | null;
  measured: Point | null;
  lastKnownGood: Point | null;
  /** Good readings counted towards recovery (0…RECOVERY_READINGS_REQUIRED). */
  recoveryCount: number;
  message: string;
}

/**
 * Stateful monitor that decides whether each sensor reading can be trusted.
 * It never throws: any unexpected input is reported as INVALID_INPUT.
 */
export class NavigationMonitor {
  private build: ProcessorBuild;
  private readonly tolerance: number;
  private lastKnownGood: Point | null = null;
  private faultLatched = false;
  private recoveryCount = 0;

  constructor(build: ProcessorBuild = defaultBuild(), tolerance = POSITION_TOLERANCE_M) {
    this.build = build;
    this.tolerance = tolerance;
  }

  getBuild(): ProcessorBuild {
    return this.build;
  }

  setBuild(build: ProcessorBuild): void {
    this.build = build;
  }

  reset(): void {
    this.lastKnownGood = null;
    this.faultLatched = false;
    this.recoveryCount = 0;
  }

  process(expected: unknown, reading: unknown): NavOutput {
    try {
      return this.evaluate(expected, reading);
    } catch (err) {
      return this.fault("INVALID_INPUT", "WARNING", null, null, `Input rejected: ${String(err)}`);
    }
  }

  private evaluate(expected: unknown, reading: unknown): NavOutput {
    if (reading === null || reading === undefined) {
      return this.fault("NO_DATA", "WARNING", null, null, "No sensor reading received. Holding last known good fix.");
    }
    if (!isValidPoint(expected)) {
      return this.fault("INVALID_INPUT", "WARNING", null, null, "Reference (expected) position is invalid. Reading rejected.");
    }
    if (typeof reading !== "object") {
      return this.fault("INVALID_INPUT", "WARNING", null, null, "Malformed sensor reading. Rejected.");
    }

    const { position, health } = reading as Record<string, unknown>;

    if (health === "FAILED") {
      const measured = isValidPoint(position) ? { ...position } : null;
      return this.fault("SENSOR_FAULT", "ALARM", measured, null, "Sensor reports FAILED. Position data not trusted.");
    }
    if (health !== "OK") {
      return this.fault("INVALID_INPUT", "WARNING", null, null, "Unknown sensor health flag. Reading rejected.");
    }
    if (!isValidPoint(position)) {
      return this.fault(
        "INVALID_INPUT",
        "WARNING",
        null,
        null,
        "Invalid coordinates (non-numeric, non-finite or outside ±1000 m). Reading rejected.",
      );
    }

    const measured = { ...position };
    const error = positionError(expected, measured, this.build);
    if (!Number.isFinite(error)) {
      return this.fault("INVALID_INPUT", "WARNING", measured, null, "Position error could not be computed. Reading rejected.");
    }

    if (error > this.tolerance) {
      return this.fault(
        "DEGRADED",
        "ALARM",
        measured,
        error,
        `Position error ${error.toFixed(2)} m exceeds ${this.tolerance.toFixed(1)} m tolerance. Fix not trusted.`,
      );
    }

    if (this.faultLatched) {
      this.recoveryCount += 1;
      if (this.recoveryCount < RECOVERY_READINGS_REQUIRED) {
        return this.output("RECOVERING", false, "WARNING", measured, error,
          `Good reading ${this.recoveryCount}/${RECOVERY_READINGS_REQUIRED} after fault. Not yet trusted.`);
      }
      this.faultLatched = false;
    }

    this.recoveryCount = 0;
    this.lastKnownGood = { ...measured };
    return this.output("NOMINAL", true, "OK", measured, error, `Position error ${error.toFixed(2)} m within tolerance.`);
  }

  private fault(
    status: NavStatus,
    alarm: AlarmLevel,
    measured: Point | null,
    error: number | null,
    message: string,
  ): NavOutput {
    this.faultLatched = true;
    this.recoveryCount = 0;
    return this.output(status, false, alarm, measured, error, message);
  }

  private output(
    status: NavStatus,
    trusted: boolean,
    alarm: AlarmLevel,
    measured: Point | null,
    error: number | null,
    message: string,
  ): NavOutput {
    return {
      status,
      trusted,
      alarm,
      positionError: error,
      measured,
      lastKnownGood: this.lastKnownGood ? { ...this.lastKnownGood } : null,
      recoveryCount: this.recoveryCount,
      message,
    };
  }
}

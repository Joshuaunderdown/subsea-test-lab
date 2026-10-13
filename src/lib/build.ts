/**
 * Simulated "builds" of the navigation processor.
 *
 * The regression demo swaps between a verified baseline release and a release
 * candidate that contains a deliberately injected defect. Everything else in
 * the system is identical, so any test that changes outcome between the two
 * builds is detecting that defect.
 */

export interface ProcessorBuild {
  version: string;
  label: string;
  /** When true, positionError() uses the defective calculation. */
  defect: boolean;
  changeNote: string;
}

export const BASELINE_BUILD: ProcessorBuild = {
  version: "1.2.0",
  label: "Verified baseline",
  defect: false,
  changeNote: "Released build. Position error = Euclidean distance √(dx² + dy²).",
};

export const DEFECTIVE_BUILD: ProcessorBuild = {
  version: "1.3.0-rc1",
  label: "Release candidate (defect injected)",
  defect: true,
  changeNote:
    "Refactor of positionError() accidentally dropped the y component: error = |dx|. North-south errors become invisible.",
};

/**
 * Build used when none is specified. Returns the defective build when the
 * environment variable SUBSEA_INJECT_DEFECT=1, which is how `npm run test:defect`
 * proves the Vitest suite catches the defect.
 */
export function defaultBuild(): ProcessorBuild {
  try {
    if (typeof process !== "undefined" && process.env?.SUBSEA_INJECT_DEFECT === "1") {
      return DEFECTIVE_BUILD;
    }
  } catch {
    // process.env unavailable (e.g. browser) – fall through to baseline.
  }
  return BASELINE_BUILD;
}

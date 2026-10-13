/**
 * FICTIONAL demonstration requirements for this portfolio project.
 * These are NOT Sonardyne product specifications.
 */
import type { TestResult } from "./testSuite";

export type RequirementKind = "Verification" | "Validation";

export interface Requirement {
  id: string;
  kind: RequirementKind;
  text: string;
  testIds: string[];
}

export const REQUIREMENTS_DISCLAIMER =
  "Fictional demonstration requirements – not Sonardyne specifications.";

export const REQUIREMENTS: Requirement[] = [
  {
    id: "REQ-001",
    kind: "Verification",
    text: "Position error shall be the 2-D Euclidean distance between expected and measured position.",
    testIds: ["TC-04", "TC-06"],
  },
  {
    id: "REQ-002",
    kind: "Verification",
    text: "A valid fix with position error ≤ 5.0 m shall be reported NOMINAL and trusted.",
    testIds: ["TC-01", "TC-04"],
  },
  {
    id: "REQ-003",
    kind: "Verification",
    text: "A fix with position error > 5.0 m shall raise an ALARM and be marked untrusted.",
    testIds: ["TC-04", "TC-06"],
  },
  {
    id: "REQ-004",
    kind: "Validation",
    text: "Missing readings shall be handled without crashing and never shown as a current trusted fix; the last known good fix is retained.",
    testIds: ["TC-02"],
  },
  {
    id: "REQ-005",
    kind: "Verification",
    text: "Invalid coordinates (non-numeric, non-finite or outside ±1000 m) shall be rejected.",
    testIds: ["TC-03"],
  },
  {
    id: "REQ-006",
    kind: "Validation",
    text: "A sensor reporting failure shall raise an ALARM and its position shall not be trusted.",
    testIds: ["TC-05"],
  },
  {
    id: "REQ-007",
    kind: "Validation",
    text: "After a fault clears, 3 consecutive good readings are required before the fix is trusted again.",
    testIds: ["TC-07", "TC-06"],
  },
];

export type TraceStatus = "PASS" | "FAIL" | "NOT RUN";

export interface TraceRow extends Requirement {
  status: TraceStatus;
  failingTests: string[];
}

/** Links each requirement to the latest results of its tests. */
export function traceability(results: TestResult[] | null | undefined): TraceRow[] {
  return REQUIREMENTS.map((req) => {
    const linked = (results ?? []).filter((r) => req.testIds.includes(r.id));
    const failingTests = linked.filter((r) => r.status === "FAIL").map((r) => r.id);
    const status: TraceStatus =
      linked.length === 0 ? "NOT RUN" : failingTests.length > 0 ? "FAIL" : "PASS";
    return { ...req, status, failingTests };
  });
}

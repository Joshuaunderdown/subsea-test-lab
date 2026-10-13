import { REQUIREMENTS_DISCLAIMER, traceability } from "@/lib/requirements";
import type { TestResult } from "@/lib/testSuite";
import { ResultChip } from "./ui";

export function TraceabilityTable({ results }: { results: TestResult[] | null }) {
  const rows = traceability(results);
  return (
    <div>
      <p className="mb-3 rounded-md bg-warn/10 px-3 py-2 text-xs text-warn ring-1 ring-warn/30">{REQUIREMENTS_DISCLAIMER}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-navy-700 text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-2 font-medium">Req</th>
              <th className="py-2 pr-2 font-medium">Requirement</th>
              <th className="py-2 font-medium">Tests / result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-navy-800 align-top">
                <td className="py-2.5 pr-2">
                  <div className="font-mono text-xs text-accent">{r.id}</div>
                  <div className={`mt-1 text-[10px] uppercase tracking-wide ${r.kind === "Validation" ? "text-violet-300" : "text-sky-300"}`}>
                    {r.kind === "Validation" ? "Valid." : "Verif."}
                  </div>
                </td>
                <td className="py-2.5 pr-2 text-slate-200">{r.text}</td>
                <td className="py-2.5">
                  <div className="mb-1 font-mono text-xs text-slate-300">
                    {r.testIds.map((t) => (
                      <span key={t} className={`mr-1 inline-block ${r.failingTests.includes(t) ? "text-fail" : ""}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <ResultChip status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

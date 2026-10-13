"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

const CONCEPTS = [
  ["Functional testing", "7 automated test cases run against the real navigation logic"],
  ["Verification vs validation", "requirements met vs fit for intended use"],
  ["Fault injection", "sensor failure, missing readings, excessive error"],
  ["Boundary-value testing", "5.00 m in tolerance, 5.01 m out"],
  ["Regression testing", "golden-baseline comparison catches an injected defect"],
  ["Integration testing", "simulator, monitor and test suite exercised end to end"],
  ["Requirements traceability", "every requirement linked to tests and results"],
  ["CI", "GitHub Actions runs the Vitest suite and proves it fails on the defective build"],
];

function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host.startsWith("127.") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.endsWith(".local")
    );
  } catch {
    return true;
  }
}

export default function InfoSheet() {
  const [url, setUrl] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const target = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, "") + "/";
    setUrl(target);
    QRCode.toString(target, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#050f22", light: "#ffffff" } })
      .then(setSvg)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  const local = url ? isLocalUrl(url) : false;

  return (
    <div className="min-h-dvh bg-white">
    <main className="mx-auto max-w-2xl px-6 py-10 text-navy-950 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href="/" className="text-sm text-navy-600 underline">← Back to dashboard</Link>
        <button type="button" onClick={() => window.print()} className="min-h-11 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white">
          Print
        </button>
      </div>

      {local && (
        <p className="mb-6 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden">
          This QR code points to <strong>{url}</strong>, which a phone can&apos;t reach. Open this page on the deployed
          HTTPS URL (or set NEXT_PUBLIC_APP_URL) before printing.
        </p>
      )}

      <p className="font-mono text-xs uppercase tracking-widest text-cyan-700">Software validation portfolio project</p>
      <h1 className="mt-1 text-4xl font-bold tracking-tight">
        Subsea <span className="text-cyan-600">Test Lab</span>
      </h1>
      <p className="mt-3 text-lg text-slate-700">
        An interactive web demo of a simulated underwater navigation system, where you can inject faults and code defects and
        watch an automated test suite detect them.
      </p>

      <div className="mt-8 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="w-56 shrink-0 rounded-xl border-2 border-navy-900 p-3">
          {svg ? (
            // eslint-disable-next-line react/no-danger -- SVG generated locally by the qrcode library
            <div aria-label={`QR code linking to ${url}`} role="img" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="flex aspect-square items-center justify-center text-sm text-slate-500">{error ?? "Generating…"}</div>
          )}
          <p className="mt-2 break-all text-center font-mono text-[11px] text-slate-600">{url}</p>
        </div>
        <div>
          <p className="mb-2 font-semibold">Scan to open on your phone. No install or login needed.</p>
          <h2 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Testing concepts demonstrated</h2>
          <ul className="space-y-1.5 text-sm">
            {CONCEPTS.map(([name, detail]) => (
              <li key={name}>
                <span className="font-semibold">{name}</span>
                <span className="text-slate-600">: {detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
        Next.js · TypeScript · Tailwind CSS · Vitest · GitHub Actions · Vercel. All data is simulated. This is a personal
        portfolio project and does not represent Sonardyne technology or specifications.
      </p>
    </main>
    </div>
  );
}

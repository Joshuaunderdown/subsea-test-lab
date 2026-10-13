import type { Point } from "@/lib/geometry";
import { type NavStatus, POSITION_TOLERANCE_M } from "@/lib/navigation";
import { plannedPosition } from "@/lib/simulation";
import { STATUS_COLOR } from "./ui";

export interface TrailPoint {
  step: number;
  expected: Point;
  measured: Point | null;
  status: NavStatus;
}

const VIEW_X = 210;
const VIEW_Y = 115;
const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));

// Full figure-of-eight; its period is 2π / 0.05 ≈ 126 steps.
const TRACK_PATH = Array.from({ length: 127 }, (_, t) => {
  const p = plannedPosition(t);
  return `${t === 0 ? "M" : "L"}${p.x.toFixed(1)},${(-p.y).toFixed(1)}`;
}).join(" ");

/** Overview of the survey area (north up, metres). */
export function TrackPlot({ trail, current }: { trail: TrailPoint[]; current: TrailPoint | null }) {
  const grid = [-200, -150, -100, -50, 0, 50, 100, 150, 200];
  return (
    <svg
      viewBox={`${-VIEW_X} ${-VIEW_Y} ${VIEW_X * 2} ${VIEW_Y * 2}`}
      className="h-auto w-full rounded-lg bg-navy-950"
      role="img"
      aria-label="Simulated vehicle track: planned path, measured positions and current vehicle position"
    >
      {grid.map((g) => (
        <line key={`v${g}`} x1={g} x2={g} y1={-VIEW_Y} y2={VIEW_Y} stroke="#163668" strokeWidth={g === 0 ? 0.8 : 0.4} />
      ))}
      {grid.filter((g) => Math.abs(g) < VIEW_Y).map((g) => (
        <line key={`h${g}`} y1={g} y2={g} x1={-VIEW_X} x2={VIEW_X} stroke="#163668" strokeWidth={g === 0 ? 0.8 : 0.4} />
      ))}
      <path d={TRACK_PATH} fill="none" stroke="#5b7bb0" strokeWidth={1} strokeDasharray="3 3" />

      {trail.map((t, i) =>
        t.measured ? (
          <circle
            key={t.step}
            cx={clamp(t.measured.x, VIEW_X - 2)}
            cy={clamp(-t.measured.y, VIEW_Y - 2)}
            r={1.8}
            fill={STATUS_COLOR[t.status]}
            opacity={0.25 + (0.6 * i) / Math.max(trail.length, 1)}
          />
        ) : null,
      )}

      {current && (
        <g>
          <circle cx={current.expected.x} cy={-current.expected.y} r={6} fill="none" stroke="#fff" strokeWidth={1.2} />
          <line x1={current.expected.x - 9} x2={current.expected.x + 9} y1={-current.expected.y} y2={-current.expected.y} stroke="#fff" strokeWidth={0.8} />
          <line y1={-current.expected.y - 9} y2={-current.expected.y + 9} x1={current.expected.x} x2={current.expected.x} stroke="#fff" strokeWidth={0.8} />
          {current.measured && (
            <>
              <line
                x1={current.expected.x}
                y1={-current.expected.y}
                x2={clamp(current.measured.x, VIEW_X - 4)}
                y2={clamp(-current.measured.y, VIEW_Y - 4)}
                stroke={STATUS_COLOR[current.status]}
                strokeWidth={1}
              />
              <circle
                cx={clamp(current.measured.x, VIEW_X - 4)}
                cy={clamp(-current.measured.y, VIEW_Y - 4)}
                r={4.5}
                fill={STATUS_COLOR[current.status]}
                stroke="#050f22"
                strokeWidth={1.2}
              />
            </>
          )}
        </g>
      )}

      <text x={-VIEW_X + 6} y={-VIEW_Y + 14} fill="#22d3ee" fontSize={10} fontFamily="monospace">N ↑</text>
      <text x={VIEW_X - 6} y={VIEW_Y - 6} fill="#8aa0c8" fontSize={8} fontFamily="monospace" textAnchor="end">grid 50 m · SIMULATED</text>
    </svg>
  );
}

const SCOPE = 15;

/** Zoomed view centred on the planned position, showing the 5 m tolerance circle. */
export function ErrorScope({ current }: { current: TrailPoint | null }) {
  const off = current?.measured
    ? { x: current.measured.x - current.expected.x, y: current.measured.y - current.expected.y }
    : null;
  const dist = off ? Math.hypot(off.x, off.y) : 0;
  const outside = dist > SCOPE - 1;
  const shown = off && outside ? { x: (off.x / dist) * (SCOPE - 1.2), y: (off.y / dist) * (SCOPE - 1.2) } : off;
  const color = current ? STATUS_COLOR[current.status] : "#8aa0c8";

  return (
    <svg
      viewBox={`${-SCOPE} ${-SCOPE} ${SCOPE * 2} ${SCOPE * 2}`}
      className="aspect-square h-auto w-full rounded-lg bg-navy-950"
      role="img"
      aria-label={`Error scope: measured position offset ${dist.toFixed(1)} metres from planned position; tolerance circle ${POSITION_TOLERANCE_M} metres`}
    >
      {[10, 15].map((r) => (
        <circle key={r} r={r} fill="none" stroke="#163668" strokeWidth={0.15} />
      ))}
      <line x1={-SCOPE} x2={SCOPE} y1={0} y2={0} stroke="#163668" strokeWidth={0.15} />
      <line y1={-SCOPE} y2={SCOPE} x1={0} x2={0} stroke="#163668" strokeWidth={0.15} />
      <circle r={POSITION_TOLERANCE_M} fill="#22d3ee" fillOpacity={0.07} stroke="#22d3ee" strokeWidth={0.25} strokeDasharray="0.8 0.5" />
      <text x={3.7} y={-3.9} fill="#22d3ee" fontSize={1.5} fontFamily="monospace">5 m</text>
      <text x={0} y={-SCOPE + 1.8} fill="#22d3ee" fontSize={1.6} fontFamily="monospace" textAnchor="middle">N</text>
      <circle r={0.5} fill="#fff" />

      {shown && (
        <>
          <line x1={0} y1={0} x2={shown.x} y2={-shown.y} stroke={color} strokeWidth={0.25} />
          <circle cx={shown.x} cy={-shown.y} r={0.9} fill={color} stroke="#050f22" strokeWidth={0.2} />
          {outside && (
            <text x={clamp(shown.x, SCOPE - 4)} y={clamp(-shown.y + 2.6, SCOPE - 1)} fill={color} fontSize={1.6} fontFamily="monospace" textAnchor="middle">
              {dist.toFixed(1)} m →
            </text>
          )}
        </>
      )}
      {!shown && (
        <text x={0} y={8.5} fill={color} fontSize={1.6} fontFamily="monospace" textAnchor="middle">
          no valid fix
        </text>
      )}
      <text x={SCOPE - 0.8} y={SCOPE - 0.8} fill="#8aa0c8" fontSize={1.2} fontFamily="monospace" textAnchor="end">±15 m</text>
    </svg>
  );
}

/**
 * TickChart — visualizes inter-tick durations over time.
 *
 * For each consecutive pair of entries, plots a point at
 * `(entry.tick, entry.tick - prev.tick)`:
 *   - X axis: absolute tick time (ms)
 *   - Y axis: gap since previous tick (ms)
 *
 * The first entry has no previous tick and is not plotted, so an `entries`
 * array of length N produces N - 1 points. Caller is responsible for
 * passing entries sorted by `tick` ascending; no internal sorting is done.
 *
 * Edge cases:
 *   - 0 or 1 entries → empty state placeholder.
 *   - All ticks equal → flat line at y=0 (yMax falls back to 1).
 *
 * @param {Object} props
 * @param {Array<{tick: number, id: string}>} props.entries
 *   Up to 200 entries. Each entry needs `tick` (ms) and `id` (string, used as React key).
 * @param {number} [props.width=600]   SVG width in pixels.
 * @param {number} [props.height=300]  SVG height in pixels.
 */
import { useEffect, useMemo, useState } from "yract";
import { useInView } from "../../../hooks/useInView";

type TickChartProps = {
  width?: number;
  height?: number;
  start: number;
};

type Tick = { id: string; tick: number };
export function* TickChart({ width = 1080, height = 300, start }: TickChartProps) {
  const [ref, inView] = yield* useInView<SVGSVGElement>();
  const [entries, setEntries] = yield* useState<Tick[]>(() => [{ id: "a", tick: Date.now() }]);
  yield* useEffect(() => {
    if (!inView) return;
    let buffer: Tick[] = [];
    function addTick() {
      buffer.push({ id: `${Math.random()}`, tick: Date.now() });
    }

    const addTicksHandle = setInterval(addTick, 50);
    const updateStateHandle = setInterval(() => {
      void setEntries((prevEntries) => {
        const nextEntries = [...prevEntries, ...buffer].slice(
          Math.max(0, prevEntries.length - 150),
        );
        buffer = [];
        return nextEntries;
      });
    }, 1000);
    return () => {
      clearInterval(addTicksHandle);
      clearInterval(updateStateHandle);
    };
  }, [inView]);
  const points = yield* useMemo(() => {
    if (entries.length < 2) return [];
    const out = [];
    for (let i = 1; i < entries.length; i++) {
      out.push({
        tick: Math.round((entries[i].tick - start) / 100) / 10,
        delta: entries[i].tick - entries[i - 1].tick,
        id: entries[i].id,
      });
    }
    return out;
  }, [entries, start]);

  if (points.length === 0) {
    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ maxWidth: `${width}px`, height: "auto" }}
        role="img"
        aria-label="No tick data"
      >
        <text x={width / 2} y={height / 2} textAnchor="middle" fill="#888" fontSize="14">
          Need at least 2 entries to render
        </text>
      </svg>
    );
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 55 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const xMin = points[0].tick;
  const xMax = points[points.length - 1].tick;
  const xRange = xMax - xMin || 1;
  const rawYMax = Math.max(...points.map((p) => p.delta));
  const yMax = rawYMax === 0 ? 1 : rawYMax * 1.1; // 10% headroom

  const xScale = (t: number) => padding.left + ((t - xMin) / xRange) * innerW;
  const yScale = (d: number) => padding.top + innerH - (d / yMax) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.tick)} ${yScale(p.delta)}`)
    .join(" ");

  const yTickCount = 5;
  const yTickValues = Array.from({ length: yTickCount + 1 }, (_, i) => (yMax * i) / yTickCount);
  const xTickCount = 5;
  const xTickValues = Array.from(
    { length: xTickCount + 1 },
    (_, i) => xMin + (xRange * i) / xTickCount,
  );

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: `${width}px`, height: "auto" }}
      role="img"
      aria-label="Tick duration chart"
    >
      {/* Y gridlines + labels */}
      {yTickValues.map((v, i) => (
        <g key={`y-${i}`}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={yScale(v)}
            y2={yScale(v)}
            stroke="#eee"
          />
          <text x={padding.left - 8} y={yScale(v) + 4} textAnchor="end" fontSize="16" fill="#666">
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* X axis labels */}
      {xTickValues.map((v, i) => (
        <text
          key={`x-${i}`}
          x={xScale(v)}
          y={height - padding.bottom + 18}
          textAnchor="middle"
          fontSize="16"
          fill="#666"
        >
          {v.toFixed(0)}
        </text>
      ))}

      {/* Axes */}
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={height - padding.bottom}
        stroke="#333"
      />
      <line
        x1={padding.left}
        y1={height - padding.bottom}
        x2={width - padding.right}
        y2={height - padding.bottom}
        stroke="#333"
      />

      {/* Data line + dots */}
      <path d={path} fill="none" stroke="#7c3aed" strokeWidth="1.5" />
      {points.map((p) => (
        <circle key={p.id} cx={xScale(p.tick)} cy={yScale(p.delta)} r="2.5" fill="#7c3aed">
          <title>{`${p.id}: ${p.delta.toFixed(2)}ms @ ${p.tick.toFixed(0)}ms`}</title>
        </circle>
      ))}
    </svg>
  );
}

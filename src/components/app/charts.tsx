/**
 * The charts this console needs, as inline SVG.
 *
 * No charting library. Four chart types do not justify a dependency the size of
 * recharts, and hand-drawing them is what lets the marks follow the design
 * system's own specs — hairline solid grid, 2px lines, 2px gaps between touching
 * fills, values written rather than left to a tooltip.
 *
 * ## Colour is never the only channel
 *
 * The design draws two donuts, and donuts are the shape where colour-coding most
 * often becomes the *only* way to read a value. Two of the pairs here are the
 * classic confusion cases: `--success` (#22c55e) against `--destructive`
 * (#ef4444) separates poorly under protanopia, and `--inactive` (#9ca3af) against
 * `--muted-foreground` reads as one grey.
 *
 * The tokens stay as they are — they are the design system's status colours and
 * `<StatusBadge>` uses them, so changing them here would make one status two
 * different colours on the same screen. What changes is that every slice is named,
 * counted and given its share in an adjacent legend, and the whole chart carries an
 * `aria-label` that states the same figures. A reader who cannot separate the hues
 * at all still gets every number. (The tenant app made the stronger move of
 * replacing a donut with a stacked bar; there the legend was the only fix
 * available, because that chart had no room for one.)
 */

import { useEffect, useRef, useState } from "react";

import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The container's pixel width, so coordinates can be computed in real pixels.
 *
 * A fixed `viewBox` scaled with `h-auto` would be less code, but it scales the text
 * and the hairlines too — axis labels end up at 6px on a phone. Measuring keeps
 * 1px hairlines at 1px and 11px text at 11px on every screen.
 */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    setWidth(element.clientWidth);

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

/** Round a maximum up to a clean axis top (1,000 / 2,500 / 5,000…). */
function niceCeiling(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

/**
 * How many x labels to skip so they don't collide.
 *
 * A 90-day range has 90 points; drawing 90 date labels in 600px overlaps into an
 * unreadable smear. Roughly seven labels is what fits at every breakpoint this app
 * supports, and the first and last are always among them.
 */
function labelStride(count: number, width: number): number {
  const perLabel = width < 480 ? 56 : 78;
  const affordable = Math.max(2, Math.floor(width / perLabel));
  return Math.max(1, Math.ceil(count / affordable));
}

export type ChartPoint = { label: string; value: number };

const PLOT_HEIGHT = 150;
/** Reserved below the plot for the x labels, so they are never clipped. */
const AXIS_BAND = 22;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 14;

// ------------------------------------------------------------- line chart

/**
 * A single series over time: 2px line, a 10%-opacity wash beneath it, hairline
 * gridlines, and the value written at whichever point is active — defaulting to the
 * last, so the chart always shows a number without being hovered.
 *
 * One series means no legend box; the panel heading says what is plotted. Hover and
 * keyboard focus both reveal a per-point value, and because the axis and the end
 * label are always drawn, no value is reachable *only* by hovering.
 */
export function LineChart({
  points,
  className,
  valuePrefix = "",
  ariaLabel,
}: {
  points: ChartPoint[];
  className?: string;
  valuePrefix?: string;
  ariaLabel?: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const height = PLOT_HEIGHT + AXIS_BAND;
  const plotWidth = Math.max(width - PAD_LEFT - PAD_RIGHT, 0);
  const plotHeight = PLOT_HEIGHT - PAD_TOP;

  const max = niceCeiling(Math.max(...points.map((point) => point.value), 0));
  const ticks = [0, max / 2, max];
  const stride = labelStride(points.length, plotWidth || 1);

  const xFor = (index: number) =>
    PAD_LEFT + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const yFor = (value: number) => PAD_TOP + plotHeight - (value / max) * plotHeight;

  const line = points.map((point, index) => `${xFor(index)},${yFor(point.value)}`).join(" ");
  const area =
    points.length > 0
      ? `${xFor(0)},${PAD_TOP + plotHeight} ${line} ${xFor(points.length - 1)},${PAD_TOP + plotHeight}`
      : "";

  const shown = active ?? points.length - 1;
  const bandWidth = Math.max(plotWidth / Math.max(points.length, 1), 8);

  return (
    <div className={cn("relative", className)}>
      <div ref={ref}>
        {width > 0 && points.length > 0 ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={
              ariaLabel ??
              `Trend: ${points.map((point) => `${point.label} ${point.value}`).join(", ")}`
            }
            onMouseLeave={() => setActive(null)}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD_LEFT}
                  x2={PAD_LEFT + plotWidth}
                  y1={yFor(tick)}
                  y2={yFor(tick)}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                <text
                  x={PAD_LEFT - 8}
                  y={yFor(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {formatCompact(Math.round(tick))}
                </text>
              </g>
            ))}

            {area ? <polyline points={area} fill="var(--primary)" fillOpacity={0.1} /> : null}

            <polyline
              points={line}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((point, index) => {
              const labelled = index % stride === 0 || index === points.length - 1;
              return (
                <g key={`${point.label}-${index}`}>
                  {/* Hit target far larger than the dot — a 4px marker is
                      impossible to land on, so the band owns the hover. */}
                  <rect
                    x={xFor(index) - bandWidth / 2}
                    y={PAD_TOP}
                    width={bandWidth}
                    height={plotHeight}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${point.label}: ${valuePrefix}${point.value.toLocaleString("en-KE")}`}
                    onMouseEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                  />
                  {index === shown ? (
                    <circle
                      cx={xFor(index)}
                      cy={yFor(point.value)}
                      r={4}
                      fill="var(--primary)"
                      stroke="var(--card)"
                      strokeWidth={2}
                    />
                  ) : null}
                  {labelled ? (
                    <text
                      x={xFor(index)}
                      y={height - 6}
                      textAnchor="middle"
                      className={cn(
                        "text-[11px]",
                        index === shown ? "fill-foreground font-medium" : "fill-muted-foreground",
                      )}
                    >
                      {point.label}
                    </text>
                  ) : null}
                </g>
              );
            })}

            <text
              x={Math.min(Math.max(xFor(shown), PAD_LEFT + 22), PAD_LEFT + plotWidth - 22)}
              y={Math.max(yFor(points[shown].value) - 12, 12)}
              textAnchor="middle"
              className="fill-foreground text-[12px] font-semibold tabular-nums"
            >
              {valuePrefix}
              {points[shown].value.toLocaleString("en-KE")}
            </text>
          </svg>
        ) : (
          <div style={{ height }} />
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- bar chart

/**
 * Vertical bars over time, for revenue.
 *
 * Bars rather than a line because revenue is a sum over a bucket, not a reading at
 * an instant — a line implies you could interpolate between two days, which is not
 * a meaningful thing to do with a day's takings.
 */
export function BarChart({
  points,
  className,
  valuePrefix = "",
  ariaLabel,
}: {
  points: ChartPoint[];
  className?: string;
  valuePrefix?: string;
  ariaLabel?: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const height = PLOT_HEIGHT + AXIS_BAND;
  const plotWidth = Math.max(width - PAD_LEFT - PAD_RIGHT, 0);
  const plotHeight = PLOT_HEIGHT - PAD_TOP;

  const max = niceCeiling(Math.max(...points.map((point) => point.value), 0));
  const ticks = [0, max / 2, max];
  const stride = labelStride(points.length, plotWidth || 1);

  const slot = plotWidth / Math.max(points.length, 1);
  // Bars keep a visible gap until the slot gets tight, at which point the gap
  // shrinks rather than the bar disappearing.
  const barWidth = Math.max(Math.min(slot - 4, 28), 2);
  const baseline = PAD_TOP + plotHeight;

  const shown = active ?? points.length - 1;

  return (
    <div className={cn("relative", className)}>
      <div ref={ref}>
        {width > 0 && points.length > 0 ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={
              ariaLabel ??
              `Revenue by day: ${points
                .map((point) => `${point.label} ${valuePrefix}${point.value}`)
                .join(", ")}`
            }
            onMouseLeave={() => setActive(null)}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD_LEFT}
                  x2={PAD_LEFT + plotWidth}
                  y1={baseline - (tick / max) * plotHeight}
                  y2={baseline - (tick / max) * plotHeight}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                <text
                  x={PAD_LEFT - 8}
                  y={baseline - (tick / max) * plotHeight}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {formatCompact(Math.round(tick))}
                </text>
              </g>
            ))}

            {points.map((point, index) => {
              const barHeight = max > 0 ? (point.value / max) * plotHeight : 0;
              const x = PAD_LEFT + index * slot + (slot - barWidth) / 2;
              const labelled = index % stride === 0 || index === points.length - 1;

              return (
                <g key={`${point.label}-${index}`}>
                  <rect
                    x={x}
                    y={baseline - barHeight}
                    width={barWidth}
                    height={Math.max(barHeight, 1)}
                    rx={Math.min(3, barWidth / 2)}
                    fill={index === shown ? "var(--primary)" : "var(--primary-mid)"}
                    fillOpacity={index === shown ? 1 : 0.7}
                  />
                  {/* Full-slot hit target: a 2px bar on a 90-day range cannot be
                      hovered, but its column can. */}
                  <rect
                    x={PAD_LEFT + index * slot}
                    y={PAD_TOP}
                    width={Math.max(slot, 6)}
                    height={plotHeight}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${point.label}: ${valuePrefix}${point.value.toLocaleString("en-KE")}`}
                    onMouseEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                  />
                  {labelled ? (
                    <text
                      x={x + barWidth / 2}
                      y={height - 6}
                      textAnchor="middle"
                      className={cn(
                        "text-[11px]",
                        index === shown ? "fill-foreground font-medium" : "fill-muted-foreground",
                      )}
                    >
                      {point.label}
                    </text>
                  ) : null}
                </g>
              );
            })}

            <text
              x={Math.min(
                Math.max(PAD_LEFT + shown * slot + slot / 2, PAD_LEFT + 30),
                PAD_LEFT + plotWidth - 30,
              )}
              y={Math.max(baseline - (points[shown].value / max) * plotHeight - 8, 11)}
              textAnchor="middle"
              className="fill-foreground text-[12px] font-semibold tabular-nums"
            >
              {valuePrefix}
              {formatCompact(points[shown].value)}
            </text>
          </svg>
        ) : (
          <div style={{ height }} />
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- donut

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  /** A CSS colour — pass a token, e.g. `var(--success)`. */
  color: string;
};

const DONUT_SIZE = 168;
const DONUT_THICKNESS = 22;
/** Degrees of blank between arcs, so touching slices stay distinct. */
const DONUT_GAP_DEGREES = 2;

/**
 * Part-to-whole as a ring, with the total in the middle and a legend that repeats
 * every figure. See the header for why the legend is not optional.
 *
 * Arcs are drawn with `stroke-dasharray` on a circle rather than as wedge paths:
 * the gap between slices then falls out of the dash pattern instead of needing
 * trigonometry per corner, and a slice of any size keeps a constant ring width.
 */
export function DonutChart({
  slices,
  centreValue,
  centreLabel,
  formatValue = (value) => value.toLocaleString("en-KE"),
  className,
}: {
  slices: DonutSlice[];
  /** Overrides the total in the middle — e.g. a share rather than a count. */
  centreValue?: string;
  centreLabel?: string;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = (DONUT_SIZE - DONUT_THICKNESS) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = (DONUT_GAP_DEGREES / 360) * circumference;

  let offset = 0;

  return (
    <div
      className={cn("flex flex-col items-center gap-5 sm:flex-row sm:items-center", className)}
    >
      <div className="relative shrink-0" style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
        <svg
          width={DONUT_SIZE}
          height={DONUT_SIZE}
          role="img"
          aria-label={
            total === 0
              ? "No data yet"
              : slices
                  .map(
                    (slice) =>
                      `${slice.label}: ${formatValue(slice.value)} (${((slice.value / total) * 100).toFixed(1)}%)`,
                  )
                  .join(", ")
          }
        >
          <g transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}>
            <circle
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={radius}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={DONUT_THICKNESS}
            />
            {total > 0
              ? slices.map((slice) => {
                  const length = (slice.value / total) * circumference;
                  // Never let the gap eat a whole small slice — a 0.4% share must
                  // still leave a visible mark.
                  const dash = Math.max(length - gap, Math.min(length, 1.5));
                  const dashOffset = -offset;
                  offset += length;

                  return (
                    <circle
                      key={slice.key}
                      cx={DONUT_SIZE / 2}
                      cy={DONUT_SIZE / 2}
                      r={radius}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={DONUT_THICKNESS}
                      strokeDasharray={`${dash} ${circumference - dash}`}
                      strokeDashoffset={dashOffset}
                      strokeLinecap="butt"
                    />
                  );
                })
              : null}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[20px] leading-tight font-semibold text-foreground">
            {centreValue ?? formatValue(total)}
          </span>
          {centreLabel ? (
            <span className="mt-0.5 text-caption text-muted-foreground">{centreLabel}</span>
          ) : null}
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-2.5">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2.5 text-body-sm">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <span className="min-w-0 truncate text-foreground">{slice.label}</span>
            <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
              {formatValue(slice.value)}
              {total > 0 ? ` · ${((slice.value / total) * 100).toFixed(1)}%` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------- ranked bars

/**
 * A ranked list with a proportional bar behind each row — the "top areas" panel.
 *
 * The bar is scaled against the leader rather than the total: this is a comparison
 * between areas, not a part-to-whole, and dividing by the sum would flatten every
 * bar into a stub once there are more than a handful of rows.
 */
export function RankedBars({
  rows,
  className,
}: {
  rows: { key: string; label: string; caption?: string; value: number; valueLabel: string }[];
  className?: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ol className={cn("space-y-3.5", className)}>
      {rows.map((row, index) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="w-4 shrink-0 text-caption tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span className="truncate text-body-sm font-medium text-foreground">{row.label}</span>
              {row.caption ? (
                <span className="hidden truncate text-caption text-muted-foreground sm:inline">
                  {row.caption}
                </span>
              ) : null}
            </div>
            <span className="shrink-0 text-body-sm tabular-nums text-muted-foreground">
              {row.valueLabel}
            </span>
          </div>
          <div className="mt-1.5 ml-6 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max((row.value / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

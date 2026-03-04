import { useCallback, useEffect, useRef, useState } from "react";

interface SparklineProps {
  values: number[];
  timestamps: number[];
  height?: number;
  yRange?: { min: number; max: number };
  syncTimestamp?: number | null;
  onSyncTimestamp?: (ts: number | null) => void;
  isVisible?: boolean;
}

type TooltipState = { index: number; x: number; y: number } | null;

function computeYBounds(values: number[], yRange?: { min: number; max: number }) {
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.12, 1);
  const min = yRange ? yRange.min : Math.max(0, rawMin - padding);
  const max = yRange ? yRange.max : rawMax + padding;
  return { min, max, range: max - min || 1 };
}

function getTrend(values: number[]) {
  const first = values[0];
  const last  = values[values.length - 1];
  if (last > first * 1.02) return "up";
  if (last < first * 0.98) return "down";
  return "flat";
}

const COLORS = {
  up:   { stroke: "rgb(34 197 94)",   fill: "rgba(34,197,94,0.18)"   },
  down: { stroke: "rgb(59 130 246)",  fill: "rgba(59,130,246,0.18)"  },
  flat: { stroke: "rgb(148 163 184)", fill: "rgba(148,163,184,0.15)" },
};

export function Sparkline({
  values,
  timestamps,
  height = 80,
  yRange,
  syncTimestamp,
  onSyncTimestamp,
  isVisible = true,
}: SparklineProps) {
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  // Cached base chart pixels — restored before each hover-dot draw so we
  // never re-run the full chart render on every mouse move.
  const baseImageRef = useRef<ImageData | null>(null);
  const rafRef       = useRef<number | null>(null);
  const [tooltip, setTooltip]       = useState<TooltipState>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);

  // Prevent both vertical and horizontal scroll while the pointer is over the canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => e.preventDefault();
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // Track canvas CSS width via ResizeObserver.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => setCanvasWidth(canvas.clientWidth);
    resize();
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setCanvasWidth(entry.contentRect.width);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Draw the base chart (line + fill, no hover dot) and cache it as ImageData.
  // This only re-runs when data or canvas dimensions change — NOT on hover.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || values.length < 2 || canvasWidth === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr   = window.devicePixelRatio || 1;
    const width = canvasWidth;

    canvas.width  = width  * dpr;
    canvas.height = height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const { min, range } = computeYBounds(values, yRange);
    const color = COLORS[getTrend(values)];

    ctx.beginPath();
    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      if (i === 0) ctx.moveTo(x, y);
      else         ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = color.fill;
    ctx.fill();

    // Cache the base pixels so each hover-dot draw is a cheap putImageData.
    baseImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, [values, height, canvasWidth, yRange]);

  // Draw a single hover dot directly on canvas — bypasses React render cycle.
  const drawHoverDot = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const base   = baseImageRef.current;
    if (!canvas || !base || values.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr   = window.devicePixelRatio || 1;
    const width = canvasWidth;

    ctx.putImageData(base, 0, 0); // restore base pixels (cheap memcpy)

    const { min, range } = computeYBounds(values, yRange);
    const color = COLORS[getTrend(values)];
    const x     = (index / (values.length - 1)) * width;
    const y     = height - ((values[index] - min) / range) * height;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color.stroke;
    ctx.fill();
  }, [values, height, canvasWidth, yRange]);

  const clearHoverDot = useCallback(() => {
    const canvas = canvasRef.current;
    const base   = baseImageRef.current;
    if (!canvas || !base) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(base, 0, 0);
  }, []);

  const onMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (values.length === 0) return;

    const rect  = e.currentTarget.getBoundingClientRect();
    const x     = e.clientX - rect.left;
    const y     = e.clientY - rect.top;
    const index = Math.max(0, Math.min(values.length - 1,
      Math.round((x / rect.width) * (values.length - 1))
    ));

    // Schedule dot draw via RAF — no React re-render.
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      drawHoverDot(index);
      rafRef.current = null;
    });

    // Update tooltip only when the snapped index changes (minimises re-renders).
    setTooltip((prev) => (prev?.index === index ? prev : { index, x, y }));

    if (onSyncTimestamp && isVisible) {
      onSyncTimestamp(timestamps[index] ?? null);
    }
  }, [values, timestamps, isVisible, onSyncTimestamp, drawHoverDot]);

  const onLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    clearHoverDot();
    setTooltip(null);
    onSyncTimestamp?.(null);
  }, [clearHoverDot, onSyncTimestamp]);

  // Handle an external sync timestamp (hover on a sibling card).
  useEffect(() => {
    if (syncTimestamp == null) {
      clearHoverDot();
      const t = setTimeout(() => setTooltip(null), 0);
      return () => clearTimeout(t);
    }
    if (!isVisible || !timestamps.length || canvasWidth === 0 || values.length < 2) return;

    let bestIdx  = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < timestamps.length; i++) {
      const diff = Math.abs((timestamps[i] ?? 0) - syncTimestamp);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    }

    const idx = Math.max(0, Math.min(values.length - 1, bestIdx));
    const { min, range } = computeYBounds(values, yRange);
    const x = (idx / (values.length - 1)) * canvasWidth;
    const y = height - ((values[idx] - min) / range) * height;

    drawHoverDot(idx);
    const t = setTimeout(() => setTooltip((prev) => (prev?.index === idx ? prev : { index: idx, x, y })), 0);
    return () => clearTimeout(t);
  }, [syncTimestamp, isVisible, timestamps, values, canvasWidth, height, yRange, drawHoverDot, clearHoverDot]);

  const showTooltip =
    isVisible &&
    tooltip !== null &&
    tooltip.index >= 0 &&
    tooltip.index < values.length &&
    typeof values[tooltip.index] === "number";

  const hoveredValue     = showTooltip ? values[tooltip!.index] : undefined;
  const hoveredTimestamp = showTooltip && tooltip!.index < timestamps.length
    ? timestamps[tooltip!.index] : undefined;

  const tooltipValueLabel =
    typeof hoveredValue === "number" ? hoveredValue.toLocaleString() : "--";
  const tooltipTimestampLabel =
    typeof hoveredTimestamp === "number"
      ? new Date(hoveredTimestamp * 1000).toLocaleString()
      : "--";

  // Approximate tooltip width so we can flip it left when near the right edge.
  const TOOLTIP_W = 148;
  const tooltipLeft = showTooltip
    ? tooltip!.x + 12 + TOOLTIP_W > canvasWidth
      ? tooltip!.x - TOOLTIP_W - 4
      : tooltip!.x + 12
    : 0;

  return (
    <div className="relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full rounded-md"
        style={{ height, touchAction: "none" }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      />

      {showTooltip && (
        <div
          className="pointer-events-none absolute z-10 bg-background border rounded-md px-2 py-1 text-xs shadow"
          style={{
            left: tooltipLeft,
            top: Math.max(tooltip!.y - 36, 4),
          }}
        >
          <div className="font-medium">{tooltipValueLabel} Players</div>
          <div className="text-muted-foreground">{tooltipTimestampLabel}</div>
        </div>
      )}
    </div>
  );
}

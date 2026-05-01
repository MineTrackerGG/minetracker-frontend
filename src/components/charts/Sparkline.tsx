import { useCallback, useEffect, useRef, useState } from "react";
import { chartSync } from "@/lib/chartSync";

interface SparklineProps {
  values: number[];
  timestamps: number[];
  height?: number;
  yRange?: { min: number; max: number };
  isVisible?: boolean;
}

const TOOLTIP_W = 148;

function getXAtIndex(timestamps: number[], index: number, width: number, total: number) {
  const firstTs = timestamps[0];
  const lastTs = timestamps[timestamps.length - 1];
  const span = (lastTs ?? 0) - (firstTs ?? 0);
  const ts = timestamps[index];

  if (
    Number.isFinite(firstTs) &&
    Number.isFinite(lastTs) &&
    Number.isFinite(ts) &&
    span > 0
  ) {
    return ((ts - firstTs) / span) * width;
  }

  if (total <= 1) return 0;
  return (index / (total - 1)) * width;
}

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
  up:   { stroke: "#00e13f",              fill: "rgba(0,225,63,0.15)"      },
  down: { stroke: "rgb(59 130 246)",  fill: "rgba(59,130,246,0.15)"  },
  flat: { stroke: "rgb(148 163 184)", fill: "rgba(148,163,184,0.12)" },
};

export function Sparkline({
  values,
  timestamps,
  height = 80,
  yRange,
  isVisible = true,
}: SparklineProps) {
  const canvasRef      = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef   = useRef<ImageData | null>(null);
  const rafRef         = useRef<number | null>(null);
  const syncRafRef     = useRef<number | null>(null);
  const isHoveringRef  = useRef(false);
  const lastHoverRef   = useRef<{ index: number; rawX: number; rawY: number } | null>(null);
  const lastSyncedTsRef = useRef<number | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const tooltipRef      = useRef<HTMLDivElement | null>(null);
  const tooltipValueRef = useRef<HTMLDivElement | null>(null);
  const tooltipTimeRef  = useRef<HTMLDivElement | null>(null);
  const tooltipIndexRef = useRef<number>(-1);
  // Always-current snapshot of the sync handler — updated via useEffect, read in the stable subscription.
  const syncHandlerRef  = useRef<(ts: number | null) => void>(() => {});

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

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const dpr   = window.devicePixelRatio || 1;
    const width = canvasWidth;

    canvas.width  = width  * dpr;
    canvas.height = height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Dot grid background.
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    const gridStep = 25;
    for (let gx = gridStep; gx < width; gx += gridStep) {
      for (let gy = gridStep; gy < height; gy += gridStep) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const { min, range } = computeYBounds(values, yRange);
    const color = COLORS[getTrend(values)];

    ctx.beginPath();
    values.forEach((v, i) => {
      const x = getXAtIndex(timestamps, i, width, values.length);
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

    // Draw peak indicator.
    const peakIndex = values.reduce((best, v, i) => v > values[best] ? i : best, 0);
    const peakValue = values[peakIndex];
    const peakX = getXAtIndex(timestamps, peakIndex, width, values.length);
    const peakY = height - ((peakValue - min) / range) * height;

    // Vertical dashed orange line at peak.
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(251,146,60,0.75)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(peakX, 0);
    ctx.lineTo(peakX, height);
    ctx.stroke();
    ctx.restore();

    // Peak value label: fixed near the top of the chart.
    const label = peakValue.toLocaleString();
    ctx.font = "bold 11px sans-serif";
    const labelWidth = ctx.measureText(label).width;
    const labelX = Math.min(Math.max(peakX, labelWidth / 2 + 2), width - labelWidth / 2 - 2);
    const labelY = 14;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(label, labelX + 1, labelY + 1);
    ctx.fillStyle = "rgb(251,146,60)";
    ctx.fillText(label, labelX, labelY);

    // Peak dot.
    ctx.beginPath();
    ctx.arc(peakX, peakY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgb(251,146,60)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Cache the base pixels so each hover-dot draw is a cheap putImageData.
    baseImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, [values, timestamps, height, canvasWidth, yRange]);

  // Draw hover overlay directly on canvas AND update tooltip DOM — zero React renders.
  const drawHoverDot = useCallback((index: number, rawX: number, rawY: number) => {
    const canvas = canvasRef.current;
    const base   = baseImageRef.current;
    if (!canvas || !base || values.length < 2) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const dpr   = window.devicePixelRatio || 1;
    const width = canvasWidth;

    ctx.putImageData(base, 0, 0); // restore base pixels (cheap memcpy)

    const { min, range } = computeYBounds(values, yRange);
    const color = COLORS[getTrend(values)];
    const snapX = getXAtIndex(timestamps, index, width, values.length);
    const snapY = height - ((values[index] - min) / range) * height;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Smooth vertical crosshair at raw mouse position.
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rawX, 0);
    ctx.lineTo(rawX, height);
    ctx.stroke();
    ctx.restore();

    // Dot at nearest data point.
    ctx.beginPath();
    ctx.arc(snapX, snapY, 4, 0, Math.PI * 2);
    ctx.fillStyle = color.stroke;
    ctx.fill();

    // Update tooltip position imperatively (no React state).
    const tip = tooltipRef.current;
    if (tip && isVisible) {
      const left = rawX + 12 + TOOLTIP_W > width ? rawX - TOOLTIP_W - 4 : rawX + 12;
      const top  = Math.max(rawY - 36, 4);
      tip.style.left    = `${left}px`;
      tip.style.top     = `${top}px`;
      tip.style.display = "block";
      // Only update text content when index changes.
      if (tooltipIndexRef.current !== index) {
        tooltipIndexRef.current = index;
        if (tooltipValueRef.current)
          tooltipValueRef.current.textContent = `${values[index].toLocaleString()} Players`;
        if (tooltipTimeRef.current) {
          const ts = timestamps[index];
          tooltipTimeRef.current.textContent = typeof ts === "number"
            ? new Date(ts * 1000).toLocaleString()
            : "--";
        }
      }
    }
  }, [values, height, canvasWidth, yRange, isVisible, timestamps]);

  const clearHoverDot = useCallback(() => {
    const canvas = canvasRef.current;
    const base   = baseImageRef.current;
    if (canvas && base) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) ctx.putImageData(base, 0, 0);
    }
    const tip = tooltipRef.current;
    if (tip) { tip.style.display = "none"; }
    tooltipIndexRef.current = -1;
  }, []);

  const onMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (values.length === 0) return;
    isHoveringRef.current = true;

    const rect  = e.currentTarget.getBoundingClientRect();
    const x     = e.clientX - rect.left;
    const y     = e.clientY - rect.top;
    const width = rect.width;
    let index = 0;
    let bestDiff = Infinity;

    for (let i = 0; i < values.length; i++) {
      const px = getXAtIndex(timestamps, i, width, values.length);
      const diff = Math.abs(px - x);
      if (diff < bestDiff) {
        bestDiff = diff;
        index = i;
      }
    }

    lastHoverRef.current = { index, rawX: x, rawY: y };

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      drawHoverDot(index, x, y);
      // Notify siblings via bus inside RAF — throttled to display rate.
      if (isVisible) chartSync.notify(timestamps[index] ?? null);
      rafRef.current = null;
    });
  }, [values, timestamps, isVisible, drawHoverDot]);

  const onLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    isHoveringRef.current = false;
    lastHoverRef.current = null;
    clearHoverDot();
    if (isVisible) chartSync.notify(null);
  }, [clearHoverDot, isVisible]);

  // After the base chart redraws, re-apply hover overlay if user is still hovering
  // or a synced hover is active on this sibling chart.
  useEffect(() => {
    if (isHoveringRef.current && lastHoverRef.current) {
      const { index, rawX, rawY } = lastHoverRef.current;
      drawHoverDot(index, rawX, rawY);
    } else if (!isHoveringRef.current && lastSyncedTsRef.current !== null) {
      syncHandlerRef.current(lastSyncedTsRef.current);
    }
  }, [values, height, canvasWidth, yRange, drawHoverDot]);

  // Keep syncHandlerRef current so the stable subscription always uses fresh data.
  useEffect(() => {
    syncHandlerRef.current = (ts: number | null) => {
      if (!isVisible || !timestamps.length || canvasWidth === 0 || values.length < 2) return;
      if (ts == null) { clearHoverDot(); return; }

      let bestIdx = 0, bestDiff = Infinity;
      for (let i = 0; i < timestamps.length; i++) {
        const diff = Math.abs((timestamps[i] ?? 0) - ts);
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
      }
      const idx = Math.max(0, Math.min(values.length - 1, bestIdx));
      const { min, range } = computeYBounds(values, yRange);
      const x = getXAtIndex(timestamps, idx, canvasWidth, values.length);
      const y = height - ((values[idx] - min) / range) * height;
      drawHoverDot(idx, x, y);
    };
  }, [isVisible, timestamps, canvasWidth, values, height, yRange, drawHoverDot, clearHoverDot]);

  // Subscribe once — reads from syncHandlerRef so no re-subscription needed.
  useEffect(() => {
    return chartSync.subscribe((ts) => {
      if (isHoveringRef.current) return; // ignore own notifications
      lastSyncedTsRef.current = ts;
      if (syncRafRef.current !== null) cancelAnimationFrame(syncRafRef.current);
      syncRafRef.current = requestAnimationFrame(() => {
        syncHandlerRef.current(ts);
        syncRafRef.current = null;
      });
    });
  }, []); // stable — no deps needed

  return (
    <div className="relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full rounded-md"
        style={{ height, touchAction: "none" }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      />
      {/* Tooltip is updated imperatively — no React state involved in hover */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 bg-background border rounded-md px-2 py-1 text-xs shadow"
        style={{ display: "none" }}
      >
        <div ref={tooltipValueRef} className="font-medium" />
        <div ref={tooltipTimeRef} className="text-muted-foreground" />
      </div>
    </div>
  );
}

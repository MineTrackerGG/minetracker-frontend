import { useEffect, useRef, useState } from "react";

interface SparklineProps {
  values: number[];
  timestamps: number[];
  height?: number;
  yRange?: { min: number; max: number };
  syncTimestamp?: number | null;
  onSyncTimestamp?: (ts: number | null) => void;
  isVisible?: boolean;
}

export function Sparkline({
  values,
  timestamps,
  height = 80,
  yRange,
  syncTimestamp,
  onSyncTimestamp,
  isVisible = true,
}: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [hoverY, setHoverY] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(0);

  // clear local hover when external sync cleared
  useEffect(() => {
    if (syncTimestamp == null) {
      const raf = requestAnimationFrame(() => setHoverIndex(null));
      return () => cancelAnimationFrame(raf);
    }
  }, [syncTimestamp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => setCanvasWidth(canvas.clientWidth);
    resize();

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setCanvasWidth(entry.contentRect.width);
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || values.length < 2 || canvasWidth === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvasWidth;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = Math.max((rawMax - rawMin) * 0.12, 1);

    const min = yRange ? yRange.min : Math.max(0, rawMin - padding);
    const max = yRange ? yRange.max : rawMax + padding;
    const range = max - min || 1;

    const first = values[0];
    const last = values[values.length - 1];

    const trend =
    last > first * 1.02
        ? "up"
        : last < first * 0.98
        ? "down"
        : "flat";

    const COLORS = {
    up: {
        stroke: "rgb(34 197 94)",       // green-500
        fill: "rgba(34,197,94,0.18)",
    },
    down: {
        stroke: "rgb(59 130 246)",      // red-400
        fill: "rgba(59,130,246,0.18)",
    },
    flat: {
        stroke: "rgb(148 163 184)",     // slate-400
        fill: "rgba(148,163,184,0.15)",
    },
    };

    const color = COLORS[trend];

    ctx.beginPath();
    values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = color.fill;
    ctx.fill();

    // hover dot
    if (hoverIndex !== null) {
      const x = (hoverIndex / (values.length - 1)) * width;
      const y =
        height -
        ((values[hoverIndex] - min) / range) * height;

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color.stroke;
    ctx.fill();
    }
  }, [values, height, hoverIndex, canvasWidth, yRange]);

    const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (values.length === 0) {
      setHoverIndex(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const index = Math.round(
      (x / rect.width) * (values.length - 1)
    );
    const clamped = Math.max(0, Math.min(values.length - 1, index));
    setHoverIndex(clamped);
    setHoverX(x);
    setHoverY(y);
    if (onSyncTimestamp && isVisible) {
      const ts = timestamps[clamped];
      onSyncTimestamp(ts ?? null);
    }
    };

    const showTooltip =
    isVisible &&
    hoverIndex !== null &&
    hoverIndex >= 0 &&
    hoverIndex < values.length &&
    typeof values[hoverIndex] === "number";

    const hoveredValue = showTooltip ? values[hoverIndex] : undefined;
    const hoveredTimestamp =
    showTooltip && hoverIndex < timestamps.length
      ? timestamps[hoverIndex]
      : undefined;
    const tooltipValueLabel =
    typeof hoveredValue === "number" ? hoveredValue.toLocaleString() : "--";
    const tooltipTimestampLabel =
    typeof hoveredTimestamp === "number"
      ? new Date(hoveredTimestamp * 1000).toLocaleString()
      : "--";

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full rounded-md"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHoverIndex(null);
          onSyncTimestamp?.(null);
        }}
      />

      {/* sync from external timestamp */}
      {syncTimestamp != null && values.length > 0 && isVisible && (
        <SyncHandler
          syncTimestamp={syncTimestamp}
          timestamps={timestamps}
          values={values}
          width={canvasWidth}
          height={height}
          yRange={yRange}
          setHoverIndex={setHoverIndex}
          setHoverX={setHoverX}
          setHoverY={setHoverY}
        />
      )}

      {showTooltip && (
        <div
            className="pointer-events-none absolute z-10 bg-background border rounded-md px-2 py-1 text-xs shadow"
            style={{
            left: hoverX + 12,
            top: Math.max(hoverY - 36, 4),
            }}
        >
            <div className="font-medium">
          {tooltipValueLabel} Players
            </div>
            <div className="text-muted-foreground">
          {tooltipTimestampLabel}
            </div>
        </div>
        )}
    </div>
  );
}

function SyncHandler({
  syncTimestamp,
  timestamps,
  values,
  width,
  height,
  yRange,
  setHoverIndex,
  setHoverX,
  setHoverY,
}: {
  syncTimestamp: number;
  timestamps: number[];
  values: number[];
  width: number;
  height: number;
  yRange?: { min: number; max: number };
  setHoverIndex: (i: number | null) => void;
  setHoverX: (x: number) => void;
  setHoverY: (y: number) => void;
}) {
  useEffect(() => {
    if (syncTimestamp == null) return;
    if (!timestamps || timestamps.length === 0 || width === 0) return;

    // find closest timestamp index
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < timestamps.length; i++) {
      const diff = Math.abs((timestamps[i] ?? 0) - syncTimestamp);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    const idx = Math.max(0, Math.min(values.length - 1, bestIdx));
    setHoverIndex(idx);
    const x = (idx / (values.length - 1)) * width;

    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = Math.max((rawMax - rawMin) * 0.12, 1);
    const min = yRange ? yRange.min : Math.max(0, rawMin - padding);
    const max = yRange ? yRange.max : rawMax + padding;
    const range = max - min || 1;
    const y = height - ((values[idx] - min) / range) * height;

    setHoverX(x);
    setHoverY(y);
  }, [syncTimestamp, timestamps, values, width, height, yRange, setHoverIndex, setHoverX, setHoverY]);

  return null;
}

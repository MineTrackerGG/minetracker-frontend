/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { getDataPoints } from "@/lib/serverData";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardTitle } from "../ui/card";
import { Server, ServerDataPoint } from "@/types/server";
import Image from "next/image";
import { Skeleton } from "../ui/skeleton";
import { useWebSocket } from "@/hooks/useWebSocket";
import React from "react";

import { Sparkline } from "@/components/charts/Sparkline";
import { downsampleSparklineData, useSparklineData } from "@/hooks/useSparklineData";
import { useVisible } from "@/hooks/useVisible";
import { livePointToServerDataPoint, parseLiveDataPayload } from "@/lib/liveData";

function parseTimeRangeToMs(timeRange: string) {
  const value = Number.parseInt(timeRange, 10);
  if (!Number.isFinite(value) || value <= 0) return 24 * 60 * 60 * 1000;

  if (timeRange.endsWith("h")) return value * 60 * 60 * 1000;
  if (timeRange.endsWith("d")) return value * 24 * 60 * 60 * 1000;
  if (timeRange.endsWith("y")) return value * 365 * 24 * 60 * 60 * 1000;

  return 24 * 60 * 60 * 1000;
}

function getSparklinePointBudget(width: number, timeRange: string) {
  const safeWidth = Math.max(240, width || 320);
  const rangeMs = parseTimeRangeToMs(timeRange);
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;

  const density = rangeMs <= oneDay
    ? 0.8
    : rangeMs <= oneWeek
      ? 0.55
      : rangeMs <= oneMonth
        ? 0.35
        : 0.24;

  return Math.max(40, Math.min(420, Math.round(safeWidth * density)));
}

function getRetentionPointLimit(timeRange: string) {
  const rangeMs = parseTimeRangeToMs(timeRange);
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;

  if (rangeMs <= oneDay) return 1800;
  if (rangeMs <= oneWeek) return 2400;
  if (rangeMs <= oneMonth) return 3200;
  return 4200;
}

function getTickIntervalMs(rangeMs: number, maxLabels: number) {
  const target = Math.max(1, Math.floor(rangeMs / Math.max(2, maxLabels - 1)));
  const candidates = [
    15 * 60 * 1000,
    30 * 60 * 1000,
    60 * 60 * 1000,
    2 * 60 * 60 * 1000,
    4 * 60 * 60 * 1000,
    6 * 60 * 60 * 1000,
    12 * 60 * 60 * 1000,
    24 * 60 * 60 * 1000,
    2 * 24 * 60 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000,
    14 * 24 * 60 * 60 * 1000,
    30 * 24 * 60 * 60 * 1000,
    60 * 24 * 60 * 60 * 1000,
    90 * 24 * 60 * 60 * 1000,
  ];

  return candidates.find((candidate) => candidate >= target) ?? candidates[candidates.length - 1];
}

interface ServerCardProps {
  server: Server;
  timeRange: string;
  hidden?: boolean;
  onToggleHidden?: (ip: string) => void;
  position?: number;
}

function ServerCard({ server, timeRange, hidden = false, onToggleHidden }: ServerCardProps) {
  const [dataPoints, setDataPoints] = useState<ServerDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const { isConnected, on, off, send } = useWebSocket();

  const maxDataPointsRef = useRef(1000);
  const bufferRef = useRef<ServerDataPoint[]>([]);
  const xAxisRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const statsRef = useRef({
    current: 0,
    max: 0,
    min: Infinity,
    sum: 0,
    count: 0,
  });

  const [, forceUpdate] = useState(0);
  const { ref, visible } = useVisible<HTMLDivElement>();

  const enqueueLivePoint = useCallback((rawPoint: unknown) => {
    const parsed = parseLiveDataPayload(rawPoint);
    if (!parsed || parsed.ip !== server.ip) {
      return;
    }

    bufferRef.current.push(livePointToServerDataPoint(parsed));
  }, [server.ip]);

  useEffect(() => {
    const handleRealtimePoint = (data: any) => {
      if (!data?.data) {
        return;
      }

      if (data.data.ip !== server.ip) {
        return;
      }

      enqueueLivePoint(data.data);
    };

    on("data_point_rt", handleRealtimePoint);

    return () => {
      off("data_point_rt", handleRealtimePoint);
    };
  }, [enqueueLivePoint, on, off]);

  useEffect(() => {
    send({
      type: "subscribe_server",
      ip: server.ip,
    });

    return () => {
      send({
        type: "unsubscribe_server",
        ip: server.ip,
      });
    };
  }, [server.ip]);


  useEffect(() => {
    const retentionLimit = getRetentionPointLimit(timeRange);
    maxDataPointsRef.current = retentionLimit;
  }, [timeRange]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (bufferRef.current.length === 0) return;

      setDataPoints((prev) => {
        const next = [...prev];

        for (const p of bufferRef.current) {
          if (next.some((d) => d.timestamp === p.timestamp)) continue;

          next.push(p);

          statsRef.current.current = p.player_count;
          statsRef.current.max = Math.max(statsRef.current.max, p.player_count);
          statsRef.current.min = Math.min(statsRef.current.min, p.player_count);
          statsRef.current.sum += p.player_count;
          statsRef.current.count += 1;
        }

        bufferRef.current = [];

        next.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
        return next.slice(-maxDataPointsRef.current);
      });

      forceUpdate((v) => v + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateWidth = () => {
      if (xAxisRef.current) {
        setContainerWidth(xAxisRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [visible]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await getDataPoints(server.ip, timeRange);

        const clean = res.data
          .filter(
            (p) =>
              p.player_count != null &&
              p.player_count >= 0 &&
              p.player_count <= 100000 &&
              p.timestamp != null,
          )
          .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

        statsRef.current = {
          current: clean.at(-1)?.player_count ?? 0,
          max: Math.max(0, ...clean.map((p) => p.player_count)),
          min: clean.length > 0 ? Math.min(...clean.map((p) => p.player_count)) : 0,
          sum: clean.reduce((s, p) => s + p.player_count, 0),
          count: clean.length,
        };

        const retentionLimit = getRetentionPointLimit(timeRange);
        maxDataPointsRef.current = retentionLimit;
        setDataPoints(downsampleSparklineData(clean, retentionLimit));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [server.ip, timeRange]);

  const sparklinePointBudget = useMemo(
    () => getSparklinePointBudget(containerWidth, timeRange),
    [containerWidth, timeRange],
  );

  const sparklinePoints = useSparklineData(dataPoints, sparklinePointBudget);
  const sparklineValues = sparklinePoints.map((point) => point.player_count);
  const sparklineTimestamps = sparklinePoints.map((point) => Number(point.timestamp));

  const { yRange, yTicks } = useMemo(() => {
    if (sparklineValues.length < 2) {
      return {
        yRange: { min: 0, max: 1 },
        yTicks: [1, 0.75, 0.5, 0.25, 0],
      };
    }

    const rawMin = Math.min(...sparklineValues);
    const rawMax = Math.max(...sparklineValues);
    const spread = rawMax - rawMin;
    const dynamicPadding = spread === 0
      ? Math.max(2, rawMax * 0.1)
      : spread * 0.15;
    const padding = Math.max(dynamicPadding, 1);
    const min = Math.max(0, rawMin - padding);
    const max = rawMax + padding;
    const steps = 4;
    const interval = (max - min) / steps;
    const ticks = Array.from({ length: steps + 1 }, (_, idx) =>
      Math.round(max - interval * idx),
    );

    return { yRange: { min, max }, yTicks: ticks };
  }, [sparklineValues]);

  const stats = useMemo(() => {
    const s = statsRef.current;
    return {
      current: s.current,
      max: s.max,
      min: s.min === Infinity ? 0 : s.min,
      avg: s.count ? Math.round(s.sum / s.count) : 0,
      alltime: server.peak ?? 0,
    };
  }, [dataPoints, server.peak]);

  const xTicks = useMemo(() => {
    if (dataPoints.length === 0) return [];
    const start = Number(dataPoints[0]?.timestamp) * 1000;
    const end = Number(dataPoints.at(-1)?.timestamp) * 1000;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
    if (start === end) return [start];

    const width = containerWidth || 300;
    const rangeMs = end - start;
    const minLabelWidth = width < 400 ? 95 : 130;
    const maxLabels = Math.max(2, Math.min(7, Math.floor(width / minLabelWidth)));
    const intervalMs = getTickIntervalMs(rangeMs, maxLabels);

    const ticks: number[] = [start];
    let cursor = Math.ceil(start / intervalMs) * intervalMs;

    while (cursor < end && ticks.length < maxLabels - 1) {
      if (cursor > start) ticks.push(cursor);
      cursor += intervalMs;
    }

    if (ticks[ticks.length - 1] !== end) {
      ticks.push(end);
    }

    return ticks;
  }, [dataPoints, containerWidth]);

  const formatTickLabel = useCallback((timestamp: number, isSmall: boolean) => {
    if (!timestamp) return "--";
    const date = new Date(timestamp);

    const rangeMs = parseTimeRangeToMs(timeRange);
    const oneDay = 24 * 60 * 60 * 1000;
    const oneMonth = 30 * oneDay;

    if (rangeMs <= oneDay && isSmall) {
      return date.toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    if (rangeMs > oneMonth) {
      return date.toLocaleString(undefined, {
        month: "short",
        day: "2-digit",
      });
    }

    return date.toLocaleString(undefined, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [timeRange]);

  const iconSrc = server.icon ?? "/logo/no-icon.png";

  return (
    <Card className="w-full">
      <CardContent ref={ref} className="p-0">
        {/* Header */}
        <div className="flex items-center gap-3 p-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative h-10 w-10 shrink-0">
              <Image
                src={iconSrc}
                alt={`${server.ip} icon`}
                width={40}
                height={40}
                className="rounded-xl"
                unoptimized
              />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-base leading-tight">{server.name || server.ip}</CardTitle>
              <CardDescription className="truncate text-sm">{server.ip}</CardDescription>
            </div>
          </div>
        </div>

        {/* Chart area */}
        <div className="px-4 pb-2">
          {loading || !isConnected || !visible ? (
            <Skeleton className="h-40 w-full" />
          ) : hidden ? (
            <div className="h-40 flex items-center justify-center">
              <div className="flex items-center gap-3">
                <div className="text-sm text-muted-foreground">Hidden</div>
                <button
                  type="button"
                  onClick={() => onToggleHidden?.(server.ip)}
                  className="rounded px-2 py-1 text-xs bg-white/5"
                >
                  Show
                </button>
              </div>
            </div>
          ) : (
            <div className="relative flex flex-col gap-3">
              <div className="relative flex-1">
                <div className="absolute left-0 top-0 bottom-3 flex flex-col justify-between pr-3 text-xs text-muted-foreground text-right">
                  {yTicks.map((value, idx) => (
                    <span key={`${idx}-${value}`}>{value.toLocaleString()}</span>
                  ))}
                </div>

                <div className="ml-16">
                  <Sparkline
                    values={sparklineValues}
                    timestamps={sparklineTimestamps}
                    height={150}
                    yRange={yRange}
                    isVisible={visible}
                  />
                </div>
              </div>

              <div ref={xAxisRef} className="ml-16 flex justify-between text-xs text-muted-foreground whitespace-nowrap overflow-hidden">
                {xTicks.map((tick, idx) => (
                  <span key={`${idx}-${tick}`} className="shrink-0">{formatTickLabel(tick, containerWidth < 400)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="border-t border-border px-0 pb-0 pt-0">
        <div className="w-full grid grid-cols-3 sm:grid-cols-5 text-xs text-muted-foreground *:border-border *:border-r *:border-b [&>*:nth-child(3n)]:border-r-0 [&>*:last-child]:border-r-0 [&>*:nth-child(n+4)]:border-b-0 sm:*:border-r sm:[&>*:last-child]:border-r-0 sm:*:border-b-0">
          {["Current", "Mean", "Min", "Max", "Alltime"].map((label) => {
            const value =
              label === "Current" ? stats.current :
              label === "Mean" ? stats.avg :
              label === "Min" ? stats.min :
              label === "Alltime" ? stats.alltime :
              stats.max;
            const dotColor =
              label === "Current"
                ? "#00e13f"
                : label === "Mean"
                  ? "rgb(59,130,246)"
                  : label === "Min"
                    ? "rgb(234,179,8)"
                    : label === "Max"
                      ? "rgb(239,68,68)"
                      : label === "Alltime"
                        ? "rgb(168,85,247)"
                        : "rgb(251,146,60)"
            return (
              <div key={label} className="flex flex-col items-center gap-0.5 px-2 sm:px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} aria-hidden />
                  <span>{label}</span>
                </div>
                {loading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <span className="text-sm sm:text-base font-semibold text-foreground">{value.toLocaleString()}</span>
                )}
              </div>
            );
          })}
        </div>
      </CardFooter>
    </Card>
  );
}

export default React.memo(ServerCard);

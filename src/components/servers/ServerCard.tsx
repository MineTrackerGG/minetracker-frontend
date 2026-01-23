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
import { useSparklineData } from "@/hooks/useSparklineData";
import { useVisible } from "@/hooks/useVisible";
import { livePointToServerDataPoint, parseLiveDataPayload } from "@/lib/liveData";

interface ServerCardProps {
  server: Server;
  timeRange: string;
}

function ServerCard({ server, timeRange }: ServerCardProps) {
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

      if (data.data.ip === "donutsmp.net") {
        console.log("Received realtime data point for", server.ip, data.data.player_count);
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

        setDataPoints(clean);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [server.ip, timeRange]);

  const sparklinePoints = useSparklineData(dataPoints, 50);
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
    const padding = Math.max((rawMax - rawMin) * 0.12, 1);
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
    };
  }, [dataPoints]);

  const xTicks = useMemo(() => {
    if (dataPoints.length === 0) return [];
    const start = Number(dataPoints[0]?.timestamp) * 1000;
    const end = Number(dataPoints.at(-1)?.timestamp) * 1000;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
    if (start === end) return [start];
    
    // Berechne dynamisch wie viele Labels basierend auf Container-Breite
    const width = containerWidth || 300;
    const minLabelWidth = width < 400 ? 80 : 100;
    const maxLabels = Math.max(2, Math.min(5, Math.floor(width / minLabelWidth)));
    const divisions = maxLabels - 1;
    
    const interval = (end - start) / divisions;
    return Array.from({ length: divisions + 1 }, (_, idx) =>
      Math.round(start + interval * idx),
    );
  }, [dataPoints, containerWidth]);

  const formatTickLabel = useCallback((timestamp: number, isSmall: boolean) => {
    if (!timestamp) return "--";
    const date = new Date(timestamp);
    
    if (isSmall) {
      // Nur Uhrzeit für kleine Bildschirme
      return date.toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    
    return date.toLocaleString(undefined, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const iconSrc = server.icon ?? "/logo/no-icon.png";

  return (
    <Card className="w-full max-w-2xl">
      <CardContent ref={ref} className="space-y-6 pb-4 pt-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="relative h-16 w-16 shrink-0">
              <Image
                src={iconSrc}
                alt={`${server.ip} icon`}
                width={64}
                height={64}
                className="rounded-2xl border border-white/10 bg-black/40"
                unoptimized
              />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-xl leading-tight">{server.name || server.ip}</CardTitle>
              <CardDescription className="truncate">{server.ip}</CardDescription>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
          {loading || !isConnected || !visible ? (
            <Skeleton className="h-40 w-full" />
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

      <CardFooter className="border-t border-white/5 pt-4">
        <div className="grid w-full grid-cols-2 divide-x divide-white/10 text-center text-xs text-muted-foreground sm:grid-cols-3 lg:grid-cols-5">
          {["Current", "Mean", "Min", "Max", "Alltime"].map((label) => {
            const value =
              label === "Current" ? stats.current :
              label === "Mean" ? stats.avg :
              label === "Min" ? stats.min :
              label === "Max" ? stats.max : server.peak;
            const colorClass =
              label === "Current"
                ? "bg-green-500"
                : label === "Mean"
                  ? "bg-blue-500"
                  : label === "Min"
                    ? "bg-yellow-500"
                    : label === "Max"
                      ? "bg-red-500"
                      : "bg-purple-500";
            return (
              <div key={label} className="flex flex-col items-center gap-1 px-2 py-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${colorClass}`} aria-hidden />
                  <span>{label}</span>
                </div>
                {loading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <span className="text-lg font-semibold text-white">{value.toLocaleString()}</span>
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

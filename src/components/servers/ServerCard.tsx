/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { getDataPoints } from "@/lib/serverData";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Server, ServerDataPoint } from "@/types/server";
import Image from "next/image";
import { Skeleton } from "../ui/skeleton";
import { useWebSocket } from "@/hooks/useWebSocket";
import React from "react";

import { Sparkline } from "@/components/charts/Sparkline";
import { useSparklineData } from "@/hooks/useSparklineData";
import { useVisible } from "@/hooks/useVisible";

interface ServerCardProps {
  server: Server;
  timeRange: string;
}

function ServerCard({ server, timeRange }: ServerCardProps) {
  const [dataPoints, setDataPoints] = useState<ServerDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const { isConnected, on, off } = useWebSocket();

  const maxDataPointsRef = useRef(1000);
  const bufferRef = useRef<ServerDataPoint[]>([]);

  const statsRef = useRef({
    current: 0,
    max: 0,
    sum: 0,
    count: 0,
  });

  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const handleDataPointAdd = (data: any) => {
      const serverData = data?.data;
      if (!serverData || serverData.ip !== server.ip) return;

      bufferRef.current.push(serverData);
    };

    on("data_point_add", handleDataPointAdd);
    return () => off("data_point_add", handleDataPointAdd);
  }, [on, off, server.ip]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (bufferRef.current.length === 0) return;

      setDataPoints(prev => {
        const next = [...prev];

        for (const p of bufferRef.current) {
          if (next.some(d => d.timestamp === p.timestamp)) continue;

          next.push(p);

          statsRef.current.current = p.player_count;
          statsRef.current.max = Math.max(statsRef.current.max, p.player_count);
          statsRef.current.sum += p.player_count;
          statsRef.current.count += 1;
        }

        bufferRef.current = [];

        next.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
        return next.slice(-maxDataPointsRef.current);
      });

      forceUpdate(v => v + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await getDataPoints(server.ip, timeRange);

        const clean = res.data
          .filter(p =>
            p.player_count != null &&
            p.player_count >= 0 &&
            p.player_count <= 100000 &&
            p.timestamp != null
          )
          .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

        statsRef.current = {
          current: clean.at(-1)?.player_count ?? 0,
          max: Math.max(0, ...clean.map(p => p.player_count)),
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

  const sparklineValues = useSparklineData(dataPoints, 50);
  const { ref, visible } = useVisible<HTMLDivElement>();

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
      Math.round(max - interval * idx)
    );

    return { yRange: { min, max }, yTicks: ticks };
  }, [sparklineValues]);

  const stats = useMemo(() => {
    const s = statsRef.current;
    return {
      current: s.current,
      max: s.max,
      avg: s.count ? Math.round(s.sum / s.count) : 0,
    };
  }, [dataPoints]);

  const xTicks = useMemo(() => {
    if (dataPoints.length === 0) return [];
    const start = Number(dataPoints[0]?.timestamp) * 1000;
    const end = Number(dataPoints.at(-1)?.timestamp) * 1000;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
    if (start === end) return [start];
    const divisions = 4;
    const interval = (end - start) / divisions;
    return Array.from({ length: divisions + 1 }, (_, idx) =>
      Math.round(start + interval * idx)
    );
  }, [dataPoints]);

  const formatTickLabel = useCallback((timestamp: number) => {
    if (!timestamp) return "--";
    return new Date(timestamp).toLocaleString(undefined, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const iconSrc = server.icon ?? "/logo/no-icon.png";

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="flex flex-row items-center gap-4 pb-4">
        <div className="relative w-16 h-16 shrink-0">
          <Image
            src={iconSrc}
            alt={`${server.ip} icon`}
            width={64}
            height={64}
            className="rounded-lg"
            unoptimized
          />
        </div>
        <div className="flex-1">
          <CardTitle className="text-xl">{server.name || server.ip}</CardTitle>
          <CardDescription>{server.ip}</CardDescription>
        </div>
      </CardHeader>

    <CardContent ref={ref} className="pb-4">
    {loading || !isConnected || !visible ? (
        <Skeleton className="h-20 w-full" />
    ) : (
        <div className="relative pl-10">
            <div className="relative pl-16">
            <div className="absolute left-0 top-0 bottom-4 w-16 pr-2 flex flex-col justify-between text-xs text-muted-foreground text-right">
                {yTicks.map(value => (
                <span key={`${value}`}>{value.toLocaleString()}</span>
                ))}
            </div>

            <Sparkline
              values={sparklineValues}
              timestamps={dataPoints
                .slice(-sparklineValues.length)
                .map(d => Number(d.timestamp))}
              height={110}
              yRange={yRange}
            />

            <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {xTicks.map(tick => (
                <span key={tick}>{formatTickLabel(tick)}</span>
                ))}
            </div>
            </div>
        </div>
    )}
    </CardContent>

      <CardFooter className="border-t pt-4">
        <div className="grid grid-cols-3 gap-4 w-full text-center">
          {[
            { label: "Current", value: stats.current },
            { label: "Mean", value: stats.avg },
            { label: "Max", value: stats.max },
          ].map(s => (
            <div key={s.label}>
              {s.label === "Current" && (
                <div className="flex items-center justify-center gap-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-muted-foreground">Current</span>
                </div>
              )}
              {s.label === "Mean" && (
                <div className="flex items-center justify-center gap-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-xs text-muted-foreground">Mean</span>
                </div>
              )}
              {s.label === "Max" && (
                <div className="flex items-center justify-center gap-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-xs text-muted-foreground">Max</span>
                </div>
              )}
              {loading ? (
                <Skeleton className="h-8 w-16 mx-auto mt-1" />
              ) : (
                <div className="text-2xl font-bold">
                  {s.value.toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardFooter>
    </Card>
  );
}

export default React.memo(ServerCard);

'use client';

import { getDataPoints } from "@/lib/serverData";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "../ui/chart";
import { Server, ServerDataPoint } from "@/types/server";
import Image from "next/image";
import { Skeleton } from "../ui/skeleton";
import { useWebSocket } from "@/hooks/useWebSocket";
import React from "react";

interface ServerCardProps {
    server: Server;
}

// Memoize den Chart separat
const MemoizedAreaChart = React.memo(({ dataPoints, chartConfig }: { dataPoints: ServerDataPoint[], chartConfig: ChartConfig }) => {
    const tickFormatter = useCallback((value: number) => {
        const date = new Date(value * 1000);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const labelFormatter = useCallback((value: any, payload: any) => {
        const timestamp = payload && payload.length > 0 ? payload[0].payload.timestamp : value;
        const date = new Date(Number(timestamp) * 1000);
        return date.toLocaleString('de-DE', { 
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
    }, []);

    return (
        <ChartContainer config={chartConfig} className="h-50 w-full">
            <AreaChart
                accessibilityLayer
                data={dataPoints}
                margin={{
                    left: 12,
                    right: 12,
                    top: 12,
                    bottom: 12,
                }}
            >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                    dataKey="timestamp"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={tickFormatter}
                />
                <YAxis
                    dataKey="player_count"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                />
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent 
                        indicator="line"
                        labelFormatter={labelFormatter}
                    />}
                    animationDuration={0}
                />
                <Area
                    dataKey="player_count"
                    type="monotone"
                    fill="var(--chart-1)"
                    fillOpacity={0.2}
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    isAnimationActive={false}
                />
            </AreaChart>
        </ChartContainer>
    );
});

MemoizedAreaChart.displayName = 'MemoizedAreaChart';

function ServerCard({ server } : ServerCardProps) {
    const [dataPoints, setDataPoints] = useState<ServerDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const { isConnected, on, off } = useWebSocket();
    const dataLoadedRef = useRef(false);
    const maxDataPointsRef = useRef(1000);

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleDataPointAdd = (data: any) => {
            const serverData = data.data;
            
            if (!serverData || !serverData.ip || serverData.ip !== server.ip) {
                return;
            }
            
            setDataPoints((prevDataPoints) => {
                const exists = prevDataPoints.some(
                    point => point.timestamp === serverData.timestamp
                );
                
                if (exists) {
                    return prevDataPoints;
                }

                const newPoints = [...prevDataPoints, serverData]
                    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
                
                if (newPoints.length > maxDataPointsRef.current) {
                    return newPoints.slice(-maxDataPointsRef.current);
                }
                
                return newPoints;
            });
        };

        on('data_point_add', handleDataPointAdd);

        return () => {
            off('data_point_add', handleDataPointAdd);
        };
    }, [on, off, server.ip]);

    useEffect(() => {
        if (dataLoadedRef.current) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await getDataPoints(server.ip, "7d");
                const filteredData = data.data
                    .filter(point => 
                        point.player_count >= 0 && 
                        point.player_count !== null && 
                        point.player_count !== undefined && 
                        point.timestamp !== null && 
                        point.timestamp !== undefined && 
                        point.ip && 
                        point.name && 
                        point.player_count <= 100000
                    )
                    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
                
                setDataPoints(filteredData);
                dataLoadedRef.current = true;
            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [server.ip]);

    const chartConfig = useMemo(() => ({
        player_count: {
            label: "Players",
            color: "var(--chart-1)",
        },
        timestamp: {
            label: "Time",
            color: "var(--chart-foreground)"
        },
    } satisfies ChartConfig), []);

    const stats = useMemo(() => {
        if (dataPoints.length === 0) {
            return { current: 0, max: 0, avg: 0 };
        }

        const current = dataPoints[dataPoints.length - 1].player_count;
        const max = Math.max(...dataPoints.map(d => d.player_count));
        const avg = Math.round(
            dataPoints.reduce((sum, d) => sum + d.player_count, 0) / dataPoints.length
        );

        return { current, max, avg };
    }, [dataPoints]);

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
            
            <CardContent className="pb-4">
                {loading || !isConnected ? (
                    <Skeleton className="h-50 w-full" />
                ) : (
                    <MemoizedAreaChart dataPoints={dataPoints} chartConfig={chartConfig} />
                )}
            </CardContent>

            <CardFooter className="border-t pt-4">
                <div className="grid grid-cols-3 gap-4 w-full text-center">
                    <div>
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-xs text-muted-foreground">Current</span>
                        </div>
                        {loading ? (
                            <Skeleton className="h-8 w-16 mx-auto" />
                        ) : (
                            <div className="text-2xl font-bold">{stats.current.toLocaleString()}</div>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="text-xs text-muted-foreground">Mean</span>
                        </div>
                        {loading ? (
                            <Skeleton className="h-8 w-16 mx-auto" />
                        ) : (
                            <div className="text-2xl font-bold">{stats.avg.toLocaleString()}</div>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <span className="text-xs text-muted-foreground">Max</span>
                        </div>
                        {loading ? (
                            <Skeleton className="h-8 w-16 mx-auto" />
                        ) : (
                            <div className="text-2xl font-bold">{stats.max.toLocaleString()}</div>
                        )}
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}

export default React.memo(ServerCard);
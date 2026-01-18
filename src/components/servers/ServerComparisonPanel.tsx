"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Server, ServerDataPoint } from "@/types/server";
import { getBulkServerData } from "@/lib/serverData";
import { TimeOption } from "./ServerTimeSelect";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const MAX_POINTS = 240;
const LINE_PALETTE = ["#22c55e", "#3b82f6", "#f97316", "#a855f7", "#ef4444", "#14b8a6"];

type ComparisonData = Record<string, ServerDataPoint[]>;

type ServerComparisonPanelProps = {
  servers: Server[];
  timeRange: TimeOption;
  selectedIps: string[];
  onSelectionChange: (ips: string[]) => void;
};

const sanitizePoints = (points: ServerDataPoint[]) =>
  points
    .filter(
      (p) =>
        p.player_count != null &&
        p.player_count >= 0 &&
        p.player_count <= 100000 &&
        p.timestamp != null,
    )
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

const safeSeriesKey = (ip: string) => `series_${ip.replace(/[^a-zA-Z0-9]/g, "_")}`;

const downsampleCombined = <T extends { timestamp: number }>(data: T[], maxPoints: number) => {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  const result: T[] = [];
  for (let i = 0; i < data.length; i += step) {
    result.push(data[i]);
  }
  if (result[result.length - 1] !== data[data.length - 1]) {
    result.push(data[data.length - 1]);
  }
  return result;
};

const formatTimestamp = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

function ComparisonTooltip({
  active,
  payload,
  label,
  seriesLookup,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  label?: any;
  seriesLookup: Map<string, { ip: string; label: string; color: string }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-background/80 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-muted-foreground">{formatTimestamp(Number(label))}</div>
      <div className="space-y-1">
        {payload.map((entry) => {
          const series = seriesLookup.get(entry.dataKey as string);
          if (!series) return null;
          return (
            <div key={series.ip} className="flex items-center justify-between gap-4 text-sm">
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: series.color }}
                ></span>
                {series.label}
              </span>
              <span className="font-semibold">
                {typeof entry.value === "number" ? entry.value.toLocaleString() : "-"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ServerComparisonPanel({
  servers,
  timeRange,
  selectedIps,
  onSelectionChange,
}: ServerComparisonPanelProps) {
  const serverLookup = useMemo(() => {
    const map = new Map<string, Server>();
    servers.forEach((server) => map.set(server.ip, server));
    return map;
  }, [servers]);

  const [search, setSearch] = useState("");
  const [dataByRange, setDataByRange] = useState<Record<string, ComparisonData>>({});
  const [isFetching, setIsFetching] = useState(false);
  const inFlightRef = useRef<Record<string, Set<string>>>({});

  const comparisonData = useMemo(() => dataByRange[timeRange] ?? {}, [dataByRange, timeRange]);

  useEffect(() => {
    if (selectedIps.length === 0) {
      setIsFetching(false);
      return;
    }

    const inFlightForRange = (inFlightRef.current[timeRange] ??= new Set<string>());
    const missingIps = selectedIps.filter((ip) => !comparisonData[ip] && !inFlightForRange.has(ip));

    if (missingIps.length === 0) {
      if (inFlightForRange.size === 0) {
        setIsFetching(false);
      }
      return;
    }

    missingIps.forEach((ip) => inFlightForRange.add(ip));
    setIsFetching(true);
    let cancelled = false;

    (async () => {
      try {
        const bulkResponse = await getBulkServerData(missingIps, timeRange);
        if (cancelled) return;

        setDataByRange((prev) => {
          const next = { ...prev };
          const rangeSnapshot = { ...(next[timeRange] ?? {}) };
          missingIps.forEach((ip) => {
            const dataset = bulkResponse.data?.[ip] ?? [];
            rangeSnapshot[ip] = sanitizePoints(dataset);
          });
          next[timeRange] = rangeSnapshot;
          return next;
        });
      } catch (error) {
        console.error("Comparison fetch failed", error);
      } finally {
        missingIps.forEach((ip) => inFlightForRange.delete(ip));
        if (!cancelled && inFlightForRange.size === 0) {
          setIsFetching(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      missingIps.forEach((ip) => inFlightForRange.delete(ip));
      if (inFlightForRange.size === 0) {
        setIsFetching(false);
      }
    };
  }, [selectedIps, timeRange, comparisonData]);

  const rankedServers = useMemo(
    () =>
      servers
        .slice()
        .sort((a, b) => b.player_count - a.player_count)
        .filter((server) => {
          if (!search.trim()) return true;
          const term = search.trim().toLowerCase();
          const label = (server.name ?? server.ip).toLowerCase();
          return label.includes(term) || server.ip.toLowerCase().includes(term);
        }),
    [servers, search],
  );

  const seriesMeta = useMemo(() => {
    return selectedIps.map((ip, index) => {
      const server = serverLookup.get(ip);
      return {
        ip,
        label: server?.name ?? ip,
        color: LINE_PALETTE[index % LINE_PALETTE.length],
        dataKey: safeSeriesKey(ip),
      };
    });
  }, [selectedIps, serverLookup]);

  const seriesLookup = useMemo(() => {
    const map = new Map<string, { ip: string; label: string; color: string }>();
    seriesMeta.forEach((series) => map.set(series.dataKey, series));
    return map;
  }, [seriesMeta]);

  const combinedData = useMemo(() => {
    const points = new Map<number, Record<string, number> & { timestamp: number }>();

    seriesMeta.forEach((series) => {
      const dataset = comparisonData[series.ip];
      if (!dataset) return;

      dataset.forEach((point) => {
        const timestamp = Number(point.timestamp) * 1000;
        if (!points.has(timestamp)) {
          points.set(timestamp, { timestamp });
        }
        const bucket = points.get(timestamp)!;
        bucket[series.dataKey] = point.player_count;
      });
    });

    const sorted = Array.from(points.values()).sort(
      (a, b) => Number(a.timestamp) - Number(b.timestamp),
    );

    return downsampleCombined(sorted, MAX_POINTS);
  }, [comparisonData, seriesMeta]);

  const yDomain = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    let max = 0;

    seriesMeta.forEach((series) => {
      const dataset = comparisonData[series.ip];
      if (!dataset?.length) return;
      dataset.forEach((point) => {
        min = Math.min(min, point.player_count);
        max = Math.max(max, point.player_count);
      });
    });

    if (!Number.isFinite(min)) return [0, 1];
    const padding = Math.max((max - min) * 0.1, 1);
    return [Math.max(0, min - padding), max + padding];
  }, [comparisonData, seriesMeta]);

  const statsRows = useMemo(() => {
    return seriesMeta.map((series) => {
      const dataset = comparisonData[series.ip] ?? [];
      if (dataset.length === 0) {
        return {
          ...series,
          current: 0,
          max: 0,
          avg: 0,
        };
      }
      const current = dataset.at(-1)!.player_count;
      const peak = Math.max(...dataset.map((p) => p.player_count));
      const avg = Math.round(dataset.reduce((sum, p) => sum + p.player_count, 0) / dataset.length);
      return { ...series, current, max: peak, avg };
    });
  }, [comparisonData, seriesMeta]);

  const toggleServer = useCallback(
    (ip: string) => {
      if (selectedIps.includes(ip)) {
        onSelectionChange(selectedIps.filter((entry) => entry !== ip));
      } else {
        onSelectionChange([...selectedIps, ip]);
      }
    },
    [selectedIps, onSelectionChange],
  );

  const handleSelectAll = useCallback(() => {
    onSelectionChange(servers.map((server) => server.ip));
  }, [servers, onSelectionChange]);

  const handleClearAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  const totalServers = servers.length;
  const selectedCount = selectedIps.length;
  const allSelected = totalServers > 0 && selectedCount === totalServers;
  const noneSelected = selectedCount === 0;

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Comparison Mode</CardTitle>
          <CardDescription>
            Compare any number of servers across the selected time range.
          </CardDescription>
        </div>
        <div className="text-sm text-muted-foreground">
          {noneSelected ? "No servers selected" : `${selectedCount.toLocaleString()} selected`}
          {totalServers > 0 ? ` • ${totalServers.toLocaleString()} total` : ""}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="mb-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <input
              type="text"
              placeholder="Filter servers by name or IP"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 lg:max-w-sm"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-white/70">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={allSelected}
                className="rounded-md border border-white/20 px-3 py-1 transition hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={noneSelected}
                className="rounded-md border border-white/20 px-3 py-1 transition hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear selection
              </button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {noneSelected
              ? "No servers selected"
              : `${selectedCount}/${totalServers || 0} selected`}
            {" "}• {timeRange.toUpperCase()} range
          </div>
          <div className="max-h-48 overflow-y-auto pr-2">
            <div className="flex flex-wrap gap-2">
              {rankedServers.map((server) => {
                const selected = selectedIps.includes(server.ip);
                const stateClasses = selected
                  ? "bg-white text-black border-white"
                  : "border-white/30 text-white/70";
                return (
                  <button
                    key={server.ip}
                    type="button"
                    onClick={() => toggleServer(server.ip)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${stateClasses} hover:border-white hover:text-white`}
                  >
                    <span>{server.name ?? server.ip}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {server.player_count.toLocaleString()} online
                    </span>
                  </button>
                );
              })}
              {rankedServers.length === 0 && (
                <div className="text-sm text-muted-foreground">No servers match your filter.</div>
              )}
            </div>
          </div>
        </div>

        <div className="h-80 w-full">
          {noneSelected ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/20 text-sm text-muted-foreground">
              Select at least one server to render the comparison chart.
            </div>
          ) : isFetching ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer>
              <LineChart data={combinedData} margin={{ left: 12, right: 18, top: 12, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(value) => formatTimestamp(Number(value))}
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                />
                <YAxis
                  domain={yDomain as [number, number]}
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                  width={60}
                  tickFormatter={(value) => Number(value).toLocaleString()}
                />
                <Tooltip
                  content={<ComparisonTooltip seriesLookup={seriesLookup} />}
                  cursor={{ stroke: "rgba(255,255,255,0.3)", strokeWidth: 1 }}
                />
                {seriesMeta.map((series) => (
                  <Line
                    key={series.ip}
                    type="monotone"
                    dataKey={series.dataKey}
                    name={series.label}
                    stroke={series.color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {statsRows.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {statsRows.map((row) => (
              <div key={row.ip} className="rounded-lg border border-white/10 p-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }}></span>
                    {row.label}
                  </span>
                  <span>{row.ip}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide">Current</div>
                    <div className="text-base font-semibold text-white">
                      {row.current.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide">Mean</div>
                    <div className="text-base font-semibold text-white">
                      {row.avg.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide">Max</div>
                    <div className="text-base font-semibold text-white">
                      {row.max.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Pie,
  PieChart,
  Cell,
} from "recharts";

const MAX_POINTS = 240;
const LINE_PALETTE = ["#22c55e", "#3b82f6", "#f97316", "#a855f7", "#ef4444", "#14b8a6"];
const DONUT_PALETTE = ["#a855f7", "#22c55e", "#0ea5e9", "#f97316", "#eab308", "#ec4899"];

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

const formatNumber = (value: number) => value.toLocaleString();

type DonutDatum = { label: string; value: number; color?: string };

function DonutCard({
  title,
  description,
  data,
  total,
}: {
  title: string;
  description: string;
  data: DonutDatum[];
  total: number;
}) {
  const colored = data.map((entry, index) => ({
    ...entry,
    value: Math.max(entry.value, 0),
    color: entry.color ?? DONUT_PALETTE[index % DONUT_PALETTE.length],
  }));
  const chartData = colored.filter((entry) => entry.value > 0);
  const hasData = chartData.length > 0;
  const pieData = hasData ? chartData : [{ label: "No data", value: 1, color: "#27272a" }];
  const legendData = colored.length ? colored : pieData;

  // Base for percentage calculation (matches the pie rendering)
  const percentBase = pieData.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-white/60">
        <span>{title}</span>
        <span>{description}</span>
      </div>
      <div className="relative mt-3 h-36 w-full">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={pieData} dataKey="value" innerRadius={45} outerRadius={70} stroke="transparent">
              {pieData.map((entry, index) => (
                <Cell key={`${entry.label}-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={<PieTooltip />}
              position={{ x: 12, y: 12 }}
              wrapperStyle={{ pointerEvents: "none", zIndex: 20 }}
              allowEscapeViewBox={{ x: true, y: true }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] uppercase tracking-[0.4em] text-white/50">Total</span>
          <span className="text-xl font-semibold text-white">{formatNumber(total)}</span>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-xs text-white/70">
        {legendData.map((entry, index) => {
          const pct = percentBase > 0 ? (entry.value / percentBase) * 100 : 0;
          return (
            <div key={`${entry.label}-meta-${index}`} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                {entry.label}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium text-white">{formatNumber(entry.value)}</span>
                <span className="text-white/60">{pct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0];
  const segment = entry?.payload as DonutDatum | undefined;
  if (!segment) return null;

  return (
    <div className="rounded-md border border-white/10 bg-black/80 px-3 py-2 text-xs text-white">
      <div className="font-medium">{segment.label}</div>
      <div className="text-sm font-semibold text-white/90">
        {formatNumber(Number(entry.value ?? 0))} players
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

  const statsLookup = useMemo(() => {
    const map = new Map<string, (typeof statsRows)[number]>();
    statsRows.forEach((row) => map.set(row.ip, row));
    return map;
  }, [statsRows]);

  const seriesColorByIp = useMemo(() => {
    const map = new Map<string, { color: string; label: string }>();
    seriesMeta.forEach((series) => map.set(series.ip, { color: series.color, label: series.label }));
    return map;
  }, [seriesMeta]);

  const selectedSet = useMemo(() => new Set(selectedIps), [selectedIps]);

  const liveTotals = useMemo(() => {
    return servers.reduce(
      (acc, server) => {
        const count = server.player_count ?? 0;
        acc.total += count;
        if (selectedSet.has(server.ip)) {
          acc.selected += count;
        }
        return acc;
      },
      { total: 0, selected: 0 },
    );
  }, [servers, selectedSet]);

  const globalDonutData: DonutDatum[] = liveTotals.total
    ? [
        { label: "Selected", value: liveTotals.selected, color: "#a855f7" },
        { label: "Others", value: Math.max(liveTotals.total - liveTotals.selected, 0), color: "#1f2937" },
      ]
    : [];

  const selectedDonutData: DonutDatum[] = selectedIps.map((ip, index) => {
    const stats = statsLookup.get(ip);
    const server = serverLookup.get(ip);
    const fallbackColor = DONUT_PALETTE[index % DONUT_PALETTE.length];
    return {
      label: server?.name ?? ip,
      value: stats?.current ?? server?.player_count ?? 0,
      color: seriesColorByIp.get(ip)?.color ?? fallbackColor,
    };
  });

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

  const chartContent = noneSelected ? (
    <div className="flex h-full items-center justify-center text-sm text-white/60">
      Select at least one server from the panel on the right.
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
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="flex-1 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  {noneSelected ? "Comparison mode" : "Selected servers overview"}
                </p>
                <p className="text-3xl font-semibold text-white">{formatNumber(liveTotals.selected)}</p>
                <p className="text-sm text-white/60">
                  {noneSelected
                    ? "Pick servers from the list to begin"
                    : `${selectedCount.toLocaleString()} of ${totalServers.toLocaleString()} servers selected`}
                </p>
              </div>
              <div className="text-right text-xs uppercase tracking-wide text-white/60">
                <div>{timeRange.toUpperCase()} range</div>
                <div>{selectedCount ? "Live players" : "Waiting for data"}</div>
              </div>
            </div>
            <div className="h-90 w-full rounded-xl border border-white/5 bg-black/40 p-3">{chartContent}</div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
            <DonutCard
              title="Global players overview"
              description="Live distribution"
              data={globalDonutData}
              total={liveTotals.total}
            />
            <DonutCard
              title="Selected servers overview"
              description="Selection breakdown"
              data={selectedDonutData}
              total={liveTotals.selected}
            />
          </div>
        </div>
        <div className="xl:w-105">
          <div className="rounded-2xl border border-white/10 bg-black/60">
            <div className="border-b border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
                <span>Server directory</span>
                <span>
                  {selectedCount.toLocaleString()}/{totalServers.toLocaleString()} selected
                </span>
              </div>
              <input
                type="text"
                placeholder="Filter by name or IP"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
              />
              <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-white/60">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={allSelected}
                  className="rounded-full border border-white/20 px-3 py-1 transition hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={noneSelected}
                  className="rounded-full border border-white/20 px-3 py-1 transition hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Clear selection
                </button>
              </div>
            </div>
            <div>
              <div className="grid grid-cols-[minmax(0,1.6fr)_repeat(3,90px)] items-center gap-4 px-4 py-3 text-[11px] uppercase tracking-wide text-white/50">
                <span>Servers</span>
                <span className="text-right">Current</span>
                <span className="text-right">Mean</span>
                <span className="text-right">Max</span>
              </div>
              <div className="max-h-130 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25">
                {rankedServers.map((server) => {
                  const selected = selectedIps.includes(server.ip);
                  const color = seriesColorByIp.get(server.ip)?.color ?? "#3f3f46";
                  const stats = statsLookup.get(server.ip);
                  const current = stats?.current ?? server.player_count ?? 0;
                  const avg = stats?.avg ?? server.player_count ?? 0;
                  const max = stats?.max ?? server.peak ?? server.player_count ?? 0;

                  return (
                    <button
                      key={server.ip}
                      type="button"
                      onClick={() => toggleServer(server.ip)}
                      className={`relative grid min-w-0 grid-cols-[minmax(0,1.6fr)_repeat(3,90px)] items-center gap-4 px-4 py-3 text-left transition ${
                        selected ? "bg-white/10" : "hover:bg-white/5"
                      }`}
                    >
                      {selected && (
                        <span
                          className="absolute inset-y-1 left-0 w-1 rounded-full"
                          style={{ backgroundColor: color }}
                        ></span>
                      )}
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }}></span>
                        <div className="flex min-w-0 items-center gap-3">
                          {server.icon ? (
                            <img
                              src={server.icon}
                              alt={server.name ?? server.ip}
                              className="h-10 w-10 rounded-lg border border-white/10 object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/70">
                              {(server.name ?? server.ip).slice(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">{server.name ?? server.ip}</div>
                            <div className="truncate text-xs text-white/50">{server.ip}</div>
                          </div>
                        </div>
                      </div>
                      <span className="text-right font-mono text-sm text-white tabular-nums">
                        {formatNumber(current)}
                      </span>
                      <span className="text-right font-mono text-sm text-white/80 tabular-nums">
                        {formatNumber(avg)}
                      </span>
                      <span className="text-right font-mono text-sm text-green-300 tabular-nums">
                        {formatNumber(max)}
                      </span>
                    </button>
                  );
                })}
                {rankedServers.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-white/60">
                    No servers match your filters.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import LoadingScreen from "@/components/LoadingScreen";
import ServerCard from "@/components/servers/ServerCard";
import ServerHeader from "@/components/servers/ServerHeader";
import ServerSortingSelect, { SortOption } from "@/components/servers/ServerSortingSelect";
import ServerTimeSelect, { TimeOption } from "@/components/servers/ServerTimeSelect";
import { useWebSocket } from "@/hooks/useWebSocket";
import { parseLiveDataPayload, type LiveDataPoint } from "@/lib/liveData";
import { getServers } from "@/lib/serverData";
import { Server } from "@/types/server";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Search, X } from "lucide-react";

export default function Home() {
  const { isConnected, on, off } = useWebSocket();
  const [servers, setServers] = useState<Server[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("most-players");
  const [timeRange, setTimeRange] = useState<TimeOption>("7d");
  const [hiddenMap, setHiddenMap] = useState<Record<string, boolean>>({});
  const [syncTimestamp, setSyncTimestamp] = useState<number | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const manageRef = useRef<HTMLDivElement | null>(null);

  // close dropdown when clicking outside
  useEffect(() => {
    function onDocClick(e: Event) {
      if (!manageOpen) return;
      const el = manageRef.current;
      if (!el) return;
      if (!(e.target instanceof Node)) return;
      if (!el.contains(e.target)) setManageOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setManageOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [manageOpen]);
  const selectionInitializedRef = useRef(false);
  const prevServerCountRef = useRef(0);
  const applyLiveUpdates = useCallback((rawPoints: unknown[]) => {
    const normalized = rawPoints
      .map(parseLiveDataPayload)
      .filter((point): point is LiveDataPoint => Boolean(point));

    if (!normalized.length) {
      return;
    }

    const byIp = new Map(normalized.map((point) => [point.ip, point]));
    let applied = false;

    setServers((prev) => {
      if (prev.length === 0) {
        return prev;
      }

      const next = prev.map((server) => {
        const update = byIp.get(server.ip);
        if (!update || server.player_count === update.playerCount) {
          return server;
        }

        applied = true;
        return { ...server, player_count: update.playerCount };
      });

      return applied ? next : prev;
    });
  }, []);
  
  // set first servers on initial render using getServers from serverData.ts
  useEffect(() => {
    async function fetchInitialServers() {
      const initialServers = await getServers();
      setServers(initialServers);
    }
    fetchInitialServers();
  }, []);

  const globalPlayercount = useMemo(() => {
    // only sum visible servers
    return servers
      .filter((s) => !hiddenMap[s.ip])
      .reduce((sum, server) => sum + server.player_count, 0);
  }, [servers, hiddenMap]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleRealtimePoint = (payload: any) => {
      if (!payload?.data) {
        return;
      }
      applyLiveUpdates([payload.data]);
    };

    on("data_point_rt", handleRealtimePoint);

    return () => {
      off("data_point_rt", handleRealtimePoint);
    };
  }, [applyLiveUpdates, on, off]);

  const sortedServers = useMemo(() => {
    return [...servers].sort((a, b) => {
      switch (sortOption) {
        case "most-players":
          return b.player_count - a.player_count;
        case "least-players":
          return a.player_count - b.player_count;
        case "highest-peak":
          return b.peak - a.peak;
        case "lowest-peak":
          return a.peak - b.peak;
        default:
          return 0;
      }
    });
  }, [servers, sortOption]);

  useEffect(() => {
    if (servers.length === 0) {
      prevServerCountRef.current = 0;
      selectionInitializedRef.current = false;
      return;
    }

    const serverIps = servers.map((server) => server.ip);
    prevServerCountRef.current = serverIps.length;
  }, [servers]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const prevBodyOverflow = document.body.style.overflow;
    const prevRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevRootOverflow;
    };
  }, []);

  return (
    <div className="min-h-screen bg-black p-6 sm:p-8">
      {!isConnected && <LoadingScreen message="Connecting to backend..." />}
      {!servers.length && isConnected && <LoadingScreen message="Loading server data..." />}

        <>
          <div className="mb-6">
            <ServerHeader
              servers={servers.filter((s) => !hiddenMap[s.ip]).length}
              totalPlayers={globalPlayercount}
            />
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3 rounded-2xl bg-white/5 p-3">
              <ServerTimeSelect value={timeRange} onValueChange={setTimeRange} />
              <ServerSortingSelect value={sortOption} onValueChange={setSortOption} />
              <div className="ml-2 flex gap-2 relative" ref={manageRef}>
                <button
                  type="button"
                  className="rounded px-3 py-1 text-sm bg-white/5"
                  onClick={() => {
                    const map: Record<string, boolean> = {};
                    servers.forEach((s) => (map[s.ip] = true));
                    setHiddenMap(map);
                  }}
                >
                  Hide All
                </button>
                <button
                  type="button"
                  className="rounded px-3 py-1 text-sm bg-white/5"
                  onClick={() => setHiddenMap({})}
                >
                  Show All
                </button>
                <button
                  type="button"
                  className="rounded-md border border-white/10 px-3 py-1 text-sm bg-white/5 hover:bg-white/7 inline-flex items-center gap-2"
                  onClick={() => setManageOpen((v) => !v)}
                  aria-expanded={manageOpen}
                  aria-controls="manage-dropdown"
                >
                  <Search className="size-4 opacity-70" />
                  Manage
                </button>

                {manageOpen && (
                  <div id="manage-dropdown" className="absolute right-0 mt-2 w-72 max-h-80 overflow-auto no-scrollbar rounded-md border bg-popover p-3 shadow-lg z-50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="relative flex-1">
                        <input
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search servers"
                          className="w-full rounded border border-white/6 px-8 py-1 text-sm bg-transparent placeholder:text-muted-foreground"
                        />
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-70">
                          <Search className="size-4" />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setManageOpen(false)}
                        aria-label="Close"
                        className="rounded-md p-1 hover:bg-white/6"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {sortedServers
                        .filter((s) =>
                          `${s.name || s.ip} ${s.ip}`.toLowerCase().includes(searchTerm.toLowerCase()),
                        )
                        .map((s) => (
                          <label key={s.ip} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-accent">
                            <div className="truncate text-sm">{s.name || s.ip}</div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setHiddenMap((prev) => ({ ...prev, [s.ip]: !prev[s.ip] }))}
                                className="rounded-md border border-white/8 px-2 py-0.5 text-xs bg-transparent hover:bg-white/6 inline-flex items-center gap-2"
                                aria-pressed={Boolean(hiddenMap[s.ip])}
                              >
                                {hiddenMap[s.ip] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                <span className="sr-only">{hiddenMap[s.ip] ? 'Show' : 'Hide'}</span>
                              </button>
                            </div>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedServers
              .filter((s) => !hiddenMap[s.ip])
              .map((server, idx) => (
                <ServerCard
                  server={server}
                  key={server.ip}
                  position={idx + 1}
                  timeRange={timeRange}
                  hidden={Boolean(hiddenMap[server.ip])}
                  onToggleHidden={(ip) =>
                    setHiddenMap((prev) => ({ ...prev, [ip]: !prev[ip] }))
                  }
                  syncTimestamp={syncTimestamp}
                  onSyncTimestamp={(ts) => setSyncTimestamp(ts)}
                />
              ))}
          </div>
        </>
    </div>
  );
}
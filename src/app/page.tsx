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

export default function Home() {
  const { isConnected, on, off } = useWebSocket();
  const [servers, setServers] = useState<Server[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("most-players");
  const [timeRange, setTimeRange] = useState<TimeOption>("7d");
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
    return (servers ?? []).reduce((acc, server) => acc + server.player_count, 0);
  }, [servers]);

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
              servers={servers.length}
              totalPlayers={globalPlayercount}
            />
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3 rounded-2xl bg-white/5 p-3">
              <ServerTimeSelect value={timeRange} onValueChange={setTimeRange} />
              <ServerSortingSelect value={sortOption} onValueChange={setSortOption} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedServers.map((server) => (
              <ServerCard server={server} key={server.ip} timeRange={timeRange} />
            ))}
          </div>
        </>
    </div>
  );
}
"use client";

import LoadingScreen from '@/components/LoadingScreen';
import ServerCard from '@/components/servers/ServerCard';
import ServerComparisonPanel from '@/components/servers/ServerComparisonPanel';
import ServerHeader from '@/components/servers/ServerHeader';
import ServerSortingSelect, { SortOption } from '@/components/servers/ServerSortingSelect';
import ServerTimeSelect, { TimeOption } from '@/components/servers/ServerTimeSelect';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Server } from '@/types/server';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export default function Home() {
  const { isConnected, on, off } = useWebSocket();
  const [servers, setServers] = useState<Server[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('most-players');
  const [timeRange, setTimeRange] = useState<TimeOption>('7d');
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonSelection, setComparisonSelection] = useState<string[]>([]);
  const selectionInitializedRef = useRef(false);
  const prevServerCountRef = useRef(0);

  useEffect(() => {
    const handleServersUpdate = (data: { servers: Server[] }) => {
      if (data.servers) {
        setServers(data.servers);
      }
    };

    on('servers_update', handleServersUpdate);

    return () => {
      off('servers_update', handleServersUpdate);
    };
  }, [on, off]);

  const sortedServers = useMemo(() => {
    return [...servers].sort((a, b) => {
      switch (sortOption) {
        case 'most-players':
          return b.player_count - a.player_count;
        case 'least-players':
          return a.player_count - b.player_count;
        case 'highest-peak':
          return b.peak - a.peak;
        case 'lowest-peak':
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
    const prevCount = prevServerCountRef.current;
    prevServerCountRef.current = serverIps.length;

    setComparisonSelection((prev) => {
      if (!selectionInitializedRef.current) {
        selectionInitializedRef.current = true;
        return serverIps;
      }

      const filtered = prev.filter((ip) => serverIps.includes(ip));
      const wasAllSelected = prevCount > 0 && prev.length === prevCount;

      if (wasAllSelected) {
        if (
          filtered.length === serverIps.length &&
          filtered.every((ip, index) => ip === serverIps[index])
        ) {
          return prev;
        }
        return serverIps;
      }

      if (filtered.length !== prev.length) {
        return filtered;
      }

      return prev;
    });
  }, [servers]);

  const handleSelectionChange = useCallback((ips: string[]) => {
    selectionInitializedRef.current = true;
    const unique = Array.from(new Set(ips));
    setComparisonSelection(unique);
  }, []);

  return (
    <div className="bg-black min-h-screen p-8">
      {(!isConnected) && <LoadingScreen message="Connecting to backend..." />}
      {!servers.length && isConnected && <LoadingScreen message={`Loading server data...`} />}

      <div className="mb-6">
        <ServerHeader servers={servers.length} totalPlayers={servers.reduce((acc, server) => acc + server.player_count, 0)} />
        <div className="flex flex-wrap items-center justify-end mb-4 p-2 gap-3">
          <ServerTimeSelect value={timeRange} onValueChange={setTimeRange} />
          <ServerSortingSelect value={sortOption} onValueChange={setSortOption} />
          <button
            type="button"
            onClick={() => setShowComparison((prev) => !prev)}
            className="rounded-md border border-white/20 px-4 py-2 text-sm text-white transition hover:border-white hover:bg-white/10"
          >
            {showComparison ? 'Hide' : 'Show'} comparison
          </button>
        </div>
      </div>

      {showComparison && (
        <ServerComparisonPanel
          servers={sortedServers}
          timeRange={timeRange}
          selectedIps={comparisonSelection}
          onSelectionChange={handleSelectionChange}
        />
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedServers.map((server) => (
          <ServerCard server={server} key={server.ip} timeRange={timeRange} />
        ))}
      </div>
    </div>
  );
}
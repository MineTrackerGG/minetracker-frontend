"use client";

import LoadingScreen from '@/components/LoadingScreen';
import ServerCard from '@/components/servers/ServerCard';
import ServerHeader from '@/components/servers/ServerHeader';
import ServerSortingSelect, { SortOption } from '@/components/servers/ServerSortingSelect';
import ServerTimeSelect, { TimeOption } from '@/components/servers/ServerTimeSelect';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Server } from '@/types/server';
import { useEffect, useState, useMemo } from 'react';

export default function Home() {
  const { isConnected, on, off } = useWebSocket();
  const [servers, setServers] = useState<Server[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('most-players');
  const [timeRange, setTimeRange] = useState<TimeOption>('7d');

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

  return (
    <div className="bg-black min-h-screen p-8">
      {(!isConnected) && <LoadingScreen message="Connecting to backend..." />}
      {!servers.length && isConnected && <LoadingScreen message={`Loading server data...`} />}

      <div className="mb-6">
        <ServerHeader servers={servers.length} totalPlayers={servers.reduce((acc, server) => acc + server.player_count, 0)} />
        <div className="flex justify-end mb-4 p-2 gap-4">
          <ServerTimeSelect value={timeRange} onValueChange={setTimeRange} />
          <ServerSortingSelect value={sortOption} onValueChange={setSortOption} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedServers.map((server) => (
          <ServerCard server={server} key={server.ip} timeRange={timeRange} />
        ))}
      </div>
    </div>
  );
}
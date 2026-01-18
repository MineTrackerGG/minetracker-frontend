"use client";

import LoadingScreen from '@/components/LoadingScreen';
import ServerCard from '@/components/servers/ServerCard';
import ServerHeader from '@/components/servers/ServerHeader';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Server } from '@/types/server';
import { useEffect, useState } from 'react';

export default function Home() {
  const { isConnected, on, off } = useWebSocket();
  const [servers, setServers] = useState<Server[]>([]);

  useEffect(() => {
    const handleServersUpdate = (data: { servers: Server[] }) => {
      if (data.servers) {
        // Sort servers by player_count in descending order
        const sortedServers = [...data.servers].sort((a, b) => b.player_count - a.player_count);
        setServers(sortedServers);
      }
    };

    on('servers_update', handleServersUpdate);

    return () => {
      off('servers_update', handleServersUpdate);
    };
  }, [on, off]);

  return (
    <div className="bg-black min-h-screen p-8">
      {(!isConnected) && <LoadingScreen message="Connecting to backend..." />}
      {!servers.length && isConnected && <LoadingScreen message={`Loading server data...`} />}

      <div className="mb-6">
        <ServerHeader servers={servers.length} totalPlayers={servers.reduce((acc, server) => acc + server.player_count, 0)} />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {servers.map((server) => (
          <ServerCard server={server} key={server.ip} />
        ))}
      </div>
    </div>
  );
}
import { Server, ServerDataPoint, ServerDataQuery } from "@/types/server";

export async function getDataPoints(server: string, duration: string) : Promise<ServerDataQuery> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/${server}/${duration}`);

    if (!response.ok) {
        return { data: {} } as ServerDataQuery;
    }

    const data = await response.json();
    return data;
}

export async function getServers(): Promise<Server[]> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/servers`);

    if (!response.ok) {
        return [];
    }
    const data = await response.json();
    return data;
}

export type BulkServerDataResponse = {
    data: Record<string, ServerDataPoint[]>;
};

export async function getBulkServerData(servers: string[], duration: string): Promise<BulkServerDataResponse> {
    if (servers.length === 0) {
        return { data: {} };
    }

    const joinedServers = servers.join(",");
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/bulk/${joinedServers}/${duration}`);

    if (!response.ok) {
        return { data: {} };
    }

    const data = await response.json();
    return data;
}
import { ServerDataQuery } from "@/types/server";

export async function getDataPoints(server: string, duration: string) : Promise<ServerDataQuery> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/${server}/${duration}`);

    if (!response.ok) {
        throw new Error('Failed to fetch server data points: ' + response.statusText);
    }

    const data = await response.json();
    return data;
}
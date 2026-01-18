export type Server = {
    name: string;
    ip: string;
    icon: string;
    type: string;
    online: boolean;
    player_count: number;
    peak: number;
}

export type ServerDataPoint = {
    timestamp: bigint;
    player_count: number;
    ip: string;
    name: string;
}

export type ServerDataQuery = {
    step: string;
    data: ServerDataPoint[];
}
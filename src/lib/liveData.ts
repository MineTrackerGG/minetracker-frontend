import { ServerDataPoint } from "@/types/server";

const MAX_PLAYER_COUNT = 100_000;

export type LiveDataPoint = {
  ip: string;
  name: string;
  playerCount: number;
  timestamp: number;
};

const normalizeToNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
};

export function parseLiveDataPayload(payload: unknown): LiveDataPoint | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const raw = payload as Record<string, unknown>;
  const ip = (raw.ip ?? raw.Ip ?? raw.IP) as string | undefined;
  const nameCandidate = (raw.name ?? raw.Name ?? ip) as string | undefined;
  const countCandidate = raw.player_count ?? raw.playerCount ?? raw.PlayerCount;
  const timestampCandidate = raw.timestamp ?? raw.Timestamp ?? raw.ts ?? raw.Ts;

  const playerCount = normalizeToNumber(countCandidate);
  const timestamp = normalizeToNumber(timestampCandidate ?? Math.floor(Date.now() / 1000));

  if (!ip || typeof ip !== "string") {
    return null;
  }

  if (
    playerCount == null ||
    playerCount < 0 ||
    playerCount > MAX_PLAYER_COUNT ||
    !Number.isFinite(playerCount)
  ) {
    return null;
  }

  if (timestamp == null || !Number.isFinite(timestamp)) {
    return null;
  }

  return {
    ip,
    name: nameCandidate && nameCandidate.trim().length > 0 ? nameCandidate : ip,
    playerCount: Math.round(playerCount),
    timestamp: Math.floor(timestamp),
  };
}

export function livePointToServerDataPoint(point: LiveDataPoint): ServerDataPoint {
  return {
    ip: point.ip,
    name: point.name,
    player_count: point.playerCount,
    timestamp: point.timestamp,
  };
}

import { useMemo } from "react";
import { ServerDataPoint } from "@/types/server";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function downsampleSparklineData(
  dataPoints: ServerDataPoint[],
  maxPoints = 50
): ServerDataPoint[] {
  if (dataPoints.length <= 2 || maxPoints <= 2 || dataPoints.length <= maxPoints) {
    return dataPoints;
  }

  // Keep a live tail untouched so the newest points are not flattened by bucketing.
  const tailKeep = clamp(Math.floor(maxPoints * 0.22), 8, 64);
  const canSplit = dataPoints.length > tailKeep + 2 && maxPoints > tailKeep + 2;

  const source = canSplit ? dataPoints.slice(0, -tailKeep) : dataPoints;
  const tail = canSplit ? dataPoints.slice(-tailKeep) : [];

  const first = source[0];
  const last = source[source.length - 1];
  const interior = source.slice(1, -1);

  if (source.length <= 2) {
    return [...source, ...tail].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  }

  // Each bucket contributes up to 2 points (min and max), plus first/last.
  const headBudget = canSplit ? Math.max(3, maxPoints - tail.length) : maxPoints;
  const bucketCount = clamp(Math.floor((headBudget - 2) / 2), 1, interior.length);
  const bucketSize = interior.length / bucketCount;

  const sampled: ServerDataPoint[] = [first];

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex++) {
    const start = Math.floor(bucketIndex * bucketSize);
    const end = Math.min(interior.length, Math.floor((bucketIndex + 1) * bucketSize));
    const bucket = interior.slice(start, end);

    if (bucket.length === 0) {
      continue;
    }

    let minPoint = bucket[0];
    let maxPoint = bucket[0];

    for (const point of bucket) {
      if (point.player_count < minPoint.player_count) minPoint = point;
      if (point.player_count > maxPoint.player_count) maxPoint = point;
    }

    if (minPoint.timestamp <= maxPoint.timestamp) {
      sampled.push(minPoint);
      if (maxPoint.timestamp !== minPoint.timestamp) sampled.push(maxPoint);
    } else {
      sampled.push(maxPoint);
      sampled.push(minPoint);
    }
  }

  if (sampled[sampled.length - 1]?.timestamp !== last.timestamp) {
    sampled.push(last);
  }

  const combined = [...sampled, ...tail].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

  // Hard-cap in case of timestamp collisions causing more than expected points.
  if (combined.length <= maxPoints) {
    return combined;
  }

  const evenlySpaced: ServerDataPoint[] = [];
  const step = (combined.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    evenlySpaced.push(combined[Math.round(i * step)]);
  }

  evenlySpaced[0] = dataPoints[0];
  evenlySpaced[evenlySpaced.length - 1] = dataPoints[dataPoints.length - 1];
  return evenlySpaced;
}

export function useSparklineData(
  dataPoints: ServerDataPoint[],
  maxPoints = 50
) {
  return useMemo((): ServerDataPoint[] => {
    if (dataPoints.length === 0) return [];
    return downsampleSparklineData(dataPoints, maxPoints);
  }, [dataPoints, maxPoints]);
}
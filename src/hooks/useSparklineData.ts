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

  const first = dataPoints[0];
  const last = dataPoints[dataPoints.length - 1];
  const interior = dataPoints.slice(1, -1);

  // Each bucket contributes up to 2 points (min and max), plus first/last.
  const bucketCount = clamp(Math.floor((maxPoints - 2) / 2), 1, interior.length);
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

  sampled.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

  // Hard-cap in case of timestamp collisions causing more than expected points.
  if (sampled.length <= maxPoints) {
    return sampled;
  }

  const evenlySpaced: ServerDataPoint[] = [];
  const step = (sampled.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    evenlySpaced.push(sampled[Math.round(i * step)]);
  }

  evenlySpaced[0] = first;
  evenlySpaced[evenlySpaced.length - 1] = last;
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
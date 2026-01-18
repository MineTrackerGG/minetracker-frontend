import { useMemo } from "react";
import { ServerDataPoint } from "@/types/server";

export function useSparklineData(
  dataPoints: ServerDataPoint[],
  maxPoints = 50
) {
  return useMemo(() => {
    if (dataPoints.length === 0) return [];

    if (dataPoints.length <= maxPoints) {
      return dataPoints.map(d => d.player_count);
    }

    const step = Math.ceil(dataPoints.length / maxPoints);
    const result: number[] = [];

    for (let i = 0; i < dataPoints.length; i += step) {
      result.push(dataPoints[i].player_count);
    }

    return result;
  }, [dataPoints, maxPoints]);
}
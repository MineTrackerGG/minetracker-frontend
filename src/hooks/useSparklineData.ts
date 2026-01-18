import { useMemo } from "react";
import { ServerDataPoint } from "@/types/server";

export function useSparklineData(
  dataPoints: ServerDataPoint[],
  maxPoints = 50
) {
  return useMemo((): ServerDataPoint[] => {
    if (dataPoints.length === 0) return [];

    if (dataPoints.length <= maxPoints) {
      return dataPoints;
    }

    const step = Math.ceil(dataPoints.length / maxPoints);
    const result: ServerDataPoint[] = [];

    for (let i = 0; i < dataPoints.length; i += step) {
      result.push(dataPoints[i]);
    }

    const lastPoint = dataPoints[dataPoints.length - 1];
    if (result[result.length - 1]?.timestamp !== lastPoint.timestamp) {
      result.push(lastPoint);
    }

    return result;
  }, [dataPoints, maxPoints]);
}
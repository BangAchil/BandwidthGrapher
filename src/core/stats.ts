export type BandwidthStats = {
  current: number;
  avg: number;
  max: number;
};

export function calculateStats(data: Array<number | null>): BandwidthStats {
  const filteredData = data.filter((value): value is number => value !== null && value >= 0);

  if (filteredData.length === 0) {
    return { current: 0, avg: 0, max: 0 };
  }

  const sum = filteredData.reduce((total, value) => total + value, 0);
  const last = data[data.length - 1];

  return {
    current: last ?? 0,
    avg: sum / filteredData.length,
    max: Math.max(...filteredData),
  };
}

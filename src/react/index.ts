export type BandwidthGrapherRef = {
  appendPoint: (point: import("../core/types").BandwidthPoint) => void;
  pushTimeout: () => void;
};

export function BandwidthGrapher(): null {
  return null;
}

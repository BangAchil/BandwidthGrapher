export type BandwidthPointStatus = "ok" | "timeout" | "error";

export type BandwidthPoint = {
  time: Date | number | string;
  inboundBps: number | null;
  outboundBps: number | null;
  status?: BandwidthPointStatus;
};

export type BandwidthTitle = {
  host?: string;
  ip?: string;
  interfaceName?: string;
};

export type BandwidthThreshold = {
  valueBps: number;
  label?: string;
  color?: string;
};

export type BandwidthGrapherOptions = {
  title?: BandwidthTitle;
  maxDataPoints?: number;
  intervalSeconds?: number;
  autoScale?: boolean;
  hardCapBps?: number;
  thresholds?: BandwidthThreshold[];
  legend?: {
    visible?: boolean;
    inboundLabel?: string;
    outboundLabel?: string;
  };
};

export type BandwidthRange = {
  start: Date | number | string;
  end: Date | number | string;
};

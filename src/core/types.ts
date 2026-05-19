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
  lineDash?: number[];
};

export type BandwidthGraphStyle = "step" | "linear";

export type BandwidthDataMode = "live" | "history" | "history-live";

export type BandwidthGrapherColors = {
  background: string;
  grid: string;
  gridHighlight: string;
  border: string;
  text: string;
  textSummary: string;
  textWatermark: string;
  inboundFill: string;
  outboundLine: string;
  timeoutFill: string;
  thresholdLine: string;
  selectionFill: string;
  selectionBorder: string;
  tooltipBackground: string;
  tooltipText: string;
};

export type BandwidthGrapherLegendOptions = {
  visible: boolean;
  inboundLabel: string;
  outboundLabel: string;
};

export type BandwidthGrapherScaleOptions = {
  autoScale: boolean;
  initialMaxBps: number;
  headroom: number;
  hardCapBps: number;
  minY?: number;
  maxY?: number;
};

export type BandwidthGrapherInteractionOptions = {
  tooltip: boolean;
  hoverLine: boolean;
  wheelZoom: boolean;
  dragPan: boolean;
  dragSelectZoom: boolean;
  selectionMinWidth: number;
  minRangeMs: number;
  maxRangeMs?: number;
};

export type BandwidthGrapherOptions = {
  title: BandwidthTitle;
  maxDataPoints: number;
  intervalSeconds: number;
  graphStyle: BandwidthGraphStyle;
  outboundLineWidth: number;
  areaHeightFactor: number;
  watermarkText: string;
  colors: BandwidthGrapherColors;
  legend: BandwidthGrapherLegendOptions;
  scale: BandwidthGrapherScaleOptions;
  interaction: BandwidthGrapherInteractionOptions;
  thresholds: BandwidthThreshold[];
  yAxisFormatter?: (valueBps: number) => string;
};

export type BandwidthGrapherUserOptions = Partial<
  Omit<BandwidthGrapherOptions, "colors" | "legend" | "scale" | "interaction">
> & {
  colors?: Partial<BandwidthGrapherColors>;
  legend?: Partial<BandwidthGrapherLegendOptions>;
  scale?: Partial<BandwidthGrapherScaleOptions>;
  interaction?: Partial<BandwidthGrapherInteractionOptions>;
};

export type BandwidthRange = {
  start: Date | number | string;
  end: Date | number | string;
};

export type BandwidthSetDataOptions = {
  mode?: BandwidthDataMode;
  range?: BandwidthRange | "data";
  followLive?: boolean;
};

export type BandwidthGrapherSnapshot = {
  points: BandwidthPoint[];
  range: BandwidthRange | null;
  mode: BandwidthDataMode;
  followLive: boolean;
  options: BandwidthGrapherOptions;
};

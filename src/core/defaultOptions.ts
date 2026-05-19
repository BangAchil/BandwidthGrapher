import type { BandwidthGrapherOptions, BandwidthGrapherUserOptions } from "./types";

export const defaultOptions: BandwidthGrapherOptions = {
  title: {
    host: "",
    ip: "",
    interfaceName: "",
  },
  maxDataPoints: 400,
  intervalSeconds: 2,
  graphStyle: "step",
  outboundLineWidth: 1,
  areaHeightFactor: 1,
  watermarkText: "KING OLT",
  colors: {
    background: "#f8fafc",
    grid: "#e2e8f0",
    gridHighlight: "#ef4444",
    border: "#94a3b8",
    text: "#1f2937",
    textSummary: "#1f2937",
    textWatermark: "rgba(15, 23, 42, 0.14)",
    inboundFill: "#2bc56a",
    outboundLine: "#0050ff",
    timeoutFill: "#b91c1c",
    thresholdLine: "#f59e0b",
    tooltipBackground: "rgba(15, 23, 42, 0.92)",
    tooltipText: "#ffffff",
  },
  legend: {
    visible: true,
    inboundLabel: "Inbound",
    outboundLabel: "Outbound",
  },
  scale: {
    autoScale: true,
    initialMaxBps: 10_000,
    headroom: 1.2,
    hardCapBps: 10_000_000_000,
  },
  interaction: {
    tooltip: true,
    hoverLine: true,
  },
  thresholds: [],
};

export function resolveOptions(options: BandwidthGrapherUserOptions = {}): BandwidthGrapherOptions {
  return {
    ...defaultOptions,
    ...options,
    title: {
      ...defaultOptions.title,
      ...options.title,
    },
    colors: {
      ...defaultOptions.colors,
      ...options.colors,
    },
    legend: {
      ...defaultOptions.legend,
      ...options.legend,
    },
    scale: {
      ...defaultOptions.scale,
      ...options.scale,
    },
    interaction: {
      ...defaultOptions.interaction,
      ...options.interaction,
    },
    thresholds: options.thresholds ? options.thresholds.slice() : defaultOptions.thresholds.slice(),
  };
}

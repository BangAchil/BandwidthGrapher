import type { BandwidthGrapherUserOptions } from "../core/types";

export const kingNmsTheme: BandwidthGrapherUserOptions = {
  watermarkText: "KING NMS",
  colors: {
    background: "#071426",
    grid: "rgba(148, 163, 184, 0.18)",
    gridHighlight: "#ff8a1d",
    border: "#1f3b5d",
    text: "#e5edf7",
    textSummary: "#e5edf7",
    textWatermark: "rgba(255, 138, 29, 0.16)",
    inboundFill: "#ff8a1d",
    outboundLine: "#4aa3ff",
    timeoutFill: "#c91f1f",
    thresholdLine: "#ffb020",
    selectionFill: "rgba(255, 138, 29, 0.18)",
    selectionBorder: "#ff8a1d",
    tooltipBackground: "rgba(3, 10, 24, 0.94)",
    tooltipText: "#ffffff",
  },
  legend: {
    inboundLabel: "Inbound",
    outboundLabel: "Outbound",
  },
};

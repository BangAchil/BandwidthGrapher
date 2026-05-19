import { BandwidthGrapherEngine, kingNmsTheme, type BandwidthGrapherEngine as GraphEngine, type BandwidthPoint } from "../../src";

const originalContainer = document.getElementById("graph-original");
const kingNmsContainer = document.getElementById("graph-king-nms");

if (!originalContainer || !kingNmsContainer) {
  throw new Error("Graph containers not found.");
}

const baseOptions = {
  title: {
    host: "Router 2",
    ip: "103.158.27.6",
    interfaceName: "FTTH Main Link",
  },
  maxDataPoints: 400,
  intervalSeconds: 2,
  scale: {
    initialMaxBps: 1_000_000_000,
  },
};

const originalGraph = new BandwidthGrapherEngine(originalContainer, {
  ...baseOptions,
  watermarkText: "KING OLT",
});

const kingNmsGraph = new BandwidthGrapherEngine(kingNmsContainer, {
  ...baseOptions,
  ...kingNmsTheme,
});

const graphs: GraphEngine[] = [originalGraph, kingNmsGraph];

let timer: number | null = null;
let thresholdsEnabled = false;

loadHistory();
startLive();

document.getElementById("live")?.addEventListener("click", startLive);
document.getElementById("timeout")?.addEventListener("click", () => {
  pushToGraphs((graph) => graph.pushTimeout());
});
document.getElementById("timeout-range")?.addEventListener("click", pushTimeoutRange);
document.getElementById("history")?.addEventListener("click", loadHistory);
document.getElementById("threshold")?.addEventListener("click", toggleThreshold);
document.getElementById("export")?.addEventListener("click", () => {
  const url = kingNmsGraph.exportImage();
  const link = document.createElement("a");
  link.href = url;
  link.download = "bandwidth-grapher-king-nms.png";
  link.click();
});

function startLive(): void {
  if (timer !== null) window.clearInterval(timer);
  timer = window.setInterval(() => {
    const point = createPoint(new Date());
    pushToGraphs((graph) => graph.appendPoint(point));
  }, 2_000);
}

function loadHistory(): void {
  const now = Date.now();
  const points: BandwidthPoint[] = [];

  for (let index = 399; index >= 0; index -= 1) {
    const time = new Date(now - index * 2_000);
    points.push(createPoint(time));
  }

  pushToGraphs((graph) => graph.setData(points));
}

function toggleThreshold(): void {
  thresholdsEnabled = !thresholdsEnabled;
  pushToGraphs((graph) => {
    graph.setOptions({
      thresholds: thresholdsEnabled
        ? [
            { valueBps: 500_000_000, label: "Warning 500M", color: "#ffb020" },
            { valueBps: 800_000_000, label: "Critical 800M", color: "#ef4444" },
          ]
        : [],
    });
  });
}

function pushTimeoutRange(): void {
  if (timer !== null) window.clearInterval(timer);

  const start = Date.now();
  for (let index = 0; index < 12; index += 1) {
    const time = new Date(start + index * 2_000);
    pushToGraphs((graph) => graph.pushTimeout(time));
  }

  const point = createPoint(new Date(start + 24_000));
  pushToGraphs((graph) => graph.appendPoint(point));
}

function pushToGraphs(callback: (graph: GraphEngine) => void): void {
  graphs.forEach(callback);
}

function createPoint(time: Date): BandwidthPoint {
  const burst = Math.random() > 0.82 ? 380_000_000 + Math.random() * 260_000_000 : 0;
  const inboundBps = 180_000_000 + Math.random() * 110_000_000 + burst;
  const outboundBps = 18_000_000 + Math.random() * 35_000_000 + burst * 0.08;

  return {
    time,
    inboundBps,
    outboundBps,
    status: "ok",
  };
}

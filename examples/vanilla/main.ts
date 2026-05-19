import { BandwidthGrapherEngine, type BandwidthPoint } from "../../src";

const container = document.getElementById("graph");
if (!container) throw new Error("Graph container not found.");

const graph = new BandwidthGrapherEngine(container, {
  title: {
    host: "Router 2",
    ip: "103.158.27.6",
    interfaceName: "FTTH Main Link",
  },
  maxDataPoints: 400,
  intervalSeconds: 2,
  watermarkText: "KING OLT",
  scale: {
    initialMaxBps: 1_000_000_000,
  },
});

let timer: number | null = null;
let thresholdsEnabled = false;

loadDbLive();

document.getElementById("live")?.addEventListener("click", startLiveOnly);
document.getElementById("db-only")?.addEventListener("click", loadDbOnly);
document.getElementById("db-live")?.addEventListener("click", loadDbLive);
document.getElementById("timeout")?.addEventListener("click", () => graph.pushTimeout());
document.getElementById("timeout-range")?.addEventListener("click", pushTimeoutRange);
document.getElementById("zoom-in")?.addEventListener("click", () => graph.zoomIn());
document.getElementById("zoom-out")?.addEventListener("click", () => graph.zoomOut());
document.getElementById("pan-left")?.addEventListener("click", () => graph.panPercent(-0.25));
document.getElementById("pan-right")?.addEventListener("click", () => graph.panPercent(0.25));
document.getElementById("fit-data")?.addEventListener("click", () => graph.fitDataRange());
document.getElementById("follow-live")?.addEventListener("click", () => {
  graph.setMode("history-live");
  graph.resetRange();
  startLive();
});
document.getElementById("threshold")?.addEventListener("click", toggleThreshold);
document.getElementById("export")?.addEventListener("click", () => {
  const url = graph.exportImage();
  const link = document.createElement("a");
  link.href = url;
  link.download = "bandwidth-grapher.png";
  link.click();
});

function startLiveOnly(): void {
  graph.setData([], { mode: "live", followLive: true });
  startLive();
}

function loadDbOnly(): void {
  stopLive();
  graph.setData(createHistoryPoints(), { mode: "history", range: "data" });
}

function loadDbLive(): void {
  graph.setData(createHistoryPoints(), { mode: "history-live", followLive: true });
  startLive();
}

function startLive(): void {
  stopLive();
  timer = window.setInterval(() => {
    graph.appendPoint(createPoint(new Date()));
  }, 2_000);
}

function stopLive(): void {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

function toggleThreshold(): void {
  thresholdsEnabled = !thresholdsEnabled;
  graph.setOptions({
    thresholds: thresholdsEnabled
      ? [
          { valueBps: 500_000_000, label: "Warning 500M", color: "#f59e0b" },
          { valueBps: 800_000_000, label: "Critical 800M", color: "#ef4444" },
        ]
      : [],
  });
}

function pushTimeoutRange(): void {
  stopLive();

  const start = Date.now();
  for (let index = 0; index < 12; index += 1) {
    graph.pushTimeout(new Date(start + index * 2_000));
  }

  graph.appendPoint(createPoint(new Date(start + 24_000)));
}

function createHistoryPoints(): BandwidthPoint[] {
  const now = Date.now();
  const points: BandwidthPoint[] = [];

  for (let index = 399; index >= 0; index -= 1) {
    const jitter = index % 17 === 0 ? 900 : 0;
    const time = new Date(now - index * 2_000 - jitter);
    points.push(createPoint(time));
  }

  return points;
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

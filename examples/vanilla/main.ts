import { BandwidthGrapherEngine, type BandwidthPoint } from "../../src";

const container = document.getElementById("graph");
const streamStatus = document.getElementById("stream-status");
if (!container) throw new Error("Graph container not found.");

const realInterfaceName = "FTTH Main Link";
const realStreamPath = `/romon-sse/app/api/stream_interface_traffic.php?router_id=6&names=${encodeURIComponent(
  "FTTH Main Link,sfp-sfpplus1",
)}`;

const graph = new BandwidthGrapherEngine(container, {
  title: {
    host: "Router 2",
    ip: "103.158.27.6",
    interfaceName: realInterfaceName,
  },
  maxDataPoints: 400,
  intervalSeconds: 2,
  watermarkText: "KING OLT",
  scale: {
    initialMaxBps: 1_000_000_000,
  },
});

let timer: number | null = null;
let realStream: EventSource | null = null;
let realStreamTimeout: number | null = null;
let thresholdsEnabled = false;

loadDbLive();

document.getElementById("live")?.addEventListener("click", startLiveOnly);
document.getElementById("romon-live")?.addEventListener("click", startRomonLive);
document.getElementById("stop-stream")?.addEventListener("click", () => {
  stopLive();
  stopRealStream();
  setStatus("Source: stopped");
});
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
  stopRealStream();
  graph.setData([], { mode: "live", followLive: true });
  startLive();
  setStatus("Source: dummy live");
}

function loadDbOnly(): void {
  stopLive();
  stopRealStream();
  graph.setData(createHistoryPoints(), { mode: "history", range: "data" });
  setStatus("Source: dummy DB-only");
}

function loadDbLive(): void {
  stopRealStream();
  graph.setData(createHistoryPoints(), { mode: "history-live", followLive: true });
  startLive();
  setStatus("Source: dummy DB + live");
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

function startRomonLive(): void {
  stopLive();
  stopRealStream();
  graph.setData([], { mode: "live", followLive: true });
  graph.setOptions({
    title: {
      host: "Router 2",
      ip: "103.158.27.6",
      interfaceName: realInterfaceName,
    },
  });

  setStatus("Source: connecting to romon SSE...");
  realStream = new EventSource(realStreamPath);
  resetRealStreamTimeout();

  realStream.onopen = () => {
    setStatus("Source: romon SSE connected");
    resetRealStreamTimeout();
  };

  realStream.onmessage = (event) => {
    resetRealStreamTimeout();
    const point = parseRomonPoint(event.data, realInterfaceName);
    if (!point) {
      setStatus(`Source: romon event ignored (${shorten(event.data)})`);
      console.debug("Ignored romon SSE payload", event.data);
      return;
    }
    graph.appendPoint(point);
    setStatus(`Source: romon SSE live (${realInterfaceName}) rx=${formatMbps(point.inboundBps)} tx=${formatMbps(point.outboundBps)}`);
  };

  realStream.onerror = () => {
    setStatus("Source: romon SSE reconnecting...");
    graph.pushTimeout();
    resetRealStreamTimeout();
  };
}

function stopRealStream(): void {
  if (realStream) {
    realStream.close();
    realStream = null;
  }

  if (realStreamTimeout !== null) {
    window.clearTimeout(realStreamTimeout);
    realStreamTimeout = null;
  }
}

function resetRealStreamTimeout(): void {
  if (realStreamTimeout !== null) window.clearTimeout(realStreamTimeout);
  realStreamTimeout = window.setTimeout(() => {
    graph.pushTimeout();
    resetRealStreamTimeout();
  }, 10_000);
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
  stopRealStream();

  const start = Date.now();
  for (let index = 0; index < 12; index += 1) {
    graph.pushTimeout(new Date(start + index * 2_000));
  }

  graph.appendPoint(createPoint(new Date(start + 24_000)));
  setStatus("Source: manual timeout range");
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

function parseRomonPoint(rawData: string, interfaceName: string): BandwidthPoint | null {
  const cleanedData = rawData.trim().replace(/^data:\s*/i, "");
  if (!cleanedData) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(cleanedData);
  } catch {
    return null;
  }

  const candidate = findInterfacePayload(payload, interfaceName) ?? findTrafficPayload(payload, interfaceName);
  if (!candidate || typeof candidate !== "object") return null;

  const record = candidate as Record<string, unknown>;
  const inboundBps = firstNumber(record, ["rx_bps", "rxBps", "rx", "inboundBps", "in_bps", "input_bps"]);
  const outboundBps = firstNumber(record, ["tx_bps", "txBps", "tx", "outboundBps", "out_bps", "output_bps"]);
  if (inboundBps === null || outboundBps === null) return null;

  return {
    time: firstTime(record) ?? new Date(),
    inboundBps,
    outboundBps,
    status: "ok",
  };
}

function findInterfacePayload(payload: unknown, interfaceName: string): unknown {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  if (matchesInterface(record, interfaceName)) return record;

  const direct = record[interfaceName];
  if (direct) return direct;

  for (const key of ["interfaces", "data", "results", "traffic"]) {
    const value = record[key];
    if (!value) continue;

    if (Array.isArray(value)) {
      const match = value.find((item) => {
        if (!item || typeof item !== "object") return false;
        return matchesInterface(item as Record<string, unknown>, interfaceName);
      });
      if (match) return match;
    }

    if (typeof value === "object") {
      const nested = value as Record<string, unknown>;
      if (nested[interfaceName]) return nested[interfaceName];
    }
  }

  return null;
}

function findTrafficPayload(payload: unknown, interfaceName?: string): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  if (firstNumber(record, ["rx_bps", "rxBps", "rx", "inboundBps"]) !== null) {
    if (!interfaceName || !hasInterfaceIdentity(record) || matchesInterface(record, interfaceName)) return record;
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      const match = value.map((item) => findTrafficPayload(item, interfaceName)).find(Boolean);
      if (match) return match;
    } else if (value && typeof value === "object") {
      const match = findTrafficPayload(value, interfaceName);
      if (match) return match;
    }
  }

  return null;
}

function matchesInterface(record: Record<string, unknown>, interfaceName: string): boolean {
  const candidates = [
    record.targetId,
    record.name,
    record.interface,
    record.interface_name,
    record.ifName,
  ];

  return candidates.some((value) => {
    if (typeof value !== "string") return false;
    return value === interfaceName || value.endsWith(`|${interfaceName}`);
  });
}

function hasInterfaceIdentity(record: Record<string, unknown>): boolean {
  return ["targetId", "name", "interface", "interface_name", "ifName"].some((key) => typeof record[key] === "string");
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function firstTime(record: Record<string, unknown>): Date | null {
  for (const key of ["time", "timestamp", "created_at", "date"]) {
    const value = record[key];
    if (typeof value === "number" || typeof value === "string") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  return null;
}

function setStatus(message: string): void {
  if (streamStatus) streamStatus.textContent = message;
}

function formatMbps(value: number | null): string {
  if (value === null) return "N/A";
  return `${(value / 1_000_000).toFixed(1)}M`;
}

function shorten(value: string): string {
  return value.length > 90 ? `${value.slice(0, 90)}...` : value;
}

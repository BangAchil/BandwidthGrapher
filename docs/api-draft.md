# API Draft

## Point data

```ts
type BandwidthPoint = {
  time: Date | number | string;
  inboundBps: number | null;
  outboundBps: number | null;
  status?: "ok" | "timeout" | "error";
};
```

## Core engine

```ts
const graph = new BandwidthGrapherEngine(container, options);

graph.setData(points);
graph.setData(points, { mode: "history", range: "data" });
graph.setData(points, { mode: "history-live", followLive: true });
graph.appendPoint(point);
graph.pushTimeout();
graph.setMode("live");
graph.setRange(start, end);
graph.resetRange();
graph.fitDataRange();
graph.zoomIn();
graph.zoomOut();
graph.panPercent(0.25);
graph.setOptions(options);
graph.resize();
graph.exportImage();
graph.destroy();
```

## Data modes

### Live SSE

```ts
graph.setData([], { mode: "live", followLive: true });

stream.onmessage = (event) => {
  const data = JSON.parse(event.data);
  graph.appendPoint({
    time: new Date(),
    inboundBps: data.rx_bps,
    outboundBps: data.tx_bps,
  });
};
```

### DB-only

```ts
graph.setData(historyPoints, {
  mode: "history",
  range: "data",
});
```

### DB + live

```ts
graph.setData(historyPoints, {
  mode: "history-live",
  followLive: true,
});

graph.appendPoint(livePoint);
```

Calling `setRange`, `fitDataRange`, `zoomIn`, `zoomOut`, or `panPercent` disables live-follow until `resetRange()` is called.

## React wrapper

```tsx
<BandwidthGrapher
  ref={graphRef}
  mode="history-live"
  points={historyPoints}
  range={null}
  options={{
    title: { host: "Router 2", ip: "103.158.27.6", interfaceName: "FTTH Main Link" },
  }}
/>
```

Imperative live append:

```ts
graphRef.current?.appendPoint(livePoint);
graphRef.current?.pushTimeout();
graphRef.current?.zoomIn();
graphRef.current?.resetRange();
```

## Option groups

- `title`: host, ip, interfaceName.
- `legend`: inboundLabel, outboundLabel, visible.
- `scale`: autoScale, minY, maxY, hardCapBps, headroom.
- `time`: intervalSeconds, maxDataPoints, range.
- `thresholds`: warning/critical lines or areas.
- `theme`: colors, fonts, spacing.
- `interaction`: tooltip, wheelZoom, dragPan, hover line, minRangeMs.
- `export`: image/data behavior.

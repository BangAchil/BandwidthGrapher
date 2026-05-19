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
graph.appendPoint(point);
graph.pushTimeout();
graph.setRange(start, end);
graph.resetRange();
graph.setOptions(options);
graph.resize();
graph.exportImage();
graph.destroy();
```

## React wrapper

```tsx
<BandwidthGrapher
  ref={graphRef}
  title={{ host: "Router 2", ip: "103.158.27.6", interfaceName: "FTTH Main Link" }}
  mode="history-live"
  options={options}
/>
```

## Option groups

- `title`: host, ip, interfaceName.
- `legend`: inboundLabel, outboundLabel, visible.
- `scale`: autoScale, minY, maxY, hardCapBps, headroom.
- `time`: intervalSeconds, maxDataPoints, range.
- `thresholds`: warning/critical lines or areas.
- `theme`: colors, fonts, spacing.
- `interaction`: tooltip, zoom, pan, hover line.
- `export`: image/data behavior.

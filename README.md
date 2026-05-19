# BandwidthGrapher

BandwidthGrapher adalah library chart bandwidth custom untuk KING OLT.

Tujuan utama library ini adalah menyediakan graph bandwidth yang punya karakter visual sendiri, ringan untuk data live, dan tetap kuat untuk data history dari database.

## Scope awal

- Canvas bandwidth graph tanpa window manager.
- Support live append, history data, dan history + live.
- API runtime untuk update options, theme, title, legend, threshold, dan range.
- Tooltip, threshold, export image, autoscale, dan summary statistik sudah mulai tersedia di core engine.
- Zoom/pan/range selector akan dimatangkan setelah renderer V0 stabil.

## Quick start

```ts
import { BandwidthGrapherEngine } from "@king-olt/bandwidth-grapher";

const graph = new BandwidthGrapherEngine(container, {
  title: {
    host: "Router 2",
    ip: "103.158.27.6",
    interfaceName: "FTTH Main Link",
  },
});

graph.appendPoint({
  time: new Date(),
  inboundBps: 236_200_000,
  outboundBps: 24_800_000,
});
```

## Theme

KING NMS theme tersedia sebagai preset:

```ts
import { BandwidthGrapherEngine, kingNmsTheme } from "@king-olt/bandwidth-grapher";

const graph = new BandwidthGrapherEngine(container, {
  ...kingNmsTheme,
  title: {
    host: "Router 2",
    ip: "103.158.27.6",
    interfaceName: "FTTH Main Link",
  },
});
```

Warna tetap bisa dioverride per instance:

```ts
graph.setOptions({
  colors: {
    inboundFill: "#ff8a1d",
    outboundLine: "#4aa3ff",
  },
});
```

## Prinsip desain

BandwidthGrapher tidak tahu endpoint API, SSE, router, OLT, atau database aplikasi. Aplikasi consumer yang mengambil data, lalu library hanya menerima point dan menggambar graph.

```ts
graph.setData(points);
graph.appendPoint(point);
graph.pushTimeout();
graph.setRange(start, end);
graph.setOptions(options);
graph.exportImage();
```

## Dokumen

- `docs/product-flow.md`
- `docs/api-draft.md`
- `docs/legacy-conversion.md`
- `docs/testing.md`

## Status

Repositori ini masih tahap fondasi. API bisa berubah sampai versi `1.0.0`.

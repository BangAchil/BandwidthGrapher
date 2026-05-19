# BandwidthGrapher

BandwidthGrapher adalah library chart bandwidth custom untuk KING OLT.

Tujuan utama library ini adalah menyediakan graph bandwidth yang punya karakter visual sendiri, ringan untuk data live, dan tetap kuat untuk data history dari database.

## Scope awal

- Canvas bandwidth graph tanpa window manager.
- Support live append, history data, dan history + live.
- API runtime untuk update options, theme, title, legend, threshold, dan range.
- Tooltip, zoom/range, export, autoscale, dan summary statistik akan dimatangkan bertahap.

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

## Status

Repositori ini masih tahap fondasi. API bisa berubah sampai versi `1.0.0`.

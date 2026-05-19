# Legacy Conversion Notes

Dokumen ini memetakan dua file referensi lama ke arsitektur BandwidthGrapher.

## BandwidthGraph.js

Yang dikonversi ke TypeScript core:

- canvas render lifecycle
- resize redraw
- data buffer live
- timeout point
- autoscale Y axis
- nice ceiling scale
- area inbound
- line outbound
- step dan linear graph style
- grid waktu
- title kiri/kanan
- summary current/average/maximum
- tooltip hover
- export image
- threshold line awal

Perubahan desain:

- constructor lama `new BandwidthGraph(canvasId, tooltipId, options)` diganti menjadi `new BandwidthGrapherEngine(container, options)`.
- canvas dan tooltip dibuat otomatis di dalam container.
- opsi dipisah menjadi group `colors`, `legend`, `scale`, `interaction`, dan `thresholds`.
- method `updateData(inboundBps, outboundBps)` diganti menjadi `appendPoint({ time, inboundBps, outboundBps })`.
- method `pushTimeoutData()` diganti menjadi `pushTimeout()`.

## GraphWindowManager.js

Yang dipakai sebagai referensi flow, bukan dikonversi menjadi library:

- SSE membuka stream.
- pesan sukses memanggil append point.
- timeout/error memanggil timeout point.
- close window menghentikan stream dan destroy graph.

Yang sengaja tidak masuk library:

- WinBox
- window titlebar
- tombol refresh window
- endpoint PHP
- router/port selection
- state `activeGraphWindows`

Nanti integrasi KING OLT sebaiknya membuat adapter aplikasi sendiri yang memanggil API BandwidthGrapher.

```ts
const graph = new BandwidthGrapherEngine(container, options);
const stream = new EventSource(url);

stream.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.status === "success") {
    graph.appendPoint({
      time: new Date(),
      inboundBps: data.rx_bps,
      outboundBps: data.tx_bps,
    });
  } else {
    graph.pushTimeout();
  }
};

stream.onerror = () => {
  graph.pushTimeout();
  stream.close();
};
```

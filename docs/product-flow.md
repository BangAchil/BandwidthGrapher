# Product Flow

## Visi

BandwidthGrapher menjadi chart bandwidth khas KING OLT: cepat, jelas, dan cocok untuk monitoring jaringan real-time maupun history.

## Mode data

1. Live SSE
   - Aplikasi membuka stream.
   - Setiap pesan sukses dikirim ke `appendPoint`.
   - Jika stream timeout, aplikasi memanggil `pushTimeout`.

2. Database only
   - Aplikasi mengambil data history.
   - Data dikirim ke `setData`.
   - User bisa memilih range waktu dan zoom.

3. Database + live
   - Aplikasi load data history awal.
   - Graph masuk mode append live.
   - Data live menambah titik baru tanpa membuang konteks history yang sedang terlihat.

## Flow render

1. Container dibuat oleh consumer.
2. Canvas engine mount ke container.
3. Data dinormalisasi ke format point standar.
4. Scale X/Y dihitung dari range dan data aktif.
5. Renderer menggambar grid, axis, series, threshold, legend, summary, tooltip, dan watermark.
6. Resize dan option update memicu redraw.
7. Destroy membersihkan event listener dan resource.

## Fitur bertahap

- V0: graph canvas mirip referensi lama, tanpa window.
- V1: live/history/history-live, tooltip, autoscale, threshold, theme.
- V2: zoom, pan, range selector, export image/data.
- V3: plugin layer, multi-series, annotation, downsampling untuk data besar.

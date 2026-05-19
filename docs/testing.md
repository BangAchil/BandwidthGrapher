# Testing Guide

## Test manual playground

1. Install dependencies.

```powershell
pnpm install
```

2. Jalankan playground.

```powershell
pnpm dev
```

3. Buka URL Vite yang muncul di terminal.

Yang dicek:

- graph tampil tanpa window
- tombol `Live dummy` mengosongkan graph lalu append live point
- tombol `DB only` menampilkan seluruh range data history
- tombol `DB + live` load data history lalu lanjut live append
- title kiri dan kanan muncul
- inbound area hijau bergerak
- outbound line biru bergerak
- label Y dan waktu X muncul
- summary current/average/maximum berubah
- tooltip muncul saat hover
- tombol timeout membuat blok merah
- tombol threshold menampilkan garis threshold
- tombol zoom/pan mengubah range waktu
- mouse wheel melakukan zoom terhadap posisi cursor
- drag canvas menggeser range waktu
- tombol `Fit data` kembali ke seluruh range history
- tombol `Follow live` kembali ke trailing live range
- tombol export mengunduh PNG

## Test typecheck

```powershell
pnpm typecheck
```

## Test build package

```powershell
pnpm build
```

## Test integrasi KING OLT nanti

KING OLT cukup membuat container graph, lalu mengirim data dari SSE/API/DB ke method library:

- `setData(points)` untuk history DB
- `setData(points, { mode: "history", range: "data" })` untuk DB-only
- `setData(points, { mode: "history-live", followLive: true })` untuk DB + live
- `appendPoint(point)` untuk live SSE
- `pushTimeout()` untuk stream timeout/error
- `setRange(start, end)` untuk range time
- `zoomIn()`, `zoomOut()`, dan `panPercent()` untuk navigasi waktu
- `setOptions(options)` untuk legend, title, threshold, theme
- `exportImage()` untuk export PNG

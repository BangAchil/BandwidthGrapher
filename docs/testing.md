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
- title kiri dan kanan muncul
- inbound area hijau bergerak
- outbound line biru bergerak
- label Y dan waktu X muncul
- summary current/average/maximum berubah
- tooltip muncul saat hover
- tombol timeout membuat blok merah
- tombol threshold menampilkan garis threshold
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
- `appendPoint(point)` untuk live SSE
- `pushTimeout()` untuk stream timeout/error
- `setRange(start, end)` untuk range time
- `setOptions(options)` untuk legend, title, threshold, theme
- `exportImage()` untuk export PNG

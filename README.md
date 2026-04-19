# Microstructure Dashboard v2 — Browser-Direct

Versi ini TIDAK memerlukan Python backend sama sekali.
Browser terhubung langsung ke Binance WebSocket.

## Setup (1 langkah saja!)

```bash
npm install
npm run dev
```

Buka: http://localhost:3000

## Kenapa berbeda dari v1?

v1: Browser → Python (port 8000) → Binance  ← Python diblokir di Indonesia
v2: Browser → Binance langsung              ← Chrome bisa akses Binance ✓

Semua komputasi (VPIN, LOB, Resilience, OTT) dilakukan di browser (TypeScript).
Tidak perlu install Python, tidak perlu backend, tidak ada masalah firewall.
